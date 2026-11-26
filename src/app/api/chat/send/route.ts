import { NextResponse } from 'next/server';
import { z } from 'zod';
import { postVisitorMessage, sessionFromToken, startSession, toDto } from '@/lib/chat-core';
import { geoFromHeaders } from '@/lib/geo';
import { allow, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const schema = z.object({
  text: z.string().trim().min(1, 'Write a message first.').max(2000, 'Keep messages under 2,000 characters.'),
  name: z.string().trim().max(60).optional(),
  page: z.string().max(200).optional(),
});

const bearer = (req: Request) => req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;

export async function POST(req: Request) {
  if (!allow(`chat-ip:${clientIp(req.headers)}`, 30, 60_000))
    return NextResponse.json({ error: 'You’re sending messages very fast. Wait a moment and try again.', code: 'fast' }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]!.message }, { status: 400 });
  const { text, name, page } = parsed.data;

  try {
    let session = await sessionFromToken(bearer(req));
    let token: string | undefined;
    let first = false;
    if (!session) {
      const geo = geoFromHeaders(req.headers);
      ({ session, token } = await startSession({ name, page, city: geo.city, country: geo.country }));
      first = true;
    } else if (name && !session.name) {
      session.name = name;
    }
    if (session.status === 'blocked') return NextResponse.json({ error: 'This conversation is closed.', code: 'closed' }, { status: 403 });
    if (!allow(`chat-session:${session.id}`, 8, 10_000))
      return NextResponse.json({ error: 'You’re sending messages very fast. Wait a moment and try again.', code: 'fast' }, { status: 429 });

    const msg = await postVisitorMessage(session, text, first);
    return NextResponse.json({ token, code: session.code, message: toDto(msg.toObject()) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[chat] send failed:', (err as Error).message);
    return NextResponse.json({ error: 'Your message couldn’t be sent. Check your connection and try again.', code: 'failed' }, { status: 500 });
  }
}
