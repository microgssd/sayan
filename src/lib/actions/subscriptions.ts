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

const month = z.string().regex(/^\d{4}-\d{2}$/, 'Pick a month.');
const schema = z.object({
  clientId: z.string().refine(isValidObjectId, 'Choose a client.'),
  name: z.string().trim().min(2, 'Give the subscription a name.').max(80),
  description: z.string().trim().max(500).default(''),
  amount: z.coerce.number({ invalid_type_error: 'Monthly amount must be a number.' }).positive('Monthly amount must be more than zero.'),
  currency: z.enum(CURRENCIES),
  startMonth: month,
  dueDay: z.coerce.number().int().min(1, 'Due day must be 1 to 28.').max(28, 'Due day must be 1 to 28.'),
});

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
  const { clientId, ...rest } = p.data;
  const tr = await syncTranslations({ english: { description: rest.description }, previousSource: {}, current: {} });
  await Subscription.create({ ...rest, client: clientId, priceHistory: [{ from: rest.startMonth, amount: rest.amount }], translations: tr.translations, trSource: tr.source });
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
  const { clientId, ...rest } = p.data;
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
  sub.set({ ...rest, client: clientId, translations: tr.translations, trSource: tr.source });
  await sub.save();
  if (String(sub.client) !== clientId) await Payment.updateMany({ subscription: id }, { client: clientId });
  refresh();
  return { ok: true, message: `Subscription updated.${note}` };
}

export async function endSubscription(id: string, end: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(id)) return fail('Subscription not found.');
  await connectDB();
  await Subscription.updateOne({ _id: id }, end ? { status: 'ended', endMonth: monthKey() } : { status: 'active', endMonth: null });
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
