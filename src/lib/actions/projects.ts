'use server';

import { isValidObjectId } from 'mongoose';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '../auth';
import { connectDB } from '../db';
import { CURRENCIES } from '../currency';
import { Project } from '../models/Project';
import { Payment } from '../models/Payment';
import { User } from '../models/User';
import { PROJECT_STATUSES, PROJECT_TR_FIELDS, type ActionResult } from '../types';
import { syncTranslations, TARGETS, type Target } from '../translate';

const url = z
  .string()
  .trim()
  .default('')
  .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Links must start with http:// or https://');

const schema = z.object({
  name: z.string().trim().min(2, 'Project name needs at least 2 characters.'),
  clientId: z.string().default(''),
  summary: z.string().trim().max(2000).default(''),
  stack: z
    .string()
    .default('')
    .transform((s) => [...new Set(s.split(',').map((t) => t.trim()).filter(Boolean))]),
  liveUrl: url,
  previewUrl: url,
  repoUrl: url,
  coverImage: url,
  gallery: z
    .string()
    .default('')
    .transform((s) => s.split(/\n|,/).map((t) => t.trim()).filter(Boolean))
    .refine((list) => list.length <= 4, 'Add up to 4 gallery images.')
    .refine((list) => list.every((u) => /^https?:\/\/\S+$/i.test(u)), 'Gallery links must start with http:// or https://'),
  outcome: z.string().trim().max(200, 'Keep the outcome under 200 characters.').default(''),
  testimonialQuote: z.string().trim().max(600).default(''),
  testimonialAuthor: z.string().trim().max(80).default(''),
  testimonialRole: z.string().trim().max(80).default(''),
  status: z.enum(PROJECT_STATUSES),
  totalCost: z.coerce.number({ invalid_type_error: 'Total cost must be a number.' }).min(0, 'Total cost cannot be negative.'),
  currency: z.enum(CURRENCIES),
  startDate: z.coerce.date({ invalid_type_error: 'Pick a start date.' }),
  deliveredAt: z
    .string()
    .default('')
    .transform((v) => (v ? new Date(v) : null)),
  sortOrder: z.coerce.number().int().default(0),
  showInPortfolio: z
    .string()
    .optional()
    .transform((v) => v === 'on'),
});

const fail = (error: string): ActionResult => ({ ok: false, error });

/** Translates the project's description fields; hand edits from the dialog's Translations section win. */
async function translateProject(
  fd: FormData,
  data: { summary: string; outcome: string; testimonial: { quote: string; role: string } },
  prev?: { translations?: Record<string, Record<string, string>>; trSource?: Record<string, string> } | null,
) {
  const manual: Partial<Record<Target, Record<string, string>>> = {};
  for (const l of TARGETS) {
    manual[l] = {};
    for (const f of PROJECT_TR_FIELDS) {
      const v = fd.get(`tr_${l}_${f}`);
      if (v !== null) manual[l]![f] = String(v).slice(0, 2000);
    }
  }
  return syncTranslations({
    english: { summary: data.summary, outcome: data.outcome, quote: data.testimonial.quote, role: data.testimonial.role },
    previousSource: prev?.trSource ?? {},
    current: prev?.translations ?? {},
    manual,
  });
}

async function parse(fd: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message } as const;
  const { clientId, testimonialQuote, testimonialAuthor, testimonialRole, ...data } = parsed.data;
  let client = null;
  if (clientId) {
    if (!isValidObjectId(clientId) || !(await User.exists({ _id: clientId, role: 'client' })))
      return { error: 'Choose a valid client.' } as const;
    client = clientId;
  }
  return {
    data: { ...data, client, testimonial: { quote: testimonialQuote, author: testimonialAuthor, role: testimonialRole } },
  } as const;
}

export async function createProject(fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  await connectDB();
  const r = await parse(fd);
  if ('error' in r) return fail(r.error!);
  const tr = await translateProject(fd, r.data);
  await Project.create({ ...r.data, translations: tr.translations, trSource: tr.source });
  revalidatePath('/', 'layout');
  return { ok: true, message: tr.error ? `Project created, but automatic translation failed: ${tr.error}` : 'Project created.' };
}

export async function updateProject(id: string, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(id)) return fail('Project not found.');
  await connectDB();
  const r = await parse(fd);
  if ('error' in r) return fail(r.error!);
  const existing = await Project.findById(id).lean();
  if (!existing) return fail('Project not found.');
  // Payments are snapshotted into the project currency; changing it would corrupt the ledger.
  if (existing.currency !== r.data.currency && (await Payment.exists({ project: id })))
    return fail('This project already has payments, so its currency is locked.');
  const tr = await translateProject(fd, r.data, existing as never);
  await Project.updateOne({ _id: id }, { ...r.data, translations: tr.translations, trSource: tr.source });
  if (String(existing.client ?? '') !== String(r.data.client ?? ''))
    await Payment.updateMany({ project: id }, { client: r.data.client });
  revalidatePath('/', 'layout');
  return { ok: true, message: tr.error ? `Project updated, but automatic translation failed: ${tr.error}` : 'Project updated.' };
}

export async function deleteProject(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(id)) return fail('Project not found.');
  await connectDB();
  const { deletedCount } = await Payment.deleteMany({ project: id });
  await Project.deleteOne({ _id: id });
  revalidatePath('/', 'layout');
  return { ok: true, message: deletedCount ? `Project and ${deletedCount} payment(s) deleted.` : 'Project deleted.' };
}
