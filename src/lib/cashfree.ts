import crypto from 'node:crypto';
import type { AutopayStatus } from './types';

/**
 * Cashfree Payments client (Subscriptions for autopay mandates, Orders for one-off "Pay now").
 * Written against Cashfree's published API (version 2025-01-01). Docs: https://www.cashfree.com/docs
 *
 * Env: CASHFREE_CLIENT_ID, CASHFREE_CLIENT_SECRET, CASHFREE_ENV (sandbox | production),
 *      optional CASHFREE_WEBHOOK_SECRET (defaults to the client secret), CASHFREE_API_VERSION, CASHFREE_API_BASE.
 */
const VERSION = () => process.env.CASHFREE_API_VERSION || '2025-01-01';
export const cashfreeEnv = (): 'sandbox' | 'production' => (process.env.CASHFREE_ENV === 'production' ? 'production' : 'sandbox');
export const cashfreeReady = () => Boolean(process.env.CASHFREE_CLIENT_ID && process.env.CASHFREE_CLIENT_SECRET);
const base = () => process.env.CASHFREE_API_BASE || (cashfreeEnv() === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg');

export class CashfreeError extends Error {
  constructor(message: string, public status = 0, public code = '') {
    super(message);
  }
}

async function cf<T>(method: 'GET' | 'POST', path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  if (!cashfreeReady()) throw new CashfreeError('Cashfree is not configured. Add CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET.');
  const res = await fetch(`${base()}${path}`, {
    method,
    headers: {
      'x-client-id': process.env.CASHFREE_CLIENT_ID!,
      'x-client-secret': process.env.CASHFREE_CLIENT_SECRET!,
      'x-api-version': VERSION(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  }).catch((err: Error) => {
    throw new CashfreeError(`Couldn’t reach Cashfree (${err.message}).`);
  });
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) throw new CashfreeError(json.message || `Cashfree returned ${res.status}.`, res.status, json.code || json.type || '');
  return json as T;
}

/* ---------------- Autopay mandates (Subscriptions) ---------------- */

export type MandateInput = {
  subscriptionId: string; // ours, must be unique per attempt
  name: string;
  email: string;
  phone: string;
  planName: string;
  currency: string;
  amount: number;
  firstChargeAt: Date;
  returnUrl: string;
};

/** UPI and eNACH only exist in India (INR); overseas customers authorise by card. */
export const mandateMethods = (currency: string) => (currency === 'INR' ? ['upi', 'enach', 'card'] : ['card']);

export async function createMandate(i: MandateInput) {
  const amount = Math.round(i.amount * 100) / 100;
  const r = await cf<{ subscription_session_id: string; cf_subscription_id: string; subscription_status: string; next_schedule_date?: string }>(
    'POST',
    '/subscriptions',
    {
      subscription_id: i.subscriptionId,
      customer_details: { customer_name: i.name.slice(0, 100), customer_email: i.email, customer_phone: i.phone },
      plan_details: {
        plan_name: i.planName.slice(0, 40),
        plan_type: 'PERIODIC',
        plan_currency: i.currency,
        plan_amount: amount,
        plan_max_amount: amount,
        plan_max_cycles: 120,
        plan_intervals: 1,
        plan_interval_type: 'MONTH',
      },
      authorization_details: { authorization_amount: 1, authorization_amount_refund: true, payment_methods: mandateMethods(i.currency) },
      subscription_meta: { return_url: i.returnUrl, notification_channel: ['EMAIL', 'SMS'] },
      subscription_expiry_time: new Date(Date.now() + 10 * 365 * 86_400_000).toISOString(),
      subscription_first_charge_time: i.firstChargeAt.toISOString(),
    },
    i.subscriptionId,
  );
  return { sessionId: r.subscription_session_id, cfSubscriptionId: r.cf_subscription_id, status: r.subscription_status };
}

export async function fetchMandate(subscriptionId: string) {
  const r = await cf<any>('GET', `/subscriptions/${encodeURIComponent(subscriptionId)}`);
  return {
    status: String(r.subscription_status ?? ''),
    cfSubscriptionId: String(r.cf_subscription_id ?? ''),
    nextScheduleDate: r.next_schedule_date ? new Date(r.next_schedule_date) : null,
    method: String(r.authorisation_details?.payment_method ?? r.authorisation_details?.authorization_method ?? '').toLowerCase(),
  };
}

export async function manageMandate(subscriptionId: string, action: 'CANCEL' | 'PAUSE' | 'ACTIVATE') {
  return cf<any>('POST', `/subscriptions/${encodeURIComponent(subscriptionId)}/manage`, { subscription_id: subscriptionId, action });
}

/** Retries a failed charge. Cashfree wants the date it should run on. */
export async function retryCharge(subscriptionId: string, paymentId: string, runAt: Date) {
  return cf<any>('POST', `/subscriptions/${encodeURIComponent(subscriptionId)}/payments/${encodeURIComponent(paymentId)}/manage`, {
    subscription_id: subscriptionId,
    payment_id: paymentId,
    action: 'RETRY',
    action_details: { next_scheduled_time: runAt.toISOString() },
  });
}

/** Cashfree's mandate states, folded into the few we show. */
export function mapMandateStatus(cfStatus: string): AutopayStatus {
  switch (cfStatus.toUpperCase()) {
    case 'ACTIVE':
      return 'active';
    case 'INITIALIZED':
    case 'BANK_APPROVAL_PENDING':
      return 'pending';
    case 'ON_HOLD':
      return 'failed';
    case 'CUSTOMER_PAUSED':
    case 'PAUSED':
      return 'paused';
    case 'CANCELLED':
    case 'CUSTOMER_CANCELLED':
    case 'COMPLETED':
    case 'EXPIRED':
      return 'cancelled';
    case 'LINK_EXPIRED':
      return 'none'; // never authorised, so they can simply start again
    default:
      return 'pending';
  }
}

/* ---------------- One-off payments (Orders) ---------------- */

export type OrderInput = {
  orderId: string;
  amount: number;
  currency: string;
  customerId: string;
  name: string;
  email: string;
  phone: string;
  returnUrl: string;
  notifyUrl: string;
  note: string;
};

export async function createOrder(i: OrderInput) {
  const r = await cf<{ payment_session_id: string; order_status: string; cf_order_id: string | number }>('POST', '/orders', {
    order_id: i.orderId,
    order_amount: Math.round(i.amount * 100) / 100,
    order_currency: i.currency,
    customer_details: { customer_id: i.customerId, customer_name: i.name.slice(0, 100), customer_email: i.email, customer_phone: i.phone },
    order_meta: { return_url: i.returnUrl, notify_url: i.notifyUrl },
    order_note: i.note.slice(0, 200),
  });
  return { sessionId: r.payment_session_id, status: r.order_status };
}

export async function fetchOrder(orderId: string) {
  const o = await cf<any>('GET', `/orders/${encodeURIComponent(orderId)}`);
  let cfPaymentId = '';
  if (String(o.order_status).toUpperCase() === 'PAID') {
    try {
      const pays = await cf<any[]>('GET', `/orders/${encodeURIComponent(orderId)}/payments`);
      cfPaymentId = String(pays.find((p) => String(p.payment_status).toUpperCase() === 'SUCCESS')?.cf_payment_id ?? '');
    } catch {
      /* the order being PAID is what matters */
    }
  }
  return { paid: String(o.order_status).toUpperCase() === 'PAID', status: String(o.order_status ?? ''), amount: Number(o.order_amount ?? 0), cfPaymentId };
}

/** The phone number Cashfree insists on. Use the client's, else a configurable placeholder. */
export const phoneFor = (phone?: string) => {
  const digits = (phone ?? '').replace(/[^\d]/g, '');
  return digits.length >= 8 ? digits.slice(-15) : process.env.CASHFREE_FALLBACK_PHONE || '9999999999';
};

/* ---------------- Webhooks ---------------- */

/** Cashfree signs `timestamp + rawBody` with HMAC-SHA256 and sends it base64 in x-webhook-signature. */
export function verifyWebhook(rawBody: string, signature: string | null, timestamp: string | null) {
  const secret = process.env.CASHFREE_WEBHOOK_SECRET || process.env.CASHFREE_CLIENT_SECRET;
  if (!secret || !signature || !timestamp) return false;
  const expected = crypto.createHmac('sha256', secret).update(timestamp + rawBody).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export type GatewayEvent =
  | { kind: 'mandate_status'; subscriptionId: string; cfSubscriptionId: string; status: string; dedupe: string; type: string }
  | { kind: 'charge_success'; paymentType: string; subscriptionId: string; cfPaymentId: string; paymentId: string; amount: number; currency: string; scheduledAt: Date | null; dedupe: string; type: string }
  | { kind: 'charge_failed'; paymentType: string; subscriptionId: string; cfPaymentId: string; paymentId: string; amount: number; reason: string; scheduledAt: Date | null; dedupe: string; type: string }
  | { kind: 'order_paid'; orderId: string; cfPaymentId: string; amount: number; dedupe: string; type: string }
  | { kind: 'order_failed'; orderId: string; dedupe: string; type: string }
  | { kind: 'ignored'; dedupe: string; type: string };

/** Turns Cashfree's payload (old and new event names) into one of a few events we act on. */
export function parseWebhook(body: any): GatewayEvent {
  const type = String(body?.type ?? '');
  const d = body?.data ?? {};
  const T = type.toUpperCase();
  const date = (v: unknown) => (v ? new Date(String(v)) : null);

  if (T === 'PAYMENT_SUCCESS_WEBHOOK' || T === 'PAYMENT_FAILED_WEBHOOK' || T === 'PAYMENT_USER_DROPPED_WEBHOOK') {
    const orderId = String(d.order?.order_id ?? '');
    const cfPaymentId = String(d.payment?.cf_payment_id ?? '');
    if (T === 'PAYMENT_SUCCESS_WEBHOOK') return { kind: 'order_paid', orderId, cfPaymentId, amount: Number(d.payment?.payment_amount ?? d.order?.order_amount ?? 0), dedupe: `order:${orderId}:${cfPaymentId}:paid`, type };
    return { kind: 'order_failed', orderId, dedupe: `order:${orderId}:${cfPaymentId}:${T}`, type };
  }

  const subId = String(d.subscription_details?.subscription_id ?? d.subscription_id ?? '');
  if (T === 'SUBSCRIPTION_STATUS_CHANGED' || T === 'SUBSCRIPTION_STATUS_CHANGE' || T === 'SUBSCRIPTION_AUTH_STATUS') {
    const sd = d.subscription_details ?? d;
    const status = String(sd.subscription_status ?? d.authorization_details?.authorization_status ?? '');
    return { kind: 'mandate_status', subscriptionId: subId, cfSubscriptionId: String(sd.cf_subscription_id ?? ''), status, dedupe: `sub:${subId}:${T}:${status}:${body.event_time ?? ''}`, type };
  }
  if (T === 'SUBSCRIPTION_PAYMENT_SUCCESS' || T === 'SUBSCRIPTION_NEW_PAYMENT') {
    const cfPaymentId = String(d.cf_payment_id ?? d.cf_txn_id ?? '');
    return {
      kind: 'charge_success', paymentType: String(d.payment_type ?? ''), subscriptionId: subId, cfPaymentId, paymentId: String(d.payment_id ?? ''),
      amount: Number(d.payment_amount ?? d.amount ?? 0), currency: String(d.payment_currency ?? d.currency ?? ''),
      scheduledAt: date(d.payment_schedule_date), dedupe: `charge:${subId}:${cfPaymentId || d.payment_id}:ok`, type,
    };
  }
  if (T === 'SUBSCRIPTION_PAYMENT_FAILED' || T === 'SUBSCRIPTION_PAYMENT_DECLINED') {
    const cfPaymentId = String(d.cf_payment_id ?? d.cf_txn_id ?? '');
    return {
      kind: 'charge_failed', paymentType: String(d.payment_type ?? ''), subscriptionId: subId, cfPaymentId, paymentId: String(d.payment_id ?? ''),
      amount: Number(d.payment_amount ?? d.amount ?? 0), reason: String(d.failureDetails?.failureReason ?? d.failure_details?.failure_reason ?? d.payment_remarks ?? 'The bank declined the payment'),
      scheduledAt: date(d.payment_schedule_date), dedupe: `charge:${subId}:${cfPaymentId || d.payment_id}:fail:${d.retry_attempts ?? 0}`, type,
    };
  }
  return { kind: 'ignored', dedupe: `ignored:${type}:${body?.event_time ?? crypto.randomUUID()}`, type };
}
