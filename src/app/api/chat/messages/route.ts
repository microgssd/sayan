import { NextResponse } from 'next/server';
import { ownerStatus, sessionFromToken, toDto, visitorCutoff } from '@/lib/chat-core';
import { getSettings } from '@/lib/ledger';
import { ChatMessage } from '@/lib/models/Chat';
import { DEFAULT_SETTINGS } from '@/lib/defaults';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
  const after = new URL(req.url).searchParams.get('after');
  const noStore = { headers: { 'Cache-Control': 'no-store' } };

  try {
    const [session, settings] = await Promise.all([sessionFromToken(token), getSettings().catch(() => DEFAULT_SETTINGS)]);
    const status = ownerStatus(settings.timezone, session?.lastOwnerAt);
    if (!session) return NextResponse.json({ messages: [], status, known: false }, noStore);
    // Record that the visitor is around (at most once a minute), so replies aren't emailed while they're watching.
    if (!session.lastSeenAt || Date.now() - new Date(session.lastSeenAt).getTime() > 60_000) {
      session.lastSeenAt = new Date();
      await session.save();
    }

    const query: Record<string, unknown> = { session: session._id, from: { $in: ['visitor', 'owner'] } };
    // Never older than 7 days, whatever the widget asks for.
    const cutoff = visitorCutoff();
    const since = after ? new Date(after) : null;
    query.createdAt = since && !Number.isNaN(since.getTime()) && since > cutoff ? { $gt: since } : { $gte: cutoff };
    const messages = await ChatMessage.find(query).sort({ createdAt: 1 }).limit(200).lean();
    return NextResponse.json({ messages: messages.map(toDto), status, known: true, hasEmail: Boolean(session.email), blocked: session.status === 'blocked' }, noStore);
  } catch (err) {
    console.error('[chat] poll failed:', (err as Error).message);
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
