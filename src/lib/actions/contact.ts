'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { connectDB } from '../db';
import { geoFromHeaders } from '../geo';
import { Message } from '../models/Message';


const schema = z
  .object({
    name: z.string().trim().min(2, 'Add your name.').max(80),
    email: z.string().trim().toLowerCase().email('That email doesn’t look right.'),
    company: z.string().trim().max(120).default(''),
    projectTypes: z.array(z.string().max(40)).max(8).default([]),
    budget: z.string().max(40).default(''),
    details: z.string().trim().max(3000, 'Keep it under 3,000 characters.').default(''),
    website: z.string().max(0).optional(), // honeypot: real people never fill this in
    startedAt: z.coerce.number(),
  })
  .refine((d) => d.projectTypes.length > 0 || d.details.length >= 10, {
    message: 'Pick what you need, or tell me a little about the project.',
    path: ['projectTypes'],
  });

export type ContactCode = 'name' | 'email' | 'need' | 'long' | 'tooMany' | 'failed';
export type ContactResult = { ok: true } | { ok: false; error: string; field?: string; code?: ContactCode };

const hits = new Map<string, number[]>();

export async function submitContact(input: unknown): Promise<ContactResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    // Silently accept bots (filled honeypot) so they don't retry.
    if (issue.path[0] === 'website') return { ok: true };
    const field = String(issue.path[0] ?? '');
    const code: ContactCode = field === 'name' ? 'name' : field === 'email' ? 'email' : field === 'details' ? 'long' : 'need';
    return { ok: false, error: issue.message, field, code };
  }
  const d = parsed.data;
  if (Date.now() - d.startedAt < 2500) return { ok: true }; // submitted faster than a human can type

  const h = headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0]!.trim() || 'local';
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= 5) return { ok: false, error: 'You’ve sent a few messages already. Email me directly instead.', code: 'tooMany' };
  hits.set(ip, [...recent, now]);

  const geo = geoFromHeaders(h);
  try {
    await connectDB();
    await Message.create({
      name: d.name, email: d.email, company: d.company, projectTypes: d.projectTypes,
      budget: d.budget, details: d.details, city: geo.city, country: geo.country,
    });
  } catch (err) {
    console.error('[contact] save failed:', (err as Error).message);
    return { ok: false, error: 'Your message couldn’t be sent right now. Please email me instead.', code: 'failed' };
  }

  await notify(d).catch((err) => console.error('[contact] email failed:', err.message));
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

/** Optional email alert via Resend when RESEND_API_KEY and CONTACT_NOTIFY_EMAIL are set. */
async function notify(d: z.infer<typeof schema>) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_NOTIFY_EMAIL;
  if (!key || !to) return;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM_EMAIL || 'Portfolio <onboarding@resend.dev>',
      to,
      reply_to: d.email,
      subject: `New enquiry from ${d.name}${d.company ? ` (${d.company})` : ''}`,
      text: [
        `Name: ${d.name}`,
        `Email: ${d.email}`,
        d.company ? `Company: ${d.company}` : null,
        d.projectTypes.length ? `Needs: ${d.projectTypes.join(', ')}` : null,
        d.budget ? `Budget: ${d.budget}` : null,
        d.details ? `\n${d.details}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}`);
}
