'use server';

import { isValidObjectId } from 'mongoose';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../auth';
import { postOwnerMessage } from '../chat-core';
import { connectDB } from '../db';
import { ChatMessage, ChatSession } from '../models/Chat';
import { esc, tg, telegramReady } from '../telegram';
import type { ActionResult } from '../types';

const fail = (error: string): ActionResult => ({ ok: false, error });

export async function replyFromDashboard(sessionId: string, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const text = String(fd.get('text') ?? '').trim();
  if (!text) return fail('Write a reply first.');
  if (text.length > 4000) return fail('Keep replies under 4,000 characters.');
  if (!isValidObjectId(sessionId)) return fail('Conversation not found.');
  await connectDB();
  const session = await ChatSession.findById(sessionId);
  if (!session) return fail('Conversation not found.');

  let tgMessageId: number | undefined;
  if (telegramReady()) {
    // Mirror into Telegram so the thread there stays complete, and so you can keep replying from your phone.
    try {
      const sent = await tg<{ message_id: number }>('sendMessage', {
        chat_id: process.env.TELEGRAM_OWNER_CHAT_ID,
        text: `↩️ <b>You</b> to #${session.code} (from dashboard)\n${esc(text)}`,
        parse_mode: 'HTML',
      });
      tgMessageId = sent.message_id;
    } catch {}
  }
  await postOwnerMessage(session, text, 'dashboard', tgMessageId);
  revalidatePath('/admin', 'layout');
  return { ok: true, message: 'Reply sent.' };
}

/** Permanently deletes a conversation and all its messages. The visitor's chat starts fresh next time. */
export async function deleteChat(sessionId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(sessionId)) return fail('Conversation not found.');
  await connectDB();
  const { deletedCount } = await ChatMessage.deleteMany({ session: sessionId });
  await ChatSession.deleteOne({ _id: sessionId });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: `Conversation deleted (${deletedCount} message${deletedCount === 1 ? '' : 's'}).` };
}

export async function markChatRead(sessionId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(sessionId)) return fail('Conversation not found.');
  await connectDB();
  await ChatSession.updateOne({ _id: sessionId }, { ownerReadAt: new Date() });
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function setChatStatus(sessionId: string, status: 'open' | 'closed' | 'blocked'): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(sessionId)) return fail('Conversation not found.');
  await connectDB();
  await ChatSession.updateOne({ _id: sessionId }, { status });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: status === 'blocked' ? 'Visitor blocked.' : status === 'closed' ? 'Conversation closed.' : 'Conversation reopened.' };
}

/* ---------- Telegram setup ---------- */

export async function connectTelegramWebhook(): Promise<ActionResult> {
  await requireAdmin();
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!process.env.TELEGRAM_BOT_TOKEN) return fail('Add TELEGRAM_BOT_TOKEN to your environment first.');
  if (!process.env.TELEGRAM_WEBHOOK_SECRET) return fail('Add TELEGRAM_WEBHOOK_SECRET to your environment first.');
  if (!site?.startsWith('https://')) return fail('NEXT_PUBLIC_SITE_URL must be your live https:// address. For local testing, run npm run telegram:poll instead.');
  try {
    await tg('setWebhook', {
      url: `${site.replace(/\/$/, '')}/api/telegram/webhook`,
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ['message'],
    });
    return { ok: true, message: 'Webhook connected. Replies from Telegram will now reach visitors.' };
  } catch (err) {
    return fail((err as Error).message);
  }
}

export async function sendTelegramTest(): Promise<ActionResult> {
  await requireAdmin();
  if (!telegramReady()) return fail('Add TELEGRAM_BOT_TOKEN and TELEGRAM_OWNER_CHAT_ID first.');
  try {
    await tg('sendMessage', { chat_id: process.env.TELEGRAM_OWNER_CHAT_ID, text: '✅ Your website is connected. Visitor chats will arrive here.' });
    return { ok: true, message: 'Test message sent. Check Telegram.' };
  } catch (err) {
    return fail((err as Error).message);
  }
}

export async function detectTelegramChatId(): Promise<ActionResult> {
  await requireAdmin();
  if (!process.env.TELEGRAM_BOT_TOKEN) return fail('Add TELEGRAM_BOT_TOKEN first.');
  try {
    const updates = await tg<any[]>('getUpdates', { limit: 20, allowed_updates: ['message'] });
    const chat = [...updates].reverse().find((u) => u.message?.chat?.type === 'private')?.message.chat;
    if (!chat) return fail('No messages found. Open your bot in Telegram, send /start, then try again.');
    return { ok: true, message: `Your chat ID is ${chat.id} (${chat.first_name ?? chat.username ?? 'you'}). Add it as TELEGRAM_OWNER_CHAT_ID.` };
  } catch (err) {
    const m = (err as Error).message;
    return fail(m.includes('webhook') ? 'A webhook is active, so I can’t read updates. Send /start to your bot instead and it will reply with your chat ID.' : m);
  }
}
