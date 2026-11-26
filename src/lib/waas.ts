import crypto from 'node:crypto';
import { connectDB } from './db';
import { Invoice } from './models/Invoice';
import { PayOrder } from './models/PayOrder';
import { Payment } from './models/Payment';
import { Project } from './models/Project';
import { Subscription } from './models/Subscription';
import { User } from './models/User';
import * as cf from './cashfree';
import { logEvent } from './events';
import { createInvoiceForPayment } from './invoices';
import { monthKey, priceFor } from './periods';
import { deriveSiteState } from './site-state';
import { buildPeriods } from './subscriptions';

const DAY = 86_400_000;
export const newKey = () => crypto.randomBytes(18).toString('base64url');
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const payLinkFor = (payKey: string) => `${siteUrl()}/pay/${payKey}`;

/* ---------------- state ---------------- */

export async function siteStateFor(subId: unknown, now = new Date()) {
  await connectDB();
  const sub: any = await Subscription.findById(subId).lean();
  if (!sub) return null;
  const payments = await Payment.find({ subscription: sub._id }).lean();
  const periods = buildPeriods(sub, payments, now);
  const state = deriveSiteState({ periods, graceDays: sub.graceDays ?? 7, graceUntil: sub.graceUntil ?? null, override: sub.siteOverride ?? 'none', now });
  if (!sub.waas || sub.status !== 'active') state.status = 'active';
  return { sub, periods, state };
}

async function siteName(sub: any) {
  if (sub.project) {
    const p: any = await Project.findById(sub.project).select('name').lean();
    if (p?.name) return p.name as string;
  }
  return sub.name as string;
}

/**
 * Brings the stored site status in line with what's unpaid, and tells the client (and you) when it changes.
 * Safe to call any time: after a payment, a webhook, an admin action, the daily job or a guard check.
 */
export async function syncSite(subId: unknown, now = new Date()) {
  const loaded = await siteStateFor(subId, now);
  if (!loaded) return null;
  const { sub, state } = loaded;
  const prev = sub.siteStatus ?? 'active';
  if (state.status === prev) return state;
  // only one caller wins the change, so notices are never sent twice
  const res = await Subscription.updateOne({ _id: sub._id, siteStatus: prev }, { siteStatus: state.status, siteStatusAt: now });
  if (res.modifiedCount !== 1) return state;
  const name = await siteName(sub);
  const base = {
    client: sub.client,
    subscription: sub._id,
    project: sub.project ?? null,
    data: { name, amount: state.amountDue, currency: sub.currency, date: state.suspendOn ? state.suspendOn.toISOString() : null },
    cta: { kind: 'pay' as const, url: payLinkFor(sub.payKey) },
  };
  if (state.status === 'grace') await logEvent({ ...base, type: 'grace_started' });
  else if (state.status === 'suspended') await logEvent({ ...base, type: 'site_suspended' });
  else if (prev === 'suspended') await logEvent({ ...base, type: 'site_restored', cta: { kind: 'portal', url: `${siteUrl()}/portal` } });
  return state;
}

/* ---------------- recording money ---------------- */

/** Which month a payment belongs to: the oldest one still owing (or due within a week), else this month. */
function pickPeriod(periods: { period: string; dueDate: string; remaining: number }[], now: Date) {
  const open = periods
    .filter((p) => p.remaining > 0.009 && new Date(p.dueDate).getTime() <= now.getTime() + 7 * DAY)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  return open?.period ?? monthKey(now);
}

