'use server';

import { isValidObjectId } from 'mongoose';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '../auth';
import { CURRENCIES } from '../currency';
import { connectDB } from '../db';
import { Plan } from '../models/Plan';
import { Subscription } from '../models/Subscription';
import { syncTranslations } from '../translate';
import type { ActionResult } from '../types';

const schema = z.object({
  name: z.string().trim().min(2, 'Give the plan a name.').max(40, 'Plan names are limited to 40 characters.'),
  description: z.string().trim().max(400).default(''),
  features: z.string().default(''),
  graceDays: z.coerce.number().int().min(0).max(60).default(7),
  active: z.string().optional(),
});
const fail = (error: string): ActionResult => ({ ok: false, error });

function readPrices(fd: FormData) {
  const prices: Record<string, number> = {};
  for (const c of CURRENCIES) {
    const raw = String(fd.get(`price_${c}`) ?? '').trim();
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0 || n > 10_000_000) return { error: `${c} price must be a positive number.` } as const;
    prices[c] = Math.round(n * 100) / 100;
  }
  if (!Object.keys(prices).length) return { error: 'Set a monthly price in at least one currency.' } as const;
  return { prices } as const;
}

async function build(fd: FormData, prev?: { trSource?: Record<string, string>; translations?: Record<string, Record<string, string>> }) {
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0]!.message } as const;
  const pr = readPrices(fd);
  if ('error' in pr) return { error: String(pr.error) } as const;
  const features = p.data.features.split(/\r?\n/).map((f) => f.trim()).filter(Boolean).slice(0, 12);
  const tr = await syncTranslations({
    english: { description: p.data.description, features: features.join('\n') },
    previousSource: prev?.trSource ?? {},
    current: prev?.translations ?? {},
  });
  return {
    data: { name: p.data.name, description: p.data.description, features, prices: pr.prices, graceDays: p.data.graceDays, active: p.data.active === 'on', translations: tr.translations, trSource: tr.source },
    translateError: tr.error,
  } as const;
}

export async function createPlan(fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  await connectDB();
  const b = await build(fd);
  if ('error' in b) return fail(String(b.error));
  await Plan.create({ ...b.data, sortOrder: await Plan.countDocuments() });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: b.translateError ? `Plan created, but automatic translation failed: ${b.translateError}` : 'Plan created.' };
}

export async function updatePlan(id: string, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(id)) return fail('Plan not found.');
  await connectDB();
  const existing: any = await Plan.findById(id).lean();
  if (!existing) return fail('Plan not found.');
  const b = await build(fd, existing);
  if ('error' in b) return fail(String(b.error));
  await Plan.updateOne({ _id: id }, b.data);
  revalidatePath('/admin', 'layout');
  revalidatePath('/portal');
  return { ok: true, message: 'Plan updated. Existing subscriptions keep the price they were set up with.' };
}

export async function deletePlan(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(id)) return fail('Plan not found.');
  await connectDB();
  if (await Subscription.exists({ plan: id })) return fail('Clients are on this plan. Switch it off instead, so it stops being offered but their history stays intact.');
  await Plan.deleteOne({ _id: id });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: 'Plan deleted.' };
}
