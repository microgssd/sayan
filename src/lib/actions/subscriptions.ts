'use server';

import { isValidObjectId } from 'mongoose';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '../auth';
import { connectDB } from '../db';
import { CURRENCIES } from '../currency';
import { Payment } from '../models/Payment';
import { Subscription } from '../models/Subscription';
import { User } from '../models/User';
import { monthKey, priceFor } from '../periods';
import type { ActionResult } from '../types';
import { createPayment } from './payments';
import { syncTranslations } from '../translate';
import { logEvent } from '../events';
import { Plan } from '../models/Plan';
import { Project } from '../models/Project';
import { cancelAutopay, newKey, syncSite } from '../waas';

const month = z.string().regex(/^\d{4}-\d{2}$/, 'Pick a month.');
const schema = z.object({
  clientId: z.string().refine(isValidObjectId, 'Choose a client.'),
  name: z.string().trim().min(2, 'Give the subscription a name.').max(80),
  description: z.string().trim().max(500).default(''),
  amount: z.coerce.number({ invalid_type_error: 'Monthly amount must be a number.' }).positive('Monthly amount must be more than zero.'),
  currency: z.enum(CURRENCIES),
  startMonth: month,
  dueDay: z.coerce.number().int().min(1, 'Due day must be 1 to 28.').max(28, 'Due day must be 1 to 28.'),
  // website as a service
  planId: z.string().default(''),
  projectId: z.string().default(''),
  waas: z.string().optional(), // checkbox: 'on' when ticked
  siteUrl: z.string().trim().max(200).default(''),
  graceDays: z.coerce.number().int().min(0, 'Grace days must be 0 to 60.').max(60, 'Grace days must be 0 to 60.').default(7),
});

/** Checks the linked plan and project and turns the form's WaaS fields into stored values. */
async function waasFields(d: z.infer<typeof schema>) {
  const plan = isValidObjectId(d.planId) ? await Plan.findById(d.planId).select('name').lean() : null;
  let project: any = null;
  if (isValidObjectId(d.projectId)) {
    project = await Project.findById(d.projectId).select('client name').lean();
    if (!project) return { error: 'That project no longer exists.' } as const;
    if (String(project.client ?? '') !== d.clientId) return { error: 'That project belongs to a different client.' } as const;
  }
  const url = d.siteUrl && !/^https?:\/\//i.test(d.siteUrl) ? `https://${d.siteUrl}` : d.siteUrl;
  return { plan: plan?._id ?? null, planName: plan?.name ?? '', project: project?._id ?? null, waas: d.waas === 'on', siteUrl: url, graceDays: d.graceDays } as const;
}

const fail = (error: string): ActionResult => ({ ok: false, error });
const refresh = () => {
  revalidatePath('/admin', 'layout');
  revalidatePath('/portal');
};

export async function createSubscription(fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0]!.message);
  await connectDB();
  if (!(await User.exists({ _id: p.data.clientId, role: 'client' }))) return fail('Choose a valid client.');
  const w = await waasFields(p.data);
  if ('error' in w) return fail(String(w.error));
  const { clientId, planId, projectId, waas: _w, siteUrl: _s, graceDays: _g, ...rest } = p.data;
  const tr = await syncTranslations({ english: { description: rest.description }, previousSource: {}, current: {} });
  const created = await Subscription.create({
    ...rest, client: clientId, priceHistory: [{ from: rest.startMonth, amount: rest.amount }], translations: tr.translations, trSource: tr.source,
    plan: w.plan, project: w.project, waas: w.waas, siteUrl: w.siteUrl, graceDays: w.graceDays,
    siteKey: w.waas ? newKey() : '', payKey: w.waas ? newKey() : '',
  });
  if (w.plan || w.waas) await logEvent({ client: clientId, type: 'plan_subscribed', subscription: created._id, project: w.project, data: { plan: w.planName || rest.name, name: rest.name } });
  refresh();
  return { ok: true, message: 'Subscription created.' };
}

