// Shared chat logic used by the API routes, the Telegram webhook and the local polling script.
import crypto from 'node:crypto';
import type { HydratedDocument } from 'mongoose';
import { connectDB } from './db';
import { ChatMessage, ChatSession, type ChatMessageDoc, type ChatSessionDoc } from './models/Chat';
import { esc, tg, telegramReady } from './telegram';

type Session = HydratedDocument<ChatSessionDoc>;
type Msg = HydratedDocument<ChatMessageDoc>;

export type ChatMessageDto = { id: string; from: 'visitor' | 'owner'; text: string; at: string };
export const toDto = (m: { _id: unknown; from: string; text: string; createdAt?: Date | string }): ChatMessageDto => ({
  id: String(m._id),
  from: m.from as 'visitor' | 'owner',
  text: m.text,
  at: new Date(m.createdAt ?? Date.now()).toISOString(),
});

const countryName = (code: string) => {
  try {
    return code.length === 2 ? new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code : code;
  } catch {
    return code;
  }
};

export const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

export async function sessionFromToken(token?: string | null): Promise<Session | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  await connectDB();
  return ChatSession.findOne({ tokenHash: hashToken(token) });
}

export async function startSession(input: { name?: string; page?: string; city?: string; country?: string }) {
  await connectDB();
  const token = crypto.randomBytes(24).toString('base64url');
  const session = await ChatSession.create({
    tokenHash: hashToken(token),
    code: crypto.randomBytes(2).toString('hex').toUpperCase(),
    name: input.name ?? '',
    page: input.page ?? '',
    city: input.city ?? '',
    country: countryName(input.country ?? ''),
  });
  return { token, session };
}

