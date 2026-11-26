'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { connectDB } from '../db';
import { geoFromHeaders } from '../geo';
import crypto from 'node:crypto';
import { Message } from '../models/Message';
import { checkFormToken } from '../form-token';
import { assessContact, verifyTurnstile } from '../spam';


const schema = z
  .object({
    name: z.string().trim().min(2, 'Add your name.').max(80),
    email: z.string().trim().toLowerCase().email('That email doesn’t look right.'),
    company: z.string().trim().max(120).default(''),
    projectTypes: z.array(z.string().max(40)).max(8).default([]),
    budget: z.string().max(40).default(''),
    details: z.string().trim().max(3000, 'Keep it under 3,000 characters.').default(''),
    website: z.string().max(0).optional(), // honeypot: real people never fill this in
    token: z.string().max(200), // signed timestamp issued with the page
    turnstile: z.string().max(4000).optional(),
  })
  .refine((d) => d.projectTypes.length > 0 || d.details.length >= 10, {
    message: 'Pick what you need, or tell me a little about the project.',
    path: ['projectTypes'],
  });

export type ContactCode = 'name' | 'email' | 'need' | 'long' | 'tooMany' | 'failed' | 'links' | 'expired' | 'human' | 'disposable';
export type ContactResult = { ok: true } | { ok: false; error: string; field?: string; code?: ContactCode };

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
  const ok = { ok: true } as const;

  // 1. Signed page token: must exist, be genuine, and be at least 3 s old (bots post instantly).
  const tokenState = checkFormToken(d.token);
  if (tokenState === 'invalid' || tokenState === 'too-fast') return ok; // look successful so bots don't adapt
  if (tokenState === 'expired') return { ok: false, error: 'This page has been open a long time. Refresh it and send again.', code: 'expired' };

  const h = headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0]!.trim() || 'local';
  // 2. Optional Cloudflare Turnstile (only when its keys are configured).
  if (!(await verifyTurnstile(d.turnstile, ip))) return { ok: false, error: 'Please complete the check below the form and try again.', code: 'human' };

  // 3. Content checks.
  const verdict = assessContact(d);
  if (verdict.reject === 'links') return { ok: false, error: 'Please remove some links (two at most) and send again.', code: 'links' };
  if (verdict.reject === 'email') return { ok: false, error: 'Please use a permanent email address so I can reply.', code: 'disposable', field: 'email' };

  const ipHash = crypto.createHash('sha256').update(`${process.env.AUTH_SECRET ?? ''}:${ip}`).digest('hex').slice(0, 32);
  try {
    await connectDB();
    // 4. Limits stored in the database, so they hold on Vercel: 3 an hour and 8 a day per visitor, 3 a day per email.
    const hour = new Date(Date.now() - 3600_000);
    const day = new Date(Date.now() - 86_400_000);
    const [perHour, perDay, perEmail, duplicate] = await Promise.all([
      Message.countDocuments({ ipHash, createdAt: { $gte: hour } }),
      Message.countDocuments({ ipHash, createdAt: { $gte: day } }),
      Message.countDocuments({ email: d.email, createdAt: { $gte: day } }),
      Message.exists({ email: d.email, details: d.details, createdAt: { $gte: day } }),
    ]);
    if (duplicate) return ok; // the same message twice: already received
    if (perHour >= 3 || perDay >= 8 || perEmail >= 3)
      return { ok: false, error: 'You’ve sent a few messages already. Email me directly instead.', code: 'tooMany' };

    const geo = geoFromHeaders(h);
    await Message.create({
      name: d.name, email: d.email, company: d.company, projectTypes: d.projectTypes,
      budget: d.budget, details: d.details, city: geo.city, country: geo.country,
      ipHash, status: verdict.spam ? 'spam' : 'new', spamReasons: verdict.reasons,
    });
    if (verdict.spam) return ok; // filed in Spam, no email alert
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