/** Records a payment that came through Cashfree: payment row, invoice (marked sent so the client can download it), update, site check. */
export async function recordGatewayPayment(p: { subId: unknown; period?: string; amount: number; cfPaymentId: string; refSuffix?: string; note: string; paidAt?: Date }) {
  await connectDB();
  const reference = `cf:${p.cfPaymentId}${p.refSuffix ? `:${p.refSuffix}` : ''}`;
  if (await Payment.exists({ reference })) return null; // a retried notification
  const loaded = await siteStateFor(p.subId);
  if (!loaded) throw new Error('Subscription not found');
  const { sub, periods } = loaded;
  const period = p.period ?? pickPeriod(periods, new Date());
  const amount = Math.round(p.amount * 100) / 100;
  if (!(amount > 0)) throw new Error('Payment amount missing');
  const pay = await Payment.create({
    subscription: sub._id, period, client: sub.client, amount, currency: sub.currency, fxRate: 1, amountInProjectCurrency: amount,
    paidAt: p.paidAt ?? new Date(), method: 'cashfree', reference, note: p.note,
  });
  const inv = await createInvoiceForPayment(pay._id);
  if (inv) await Invoice.updateOne({ _id: inv._id }, { status: 'sent', sentAt: new Date(), sentTo: 'Automatic receipt' });
  await Subscription.updateOne({ _id: sub._id }, { 'autopay.lastFailure': '', 'autopay.retryCount': 0, 'autopay.lastChargeId': '' });
  await logEvent({
    client: sub.client, subscription: sub._id, project: sub.project ?? null, type: 'payment_received',
    data: { amount, currency: sub.currency, period, name: await siteName(sub) },
  });
  await syncSite(sub._id);
  return pay;
}

/* ---------------- autopay mandates ---------------- */

/** The first debit: the next due day that is at least two days away (banks need notice before a debit). */
function firstChargeAt(dueDay: number, now: Date) {
  const min = now.getTime() + 2 * DAY;
  for (let i = 0; i < 3; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, Math.min(dueDay, 28), 4, 0, 0));
    if (d.getTime() >= min) return d;
  }
  return new Date(min);
}

export class UserFacingError extends Error {
  constructor(message: string, public code = '') {
    super(message);
  }
}

/** Starts a new mandate for a client's subscription. Returns the session the browser hands to Cashfree's checkout. */
export async function startAutopay(subId: unknown, clientId: unknown, phone?: string) {
  await connectDB();
  const sub: any = await Subscription.findOne({ _id: subId, client: clientId, status: 'active' }).lean();
  const user: any = await User.findById(clientId).lean();
  if (!sub || !user) throw new UserFacingError('Subscription not found.');
  const cleanPhone = (phone ?? '').replace(/[^\d+]/g, '');
  if (cleanPhone.length >= 8) await User.updateOne({ _id: user._id }, { phone: cleanPhone });
  const usePhone = cleanPhone.length >= 8 ? cleanPhone : user.phone;
  if (!usePhone && !process.env.CASHFREE_FALLBACK_PHONE) throw new UserFacingError('A phone number is needed.', 'phone');
  const attempt = (sub.autopay?.attempt ?? 0) + 1;
  const cfId = `sd-${String(sub._id)}-${attempt}`;
  const now = new Date();
  const m = await cf.createMandate({
    subscriptionId: cfId,
    name: user.name,
    email: user.email,
    phone: cf.phoneFor(usePhone),
    planName: sub.name,
    currency: sub.currency,
    amount: priceFor(sub, monthKey(now)),
    firstChargeAt: firstChargeAt(sub.dueDay, now),
    returnUrl: `${siteUrl()}/portal?autopay=${String(sub._id)}`,
  });
  const replacing = sub.autopay?.status === 'active' || sub.autopay?.status === 'paused' ? sub.autopay.cfId : '';
  await Subscription.updateOne(
    { _id: sub._id },
    { 'autopay.status': 'pending', 'autopay.attempt': attempt, 'autopay.cfId': cfId, 'autopay.cfRef': m.cfSubscriptionId, 'autopay.replaces': replacing || sub.autopay?.replaces || '' },
  );
  return { sessionId: m.sessionId, env: cf.cashfreeEnv() };
}

async function subByGateway(subscriptionId: string) {
  await connectDB();
  return (await Subscription.findOne({ 'autopay.cfId': subscriptionId }).lean()) as any;
}