/** Saves a visitor message and forwards it to your Telegram. Never fails because Telegram is down. */
export async function postVisitorMessage(session: Session, text: string, first: boolean): Promise<Msg> {
  const msg = await ChatMessage.create({ session: session._id, from: 'visitor', text, via: 'site' });
  session.lastVisitorAt = msg.get('createdAt');
  session.lastMessageAt = msg.get('createdAt');
  if (session.status === 'closed') session.status = 'open';
  await session.save();

  if (telegramReady()) {
    try {
      const who = session.name ? esc(session.name) : 'Visitor';
      const where = [session.city, session.country].filter(Boolean).join(', ');
      const head = first
        ? `💬 <b>New chat</b>  #${session.code}\n<b>${who}</b>${where ? ` from ${esc(where)}` : ''}\n\n`
        : `<b>${who}</b>  #${session.code}\n`;
      const tail = first ? `\n\n<i>Reply to this message to answer.</i>` : '';
      const sent = await tg<{ message_id: number }>('sendMessage', {
        chat_id: process.env.TELEGRAM_OWNER_CHAT_ID,
        text: head + esc(text) + tail,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
      msg.tgMessageId = sent.message_id;
      await msg.save();
    } catch (err) {
      console.error('[chat] telegram forward failed:', (err as Error).message);
    }
  }
  return msg;
}

/** Posts a note into your Telegram that you can reply to (e.g. "left their email"). */
export async function notifyOwner(session: Session, html: string) {
  if (!telegramReady()) return;
  try {
    const sent = await tg<{ message_id: number }>('sendMessage', { chat_id: process.env.TELEGRAM_OWNER_CHAT_ID, text: html, parse_mode: 'HTML' });
    await ChatMessage.create({ session: session._id, from: 'system', text: html.replace(/<[^>]+>/g, ''), via: 'site', tgMessageId: sent.message_id });
  } catch (err) {
    console.error('[chat] telegram note failed:', (err as Error).message);
  }
}

/** Saves your reply (from Telegram or the dashboard) so the visitor's widget picks it up. */
export async function postOwnerMessage(session: Session, text: string, via: 'telegram' | 'dashboard', tgMessageId?: number) {
  const msg = await ChatMessage.create({ session: session._id, from: 'owner', text: text.slice(0, 4000), via, tgMessageId });
  const at = msg.get('createdAt');
  session.lastOwnerAt = at;
  session.lastMessageAt = at;
  session.ownerReadAt = at;
  await session.save();
  await emailReplyIfAway(session, text).catch((err) => console.error('[chat] reply email failed:', err.message));
  return msg;
}

export const replyEmailsEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.CONTACT_FROM_EMAIL);

/** If the visitor left an email and isn't on the page right now, send them your reply. Needs Resend with a verified domain. */
async function emailReplyIfAway(session: Session, text: string) {
  if (!session.email || !replyEmailsEnabled()) return;
  const seen = session.lastSeenAt ? new Date(session.lastSeenAt).getTime() : 0;
  if (Date.now() - seen < 2 * 60_000) return; // they're looking at the chat, no email needed
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM_EMAIL,
      to: session.email,
      reply_to: process.env.CONTACT_NOTIFY_EMAIL || undefined,
      subject: 'New reply to your message',
      text: `${text}

Continue the conversation: ${site}
(Open the chat bubble on the site. It remembers you on the same browser.)`,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}`);
}

const HELP = [
  '<b>Website live chat</b>',
  '',
  'New messages from your site arrive here.',
  'To answer, <b>reply</b> to the visitor’s message (swipe left on it, or long-press and tap Reply).',
  '',
  '/chats  recent conversations',
  '/help  this message',
].join('\n');

/** Handles one Telegram update. Only your own chat (TELEGRAM_OWNER_CHAT_ID) can reply to visitors. */
export async function handleTelegramUpdate(update: any) {
  const msg = update?.message;
  if (!msg?.chat) return;
  const chatId = String(msg.chat.id);
  const owner = process.env.TELEGRAM_OWNER_CHAT_ID;
  const text: string | undefined = msg.text;
  const say = (html: string) =>
    tg('sendMessage', { chat_id: chatId, text: html, parse_mode: 'HTML', reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true } }).catch(() => {});

  // Anyone else who finds the bot is ignored. Before setup, /start tells you your chat ID.
  if (!owner || chatId !== owner) {
    if (!owner && text?.startsWith('/start')) await say(`Your chat ID is <code>${chatId}</code>\nAdd it to TELEGRAM_OWNER_CHAT_ID to receive website chats here.`);
    return;
  }

  if (text === '/start' || text === '/help') return void (await say(HELP));

  await connectDB();
  if (text === '/chats') {
    const sessions = await ChatSession.find({ status: { $ne: 'blocked' } }).sort({ lastMessageAt: -1 }).limit(6).lean();
    if (!sessions.length) return void (await say('No conversations yet.'));
    const lines = sessions.map((s) => `#${s.code}  ${esc(s.name || 'Visitor')}${s.city ? `, ${esc(s.city)}` : ''}${s.lastVisitorAt && (!s.lastOwnerAt || s.lastVisitorAt > s.lastOwnerAt) ? '  ⏳ waiting' : ''}`);
    return void (await say(`<b>Recent chats</b>\n${lines.join('\n')}\n\nReply to any of their messages above to answer.`));
  }

  const replyTo: number | undefined = msg.reply_to_message?.message_id;
  if (!replyTo) return void (await say('To answer a visitor, <b>reply</b> to their message (swipe left on it).'));
  if (!text) return void (await say('Only text replies reach visitors for now.'));

  const original = await ChatMessage.findOne({ tgMessageId: replyTo }).lean();
  const session = original ? await ChatSession.findById(original.session) : null;
  if (!session) return void (await say('I couldn’t match that to a website conversation.'));
  if (session.status === 'blocked') return void (await say(`#${session.code} is blocked, so the reply wasn’t delivered.`));

  try {
    await postOwnerMessage(session, text, 'telegram', msg.message_id);
  } catch (err) {
    // Telegram occasionally delivers the same update twice; the unique index makes the repeat a no-op.
    if ((err as { code?: number }).code === 11000) return;
    throw err;
  }
  // A quiet 👍 on your message confirms delivery, without cluttering the chat.
  await tg('setMessageReaction', { chat_id: chatId, message_id: msg.message_id, reaction: [{ type: 'emoji', emoji: '👍' }] }).catch(() => {});
}

/** "Online" during your waking hours, or "Active now" if you replied in the last 15 minutes. */
export function ownerStatus(timezone: string, lastOwnerAt?: Date | null) {
  const recent = lastOwnerAt ? Date.now() - new Date(lastOwnerAt).getTime() < 15 * 60_000 : false;
  let hour = 12;
  try {
    hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  } catch {}
  const online = recent || (hour >= 9 && hour < 22);
  const code = recent ? 'active' : online ? 'online' : 'away';
  return { online, code, label: recent ? 'Active now' : online ? 'Usually replies within minutes' : 'Away right now, replies in the morning' } as const;
}
