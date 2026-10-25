import { NextResponse } from 'next/server';
import { z } from 'zod';
import { notifyOwner, sessionFromToken } from '@/lib/chat-core';
import { allow, clientIp } from '@/lib/rate-limit';
import { esc } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

const schema = z.object({ email: z.string().trim().toLowerCase().email('That email doesn’t look right.') });

export async function POST(req: Request) {
  if (!allow(`chat-profile:${clientIp(req.headers)}`, 10, 60_000)) return NextResponse.json({ error: 'Try again in a moment.' }, { status: 429 });
  const session = await sessionFromToken(req.headers.get('authorization')?.replace(/^Bearer\s+/i, ''));
  if (!session) return NextResponse.json({ error: 'Start a conversation first.' }, { status: 404 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]!.message }, { status: 400 });

  const changed = session.email !== parsed.data.email;
  session.email = parsed.data.email;
  await session.save();
  if (changed) await notifyOwner(session, `📧 #${session.code} ${esc(session.name || 'Visitor')} left their email: ${esc(parsed.data.email)}`);
  return NextResponse.json({ ok: true });
}