/** Applies a mandate state change (from a webhook or a lookup) and announces what matters. */
export async function applyMandateStatus(subscriptionId: string, cfStatus: string, extra: { cfRef?: string; method?: string; nextChargeAt?: Date | null } = {}) {
  const sub = await subByGateway(subscriptionId);
  if (!sub) return false; // an old mandate we replaced, or not ours
  const status = cf.mapMandateStatus(cfStatus);
  const prev = sub.autopay?.status ?? 'none';
  const set: Record<string, unknown> = { 'autopay.status': status };
  if (extra.cfRef) set['autopay.cfRef'] = extra.cfRef;
  if (extra.method) set['autopay.method'] = extra.method;
  if (extra.nextChargeAt) set['autopay.nextChargeAt'] = extra.nextChargeAt;
  if (status === 'active') set['autopay.activatedAt'] = sub.autopay?.activatedAt ?? new Date();
  await Subscription.updateOne({ _id: sub._id }, set);
  if (status === prev) return true;
  const name = await siteName(sub);
  const base = { client: sub.client, subscription: sub._id, project: sub.project ?? null };
  if (status === 'active') {
    await logEvent({ ...base, type: 'autopay_active', data: { name, amount: priceFor(sub, monthKey(new Date())), currency: sub.currency }, cta: { kind: 'portal', url: `${siteUrl()}/portal` } });
    if (sub.autopay?.replaces) {
      await cf.manageMandate(sub.autopay.replaces, 'CANCEL').catch(() => {});
      await Subscription.updateOne({ _id: sub._id }, { 'autopay.replaces': '' });
    }
  } else if (status === 'cancelled' && prev === 'active') {
    await logEvent({ ...base, type: 'autopay_cancelled', data: { name }, cta: { kind: 'portal', url: `${siteUrl()}/portal` } });
  } else if (status === 'failed') {
    await logEvent({ ...base, type: 'autopay_failed', data: { name }, cta: { kind: 'portal', url: `${siteUrl()}/portal` } });
  }
  return true;
}

/** Asks Cashfree where a mandate stands (used on return from checkout, and by the daily job for pending ones). */
export async function syncAutopay(subId: unknown) {
  await connectDB();
  const sub: any = await Subscription.findById(subId).lean();
  if (!sub?.autopay?.cfId || !cf.cashfreeReady()) return;
  const m = await cf.fetchMandate(sub.autopay.cfId);
  await applyMandateStatus(sub.autopay.cfId, m.status, { cfRef: m.cfSubscriptionId, method: m.method, nextChargeAt: m.nextScheduleDate });
}

export async function cancelAutopay(subId: unknown) {
  await connectDB();
  const sub: any = await Subscription.findById(subId).lean();
  if (!sub?.autopay?.cfId || !['active', 'paused', 'pending'].includes(sub.autopay.status)) return false;
  await cf.manageMandate(sub.autopay.cfId, 'CANCEL');
  await applyMandateStatus(sub.autopay.cfId, 'CANCELLED');
  return true;
}

export async function onChargeSucceeded(ev: Extract<cf.GatewayEvent, { kind: 'charge_success' }>) {
  if (/^auth/i.test(ev.paymentType)) return 'authorisation charge, not a payment';
  const sub = await subByGateway(ev.subscriptionId);
  if (!sub) return 'unknown subscription';
  const loaded = await siteStateFor(sub._id);
  const scheduled = ev.scheduledAt ? monthKey(ev.scheduledAt) : undefined;
  const period = scheduled && loaded?.periods.some((p) => p.period === scheduled) ? scheduled : undefined;
  const amount = ev.amount > 0 ? ev.amount : priceFor(sub, monthKey(new Date()));
  const pay = await recordGatewayPayment({ subId: sub._id, period, amount, cfPaymentId: ev.cfPaymentId || ev.paymentId, note: 'Autopay' });
  return pay ? 'payment recorded' : 'already recorded';
}

export async function onChargeFailed(ev: Extract<cf.GatewayEvent, { kind: 'charge_failed' }>) {
  if (/^auth/i.test(ev.paymentType)) return 'authorisation failed';
  const sub = await subByGateway(ev.subscriptionId);
  if (!sub) return 'unknown subscription';
  const now = new Date();
  await Subscription.updateOne(
    { _id: sub._id },
    { 'autopay.lastFailureAt': now, 'autopay.lastFailure': ev.reason.slice(0, 200), 'autopay.lastChargeId': ev.paymentId || ev.cfPaymentId, $inc: { 'autopay.retryCount': 1 } },
  );
  const name = await siteName(sub);
  await logEvent({
    client: sub.client, subscription: sub._id, project: sub.project ?? null, type: 'payment_failed',
    data: { name, amount: ev.amount > 0 ? ev.amount : priceFor(sub, monthKey(now)), currency: sub.currency, reason: ev.reason.replace(/[.\s]*$/, '.') },
    cta: { kind: 'pay', url: payLinkFor(sub.payKey) },
  });
  await syncSite(sub._id);
  return 'failure recorded';
}

