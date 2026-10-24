'use server';

import { isValidObjectId } from 'mongoose';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '../auth';
import { connectDB } from '../db';
import { CURRENCIES, round2 } from '../currency';
import { getRates } from '../rates';
import { createInvoiceForPayment, refreshInvoiceForPayment, voidInvoiceForPayment } from '../invoices';
import { Payment } from '../models/Payment';
import { Project } from '../models/Project';
import { Subscription } from '../models/Subscription';
import { PAYMENT_METHODS, type ActionResult } from '../types';

const schema = z.object({
  projectId: z.string().default(''),
  subscriptionId: z.string().default(''),
  period: z.string().regex(/^\d{4}-\d{2}$/).or(z.literal('')).default(''),
  amount: z.coerce.number({ invalid_type_error: 'Amount must be a number.' }).positive('Amount must be more than zero.'),
  currency: z.enum(CURRENCIES),
  fxRate: z
    .string()
    .default('')
    .transform((v) => (v.trim() ? Number(v) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v > 0), 'Exchange rate must be a positive number.'),
  paidAt: z.coerce.date({ invalid_type_error: 'Pick the payment date.' }),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(120).default(''),
  note: z.string().trim().max(1000).default(''),
});

const fail = (error: string): ActionResult => ({ ok: false, error });

/** Works out the payment's target (a project, or a subscription month) and the snapshot exchange rate. */
async function build(fd: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message } as const;
  const { projectId, subscriptionId, period, fxRate, ...d } = parsed.data;

  let target: { currency: string; client: unknown; refs: Record<string, unknown> };
  if (subscriptionId) {
    if (!isValidObjectId(subscriptionId) || !period) return { error: 'Choose the subscription month.' } as const;
    const sub = await Subscription.findById(subscriptionId).lean();
    if (!sub) return { error: 'Subscription not found.' } as const;
    target = { currency: sub.currency, client: sub.client, refs: { subscription: sub._id, period, project: null } };
  } else {
    if (!isValidObjectId(projectId)) return { error: 'Choose a project.' } as const;
    const project = await Project.findById(projectId).lean();
    if (!project) return { error: 'Project not found.' } as const;
    target = { currency: project.currency, client: project.client ?? null, refs: { project: project._id, subscription: null, period: null } };
  }

  let rate = 1;
  if (d.currency !== target.currency) {
    if (fxRate) rate = fxRate;
    else {
      const { rates } = await getRates();
      rate = rates[target.currency as keyof typeof rates] / rates[d.currency];
    }
  }
  return { data: { ...d, ...target.refs, client: target.client, fxRate: rate, amountInProjectCurrency: round2(d.amount * rate) } } as const;
}

const refresh = () => {
  revalidatePath('/admin', 'layout');
  revalidatePath('/portal');
};

export async function createPayment(fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  await connectDB();
  const r = await build(fd);
  if ('error' in r) return fail(r.error!);
  const pay = await Payment.create(r.data);
  const inv = await createInvoiceForPayment(pay._id).catch((e) => (console.error('[invoice]', e.message), null));
  refresh();
  return { ok: true, message: inv ? `Payment recorded. Invoice ${inv.number} is ready to send.` : 'Payment recorded.' };
}

export async function updatePayment(id: string, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(id)) return fail('Payment not found.');
  await connectDB();
  const r = await build(fd);
  if ('error' in r) return fail(r.error!);
  const res = await Payment.updateOne({ _id: id }, r.data);
  if (!res.matchedCount) return fail('Payment not found.');
  await refreshInvoiceForPayment(id);
  refresh();
  return { ok: true, message: 'Payment updated.' };
}

export async function deletePayment(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(id)) return fail('Payment not found.');
  await connectDB();
  await voidInvoiceForPayment(id);
  await Payment.deleteOne({ _id: id });
  refresh();
  return { ok: true, message: 'Payment deleted. Its invoice was marked void.' };
}
