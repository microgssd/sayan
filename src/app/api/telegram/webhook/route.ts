import { NextResponse } from 'next/server';
import { handleTelegramUpdate } from '@/lib/chat-core';

export const dynamic = 'force-dynamic';

// Telegram calls this when you message the bot. The secret header proves the request really came from Telegram.
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    await handleTelegramUpdate(await req.json());
  } catch (err) {
    // Always answer 200 so Telegram doesn't retry the same update forever.
    console.error('[telegram] update failed:', (err as Error).message);
  }
  return NextResponse.json({ ok: true });
}