/* ---------------- one-off "Pay now" ---------------- */

/** An online payment for everything overdue (and anything due within a week), in the subscription's own currency. */
export async function createOverdueOrder(subId: unknown, where: { clientId?: unknown; payKey?: string }, returnTo: 'portal' | 'pay') {
  await connectDB();
  const sub: any = where.payKey
    ? await Subscription.findOne({ _id: subId, payKey: where.payKey, status: 'active' }).lean()
    : await Subscription.findOne({ _id: subId, client: where.clientId, status: 'active' }).lean();
  if (!sub) throw new UserFacingError('Subscription not found.');
  const loaded = await siteStateFor(sub._id);
  const now = Date.now();
  const due = (loaded?.periods ?? []).filter((p) => p.remaining > 0.009 && new Date(p.dueDate).getTime() <= now + 7 * DAY);
  const amount = Math.round(due.reduce((t, p) => t + p.remaining, 0) * 100) / 100;
  if (!(amount > 0)) throw new UserFacingError('Nothing is due right now.', 'nothing');
  // a public link must not be usable to flood the gateway with orders
  if ((await PayOrder.countDocuments({ subscription: sub._id, createdAt: { $gte: new Date(now - 10 * 60_000) } })) >= 6) throw new UserFacingError('Too many attempts. Please wait a few minutes.', 'tooMany');
  const user: any = await User.findById(sub.client).lean();
  const orderId = `po_${String(sub._id).slice(-8)}_${now.toString(36)}`;
  await PayOrder.create({ orderId, subscription: sub._id, client: sub.client, currency: sub.currency, amount, periods: due.map((p) => ({ period: p.period, amount: p.remaining })) });
  const returnUrl = returnTo === 'portal' ? `${siteUrl()}/portal?paid=${orderId}` : `${siteUrl()}/pay/${sub.payKey}?order=${orderId}`;
  const o = await cf.createOrder({
    orderId, amount, currency: sub.currency, customerId: String(user._id), name: user.name, email: user.email, phone: cf.phoneFor(user.phone),
    returnUrl, notifyUrl: `${siteUrl()}/api/cashfree/webhook`, note: `${sub.name}`,
  });
  return { sessionId: o.sessionId, env: cf.cashfreeEnv(), amount, currency: sub.currency as string };
}

/** Marks an order paid exactly once and records one payment per month it covered. */
export async function settleOrder(orderId: string, cfPaymentId = '', paidAmount?: number) {
  await connectDB();
  const existing: any = await PayOrder.findOne({ orderId }).lean();
  if (!existing || existing.status !== 'created') return false;
  if (paidAmount !== undefined && paidAmount > 0 && paidAmount < existing.amount - 0.01) {
    await PayOrder.updateOne({ orderId }, { status: 'failed' });
    throw new Error(`Order ${orderId} was paid ${paidAmount} but ${existing.amount} was expected`);
  }
  const po: any = await PayOrder.findOneAndUpdate({ orderId, status: 'created' }, { status: 'paid', paidAt: new Date(), cfPaymentId }, { new: true }).lean();
  if (!po) return false; // another request settled it first
  for (const p of po.periods) {
    await recordGatewayPayment({ subId: po.subscription, period: p.period, amount: p.amount, cfPaymentId: cfPaymentId || orderId, refSuffix: p.period, note: 'Paid online' });
  }
  return true;
}

/** Asks Cashfree whether an order was paid (used when the client returns to us, in case the webhook is slow). */
export async function verifyOrder(orderId: string) {
  const o = await cf.fetchOrder(orderId);
  if (o.paid) await settleOrder(orderId, o.cfPaymentId, o.amount);
  return o.paid;
}

/* ---------------- the daily job ---------------- */

async function once(subId: unknown, key: string) {
  const r = await Subscription.updateOne({ _id: subId, reminders: { $ne: key } }, { $push: { reminders: key } });
  return r.modifiedCount === 1;
}

/**
 * Runs once a day (Vercel Cron). Checks every website-as-a-service plan: retries failed debits, sends the reminders,
 * and makes sure the site status is right even if no webhook arrived.
 */
