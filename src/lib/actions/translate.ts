'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../auth';
import { connectDB } from '../db';
import { Project } from '../models/Project';
import { Settings } from '../models/Settings';
import { Subscription } from '../models/Subscription';
import { syncTranslations, translationProvider } from '../translate';
import { TRANSLATABLE_FIELDS, type ActionResult } from '../types';

type Doc = { _id: unknown; translations?: Record<string, Record<string, string>>; trSource?: Record<string, string> };

/** Fills in every missing or outdated translation: site text, all projects and subscription descriptions. */
export async function translateEverything(): Promise<ActionResult> {
  await requireAdmin();
  if (!translationProvider()) return { ok: false, error: 'Add DEEPL_API_KEY (free at deepl.com/pro-api) or ANTHROPIC_API_KEY to turn on automatic translation.' };
  await connectDB();
  const errors: string[] = [];

  const s = (await Settings.findOne({ key: 'site' }).lean()) as (Doc & Record<string, unknown>) | null;
  if (s) {
    const english: Record<string, string> = Object.fromEntries(TRANSLATABLE_FIELDS.map((f) => [f, String(s[f] ?? '')]));
    for (const g of (s.stacks as { category: string }[] | undefined) ?? []) english[`cat:${g.category}`] = g.category;
    const r = await syncTranslations({ english, previousSource: s.trSource ?? {}, current: s.translations ?? {} });
    if (r.error) errors.push(r.error);
    await Settings.updateOne({ key: 'site' }, { translations: r.translations, trSource: r.source });
  }

  const projects = (await Project.find().lean()) as unknown as (Doc & { summary?: string; outcome?: string; testimonial?: { quote?: string; role?: string } })[];
  for (const p of projects) {
    const r = await syncTranslations({
      english: { summary: p.summary ?? '', outcome: p.outcome ?? '', quote: p.testimonial?.quote ?? '', role: p.testimonial?.role ?? '' },
      previousSource: p.trSource ?? {},
      current: p.translations ?? {},
    });
    if (r.error) errors.push(r.error);
    await Project.updateOne({ _id: p._id }, { translations: r.translations, trSource: r.source });
  }

  const subs = (await Subscription.find().lean()) as unknown as (Doc & { description?: string })[];
  for (const sub of subs) {
    const r = await syncTranslations({ english: { description: sub.description ?? '' }, previousSource: sub.trSource ?? {}, current: sub.translations ?? {} });
    if (r.error) errors.push(r.error);
    await Subscription.updateOne({ _id: sub._id }, { translations: r.translations, trSource: r.source });
  }

  revalidatePath('/', 'layout');
  if (errors.length) return { ok: false, error: `Some translations failed: ${[...new Set(errors)][0]}` };
  return { ok: true, message: `Translated your site text, ${projects.length} project(s) and ${subs.length} subscription(s) into French, German and Spanish.` };
}
