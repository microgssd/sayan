'use server';

import { isValidObjectId } from 'mongoose';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '../auth';
import { connectDB } from '../db';
import { retryCharge, cashfreeReady } from '../cashfree';
import { logEvent } from '../events';
import { ClientEvent } from '../models/ClientEvent';
import { Subscription } from '../models/Subscription';
import { User } from '../models/User';
import { translateTexts, translationProvider, TARGETS } from '../translate';
import type { ActionResult } from '../types';
import { cancelAutopay, siteStateFor, syncSite } from '../waas';

const DAY = 86_400_000;
const fail = (error: string): ActionResult => ({ ok: false, error });
const refresh = () => {
  revalidatePath('/admin', 'layout');
  revalidatePath('/portal');
};

/** Takes a client's website offline by hand (or lifts that). It holds until you change it. */
export async function suspendSite(subId: string, suspend: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(subId)) return fail('Subscription not found.');
  await connectDB();
  await Subscription.updateOne({ _id: subId }, { siteOverride: suspend ? 'suspend' : 'none' });
  await syncSite(subId);
  refresh();
  return { ok: true, message: suspend ? 'Website suspended. It shows the "temporarily unavailable" page within a minute.' : 'Manual suspension lifted.' };
}

/** More time to pay: moves the suspension date back (and brings a suspended site back online while it runs). */
export async function extendGrace(subId: string, days: number): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(subId) || !Number.isInteger(days) || days < 1 || days > 60) return fail('Choose 1 to 60 days.');
  await connectDB();
  const loaded = await siteStateFor(subId);
  if (!loaded) return fail('Subscription not found.');
  if (!loaded.state.dueAt && loaded.sub.siteOverride !== 'suspend') return fail('Nothing is overdue, so there is nothing to extend.');
  const from = Math.max(Date.now(), loaded.state.suspendOn?.getTime() ?? 0);
  await Subscription.updateOne({ _id: subId }, { graceUntil: new Date(from + days * DAY), siteOverride: 'none' });
  await syncSite(subId);
  refresh();
  return { ok: true, message: `Grace extended by ${days} day${days === 1 ? '' : 's'}.` };
}

/** Asks the bank to try the last failed debit again. */
export async function retryAutopayNow(subId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(subId)) return fail('Subscription not found.');
  if (!cashfreeReady()) return fail('Cashfree isn’t configured yet.');
  await connectDB();
  const sub: any = await Subscription.findById(subId).lean();
  const a = sub?.autopay;
  if (!a?.cfId || a.status !== 'active') return fail('Autopay isn’t active for this subscription.');
  if (!a.lastChargeId) return fail('There is no failed payment to retry.');
  try {
    await retryCharge(a.cfId, a.lastChargeId, new Date(Date.now() + DAY));
  } catch (err) {
    return fail(`Cashfree said: ${(err as Error).message}`);
  }
  await Subscription.updateOne({ _id: subId }, { $inc: { 'autopay.retryCount': 1 } });
  refresh();
  return { ok: true, message: 'Retry requested. The result arrives within a day.' };
}

export async function cancelAutopayAdmin(subId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(subId)) return fail('Subscription not found.');
  try {
    const done = await cancelAutopay(subId);
    if (!done) return fail('There is no active autopay to cancel.');
  } catch (err) {
    return fail(`Cashfree said: ${(err as Error).message}`);
  }
  refresh();
  return { ok: true, message: 'Autopay cancelled. The client can set it up again from their portal.' };
}

const noteSchema = z.object({ title: z.string().trim().min(2, 'Write a short title.').max(120), body: z.string().trim().max(1000).default(''), email: z.string().optional() });

/** Posts your own message to a client's Updates feed (translated automatically when a translator is set up). */
export async function postUpdate(clientId: string, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(clientId)) return fail('Client not found.');
  const p = noteSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0]!.message);
  await connectDB();
  if (!(await User.exists({ _id: clientId, role: 'client' }))) return fail('Client not found.');
  const translations: Record<string, { title: string; body: string }> = {};
  if (translationProvider()) {
    for (const l of TARGETS) {
      try {
        const [title, body] = await translateTexts([p.data.title, p.data.body], l);
        translations[l] = { title: title ?? '', body: body ?? '' };
      } catch {
        break; // the English still goes out
      }
    }
  }
  await logEvent({ client: clientId, type: 'note', by: 'admin', title: p.data.title, body: p.data.body, translations, email: p.data.email === 'on' });
  refresh();
  return { ok: true, message: p.data.email === 'on' ? 'Update posted and emailed.' : 'Update posted.' };
}

export async function deleteUpdate(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(id)) return fail('Update not found.');
  await connectDB();
  await ClientEvent.deleteOne({ _id: id });
  refresh();
  return { ok: true, message: 'Update removed.' };
}
