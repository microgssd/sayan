'use server';

import bcrypt from 'bcryptjs';
import { isValidObjectId } from 'mongoose';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '../auth';
import { connectDB } from '../db';
import { CURRENCIES } from '../currency';
import { User } from '../models/User';
import { Project } from '../models/Project';
import type { ActionResult } from '../types';

const base = z.object({
  name: z.string().trim().min(2, 'Client name needs at least 2 characters.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  company: z.string().trim().max(120).default(''),
  phone: z.string().trim().max(40).default(''),
  preferredCurrency: z.enum(CURRENCIES).default('USD'),
  notes: z.string().trim().max(2000).default(''),
});
const password = z.string().min(8, 'Password must be at least 8 characters.');

const fail = (error: string): ActionResult => ({ ok: false, error });

export async function createClient(fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = base.extend({ password }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(parsed.error.issues[0]!.message);
  await connectDB();
  if (await User.exists({ email: parsed.data.email })) return fail('An account with that email already exists.');
  const { password: pw, ...rest } = parsed.data;
  await User.create({ ...rest, role: 'client', passwordHash: await bcrypt.hash(pw, 12) });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: `${rest.name} added. Share their email and password so they can log in.` };
}

export async function updateClient(id: string, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(id)) return fail('Client not found.');
  const parsed = base.extend({ password: password.or(z.literal('')).default('') }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(parsed.error.issues[0]!.message);
  await connectDB();
  const { password: pw, ...rest } = parsed.data;
  if (await User.exists({ email: rest.email, _id: { $ne: id } })) return fail('Another account already uses that email.');
  const update: Record<string, unknown> = { ...rest };
  if (pw) update.passwordHash = await bcrypt.hash(pw, 12);
  const res = await User.updateOne({ _id: id, role: 'client' }, update);
  if (!res.matchedCount) return fail('Client not found.');
  revalidatePath('/admin', 'layout');
  return { ok: true, message: pw ? 'Client updated and password reset.' : 'Client updated.' };
}

export async function setClientActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(id)) return fail('Client not found.');
  await connectDB();
  await User.updateOne({ _id: id, role: 'client' }, { active });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: active ? 'Portal access restored.' : 'Portal access paused.' };
}

export async function deleteClient(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(id)) return fail('Client not found.');
  await connectDB();
  const count = await Project.countDocuments({ client: id });
  if (count) return fail(`This client still has ${count} project${count > 1 ? 's' : ''}. Reassign or delete them first.`);
  await User.deleteOne({ _id: id, role: 'client' });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: 'Client deleted.' };
}
