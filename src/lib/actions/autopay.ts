'use server';

import { isValidObjectId } from 'mongoose';
import { revalidatePath } from 'next/cache';
import { requireClient } from '../auth';
import { connectDB } from '../db';
import { ClientEvent } from '../models/ClientEvent';
import { Subscription } from '../models/Subscription';
import { cashfreeReady } from '../cashfree';
import { createOverdueOrder, startAutopay, UserFacingError } from '../waas';

export type CheckoutResult = { ok: true; sessionId: string; env: string } | { ok: false; error: string; code?: string };

const fail = (err: unknown): CheckoutResult => {
  if (err instanceof UserFacingError) return { ok: false, error: err.message, code: err.code };
  console.error('[checkout]', (err as Error).message);
  return { ok: false, error: 'We couldn’t start the payment.', code: 'failed' };
};

/** A client sets up (or changes) autopay for their own plan. Needs a phone number on file. */
export async function startAutopayAction(subId: string, phone?: string): Promise<CheckoutResult> {
  const session = await requireClient();
  if (!isValidObjectId(subId)) return fail(new UserFacingError('Subscription not found.'));
  if (!cashfreeReady()) return { ok: false, error: 'Online payments aren’t switched on yet.', code: 'off' };
  try {
    const r = await startAutopay(subId, session.sub, phone);
    return { ok: true, ...r };
  } catch (err) {
    return fail(err);
  }
}

/** A signed-in client pays everything that's due. */
export async function payNowAction(subId: string): Promise<CheckoutResult> {
  const session = await requireClient();
  if (!isValidObjectId(subId)) return fail(new UserFacingError('Subscription not found.'));
  if (!cashfreeReady()) return { ok: false, error: 'Online payments aren’t switched on yet.', code: 'off' };
  try {
    const r = await createOverdueOrder(subId, { clientId: session.sub }, 'portal');
    return { ok: true, sessionId: r.sessionId, env: r.env };
  } catch (err) {
    return fail(err);
  }
}

/** The public pay-to-restore page: no login, just the private link from the suspended-site page or an email. */
export async function payByKeyAction(payKey: string): Promise<CheckoutResult> {
  if (!/^[\w-]{20,40}$/.test(payKey)) return fail(new UserFacingError('This payment link isn’t valid.'));
  if (!cashfreeReady()) return { ok: false, error: 'Online payments aren’t switched on yet.', code: 'off' };
  try {
    await connectDB();
    const sub: any = await Subscription.findOne({ payKey, status: 'active' }).select('_id').lean();
    if (!sub) return fail(new UserFacingError('This payment link isn’t valid.'));
    const r = await createOverdueOrder(sub._id, { payKey }, 'pay');
    return { ok: true, sessionId: r.sessionId, env: r.env };
  } catch (err) {
    return fail(err);
  }
}

/** The client has seen their updates. */
export async function markEventsRead(): Promise<void> {
  const session = await requireClient();
  await connectDB();
  await ClientEvent.updateMany({ client: session.sub, readAt: null }, { readAt: new Date() });
  revalidatePath('/portal');
}