export async function updateSubscription(id: string, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(id)) return fail('Subscription not found.');
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0]!.message);
  await connectDB();
  const sub = await Subscription.findById(id);
  if (!sub) return fail('Subscription not found.');
  const paidMonths = await Payment.countDocuments({ subscription: id });
  // Paid months are snapshotted in the subscription's currency, so it can't change once money is recorded.
  if (paidMonths && p.data.currency !== sub.currency) return fail('This subscription has payments, so its currency is locked.');
  const w = await waasFields(p.data);
  if ('error' in w) return fail(String(w.error));
  const { clientId, planId, projectId, waas: _w, siteUrl: _s, graceDays: _g, ...rest } = p.data;
  const thisMonth = monthKey();
  const history = sub.priceHistory?.length ? [...sub.priceHistory] : [{ from: sub.startMonth, amount: sub.amount }];
  let note = '';
  if (rest.amount !== priceFor(sub, thisMonth)) {
    // New price applies from this month on (or from the start, if billing hasn't begun yet).
    const from = rest.startMonth > thisMonth ? rest.startMonth : thisMonth;
    const kept = history.filter((h) => h.from! < from);
    sub.set('priceHistory', [...kept, { from, amount: rest.amount }]);
    note = from === thisMonth ? ' The new price applies from this month; earlier months keep their original price.' : '';
  }
  const tr = await syncTranslations({
    english: { description: rest.description },
    previousSource: (sub.get('trSource') as Record<string, string>) ?? {},
    current: (sub.get('translations') as Record<string, Record<string, string>>) ?? {},
  });
  sub.set({ ...rest, client: clientId, translations: tr.translations, trSource: tr.source, plan: w.plan, project: w.project, waas: w.waas, siteUrl: w.siteUrl, graceDays: w.graceDays });
  if (w.waas && !sub.siteKey) sub.set({ siteKey: newKey(), payKey: newKey() });
  if (!w.waas) sub.set({ siteStatus: 'active', siteOverride: 'none', graceUntil: null });
  await sub.save();
  await syncSite(id).catch((e) => console.error('[waas]', e.message));
  if (String(sub.client) !== clientId) await Payment.updateMany({ subscription: id }, { client: clientId });
  refresh();
  return { ok: true, message: `Subscription updated.${note}` };
}

export async function endSubscription(id: string, end: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(id)) return fail('Subscription not found.');
  await connectDB();
  const before: any = await Subscription.findById(id).lean();
  await Subscription.updateOne({ _id: id }, end ? { status: 'ended', endMonth: monthKey(), siteStatus: 'active', siteOverride: 'none', graceUntil: null } : { status: 'active', endMonth: null });
  if (end && before) {
    // stop collecting: cancel the bank mandate too, and tell the client
    if (before.autopay?.status && ['active', 'paused', 'pending'].includes(before.autopay.status)) await cancelAutopay(id).catch((e) => console.error('[autopay]', e.message));
    if (before.waas || before.plan) await logEvent({ client: before.client, type: 'plan_cancelled', subscription: id, project: before.project ?? null, data: { plan: before.name, name: before.name } });
  }
  refresh();
  return { ok: true, message: end ? 'Subscription ended. This month is the last one billed.' : 'Subscription reactivated.' };
}

export async function deleteSubscription(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(id)) return fail('Subscription not found.');
  await connectDB();
  if (await Payment.exists({ subscription: id })) return fail('This subscription has payments. End it instead, so its history stays intact.');
  await Subscription.deleteOne({ _id: id });
  refresh();
  return { ok: true, message: 'Subscription deleted.' };
}

/** Tick a month as paid: records the payment (and its invoice), which stops the alert on the client’s side. */
export async function markMonthPaid(id: string, fd: FormData): Promise<ActionResult> {
  fd.set('subscriptionId', id);
  return createPayment(fd);
}
