'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '../auth';
import { connectDB } from '../db';
import { Settings } from '../models/Settings';
import { User } from '../models/User';
import { NUMBER_KEYS, TRANSLATABLE_FIELDS, type ActionResult } from '../types';
import { syncTranslations, TARGETS, type Target } from '../translate';
import { isKawaii } from '@/components/kawaii';

const url = z
  .string()
  .trim()
  .default('')
  .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Links must start with http:// or https://');

const schema = z.object({
  name: z.string().trim().min(1, 'Add your name.'),
  headline: z.string().trim().max(240).default(''),
  heroTitle: z.string().trim().max(160, 'Keep the hero sentence under 160 characters.').default(''),
  bio: z.string().trim().max(1200).default(''),
  photoUrl: url,
  location: z.string().trim().max(80).default(''),
  timezone: z
    .string()
    .trim()
    .default('Asia/Kolkata')
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'Use a time zone like Asia/Kolkata or America/Toronto.'),
  email: z.string().trim().email('Enter a valid contact email.'),
  availability: z.string().trim().max(120).default(''),
  resumeUrl: url,
  github: url,
  linkedin: url,
  x: url,
  website: url,
  stacks: z.string().default(''),
  heroPill1: z.string().default('rocket'),
  heroPill2: z.string().default('bag'),
  heroPill3: z.string().default('robot'),
  galleryImages: z
    .string()
    .default('')
    .transform((s) => s.split(/\r?\n|,/).map((t) => t.trim()).filter(Boolean))
    .refine((l) => l.length <= 40, 'Add up to 40 gallery images.')
    .refine((l) => l.every((u) => /^https?:\/\/\S+$/i.test(u)), 'Gallery image links must start with http:// or https://'),
});

/** "Frontend: React, Next.js" per line → [{ category, items }] */
function parseStacks(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [category, rest = ''] = line.split(/:(.*)/s);
      return { category: category!.trim(), items: rest.split(',').map((s) => s.trim()).filter(Boolean) };
    })
    .filter((g) => g.category && g.items.length);
}

export async function updateSettings(fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const { github, linkedin, x, website, stacks, heroPill1, heroPill2, heroPill3, ...rest } = parsed.data;
  const heroPills = [heroPill1, heroPill2, heroPill3].map((p, i) => (isKawaii(p) ? p : ['rocket', 'bag', 'robot'][i]!));
  const parsedStacks = parseStacks(stacks);
  // Numbers: blank value = automatic count, blank label = default wording.
  const numbers: Record<string, { value: number | null; label: string; suffix: string }> = {};
  for (const k of NUMBER_KEYS) {
    const raw = String(fd.get(`num_${k}_value`) ?? '').trim();
    const n = raw === '' ? null : Number(raw);
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > 1_000_000)) return { ok: false, error: 'Numbers must be between 0 and 1,000,000.' };
    numbers[k] = {
      value: n === null ? null : Math.round(n),
      label: String(fd.get(`num_${k}_label`) ?? '').trim().slice(0, 40),
      suffix: String(fd.get(`num_${k}_suffix`) ?? (k.startsWith('hero') ? '' : '+')).trim().slice(0, 3),
    };
  }
  await connectDB();
  const existing: { translations?: Record<string, Record<string, string>>; trSource?: Record<string, string> } | null = await Settings.findOne({ key: 'site' }).lean();
  // English source for every translatable bit, including your stack category names.
  const english: Record<string, string> = Object.fromEntries(TRANSLATABLE_FIELDS.map((f) => [f, rest[f] ?? '']));
  for (const g of parsedStacks) english[`cat:${g.category}`] = g.category;
  for (const k of NUMBER_KEYS) if (numbers[k]!.label) english[`stat:${k}`] = numbers[k]!.label;
  // Hand-edited translations from the Translations tab (tr_fr_heroTitle, …).
  const manual: Partial<Record<Target, Record<string, string>>> = {};
  for (const l of TARGETS) {
    manual[l] = {};
    for (const f of TRANSLATABLE_FIELDS) {
      const v = fd.get(`tr_${l}_${f}`);
      if (v !== null) manual[l]![f] = String(v).slice(0, f === 'bio' ? 1200 : 300);
    }
  }
  const { translations, source, error } = await syncTranslations({
    english,
    previousSource: existing?.trSource ?? {},
    current: existing?.translations ?? {},
    manual,
  });
  await Settings.updateOne(
    { key: 'site' },
    { ...rest, heroPills, numbers, socials: { github, linkedin, x, website }, stacks: parsedStacks, translations, trSource: source },
    { upsert: true },
  );
  revalidatePath('/', 'layout');
  return { ok: true, message: error ? `Saved, but automatic translation failed: ${error}` : 'Site settings saved.' };
}

export async function changeAdminPassword(fd: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const current = String(fd.get('current') ?? '');
  const next = String(fd.get('next') ?? '');
  if (next.length < 10) return { ok: false, error: 'New password must be at least 10 characters.' };
  await connectDB();
  const admin = await User.findById(session.sub).select('+passwordHash');
  if (!admin || !(await bcrypt.compare(current, admin.passwordHash)))
    return { ok: false, error: 'Current password is incorrect.' };
  admin.passwordHash = await bcrypt.hash(next, 12);
  await admin.save();
  return { ok: true, message: 'Password changed.' };
}