export async function runDailyJob(now = new Date()) {
  await connectDB();
  const subs: any[] = await Subscription.find({ waas: true, status: 'active' }).lean();
  const out = { checked: subs.length, suspended: 0, retries: 0, reminders: 0, errors: [] as string[] };
  for (const s of subs) {
    try {
      if (s.autopay?.status === 'pending' && cf.cashfreeReady()) await syncAutopay(s._id).catch(() => {});
      const st = await syncSite(s._id, now);
      const loaded = await siteStateFor(s._id, now);
      if (!st || !loaded) continue;
      const { sub, periods, state } = loaded;
      if (state.status === 'suspended') out.suspended++;
      const name = await siteName(sub);
      const pay = { kind: 'pay' as const, url: payLinkFor(sub.payKey) };
      const period = state.overduePeriods[0];
      if (state.lateDays >= 1 && period) {
        const a = sub.autopay ?? {};
        const recentlyRetried = a.lastRetryAt && now.getTime() - new Date(a.lastRetryAt).getTime() < 20 * 3_600_000;
        if (a.status === 'active' && a.lastChargeId && [1, 4].includes(state.lateDays) && (a.retryCount ?? 0) < 4 && !recentlyRetried && cf.cashfreeReady()) {
          await cf
            .retryCharge(a.cfId, a.lastChargeId, new Date(now.getTime() + DAY))
            .then(async () => {
              out.retries++;
              await Subscription.updateOne({ _id: sub._id }, { 'autopay.lastRetryAt': now, $inc: { 'autopay.retryCount': 1 } });
            })
            .catch((e) => out.errors.push(`retry ${String(sub._id)}: ${e.message}`));
        }
        const data = { name, amount: state.amountDue, currency: sub.currency, date: state.suspendOn ? state.suspendOn.toISOString() : null };
        if (state.lateDays >= 3 && state.status === 'grace' && (await once(sub._id, `${period}:late3`))) {
          await logEvent({ client: sub.client, subscription: sub._id, project: sub.project ?? null, type: 'payment_reminder', data, cta: pay });
          out.reminders++;
        }
        if (state.status === 'grace' && state.suspendOn && state.suspendOn.getTime() - now.getTime() <= DAY && (await once(sub._id, `${period}:final`))) {
          await logEvent({ client: sub.client, subscription: sub._id, project: sub.project ?? null, type: 'final_warning', data, cta: pay });
          out.reminders++;
        }
      } else if (sub.autopay?.status !== 'active') {
        const soon = periods.find((p) => p.remaining > 0.009 && new Date(p.dueDate).getTime() > now.getTime() && new Date(p.dueDate).getTime() - now.getTime() <= 3 * DAY);
        if (soon && (await once(sub._id, `${soon.period}:due`))) {
          await logEvent({ client: sub.client, subscription: sub._id, project: sub.project ?? null, type: 'payment_due', data: { name, amount: soon.remaining, currency: sub.currency, date: soon.dueDate }, cta: pay });
          out.reminders++;
        }
      }
    } catch (err) {
      out.errors.push(`${String(s._id)}: ${(err as Error).message}`);
    }
  }
  return out;
}

/** A payment you recorded by hand (bank transfer, cash…): tell the client, and let it restore a suspended site. */
export async function afterAdminPayment(paymentId: unknown) {
  await connectDB();
  const pay: any = await Payment.findById(paymentId).lean();
  if (!pay?.client) return;
  let name = '';
  if (pay.subscription) {
    const sub: any = await Subscription.findById(pay.subscription).lean();
    name = sub ? await siteName(sub) : '';
  } else if (pay.project) {
    const p: any = await Project.findById(pay.project).select('name').lean();
    name = p?.name ?? '';
  }
  await logEvent({
    client: pay.client, subscription: pay.subscription ?? null, project: pay.project ?? null, type: 'payment_received',
    data: { amount: pay.amount, currency: pay.currency, period: pay.period ?? null, name },
  });
  if (pay.subscription) await syncSite(pay.subscription);
}

/** A payment was removed or changed: the site may need to go back to grace or suspension. */
export async function afterPaymentRemoved(subId: unknown) {
  if (subId) await syncSite(subId);
}
