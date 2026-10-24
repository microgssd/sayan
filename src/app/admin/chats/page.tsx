import Link from 'next/link';
import { isValidObjectId } from 'mongoose';
import { requireAdmin } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { ChatMessage, ChatSession } from '@/lib/models/Chat';
import { tg } from '@/lib/telegram';
import { PageHeader } from '@/components/admin/shell';
import { AutoRefresh, ChatActions, ChatReply, TelegramSetup } from '@/components/admin/chat-admin';
import { EmptyState } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function telegramState() {
  const env = {
    token: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    owner: Boolean(process.env.TELEGRAM_OWNER_CHAT_ID),
    secret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
    https: Boolean(process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://')),
  };
  let bot = '';
  let webhook: { url: string; pending: number; error: string } | null = null;
  if (env.token) {
    try {
      const [me, info] = await Promise.all([tg<{ username: string }>('getMe'), tg<{ url: string; pending_update_count: number; last_error_message?: string }>('getWebhookInfo')]);
      bot = me.username;
      webhook = { url: info.url, pending: info.pending_update_count, error: info.last_error_message ?? '' };
    } catch {}
  }
  return { env, bot, webhook };
}

const time = (d: Date | string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default async function ChatsPage({ searchParams }: { searchParams: { s?: string } }) {
  await requireAdmin();
  await connectDB();
  const [sessions, state] = await Promise.all([ChatSession.find().sort({ lastMessageAt: -1 }).limit(60).lean(), telegramState()]);
  const selectedId = searchParams.s && isValidObjectId(searchParams.s) ? searchParams.s : sessions[0] ? String(sessions[0]._id) : null;
  const selected = selectedId ? sessions.find((s) => String(s._id) === selectedId) : null;
  const messages = selected ? await ChatMessage.find({ session: selected._id }).sort({ createdAt: 1 }).limit(500).lean() : [];
  const waiting = (s: (typeof sessions)[number]) =>
    Boolean(s.lastVisitorAt && (!s.lastOwnerAt || s.lastVisitorAt > s.lastOwnerAt) && (!s.ownerReadAt || s.lastVisitorAt > s.ownerReadAt));
  const ready = state.env.token && state.env.owner;

  return (
    <>
      <AutoRefresh every={5000} />
      <PageHeader title="Live chat" description={ready ? `Visitors’ messages go to your Telegram${state.bot ? ` via @${state.bot}` : ''}. Reply there or here.` : 'Connect Telegram to get visitor messages on your phone.'} />
      <TelegramSetup state={state} />

      {sessions.length === 0 ? (
        <EmptyState title="No conversations yet">When a visitor uses the chat bubble on your homepage, the conversation appears here.</EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <ul className="grid max-h-[70vh] content-start gap-1 overflow-y-auto rounded-2xl border border-line bg-surface p-2" data-lenis-prevent>
            {sessions.map((s) => {
              const id = String(s._id);
              return (
                <li key={id}>
                  <Link
                    href={`/admin/chats?s=${id}`}
                    scroll={false}
                    className={cn('block rounded-xl px-3 py-2.5 transition-colors', id === selectedId ? 'bg-surface-2' : 'hover:bg-surface-2/60')}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 font-semibold">
                        {waiting(s) && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Waiting for reply" />}
                        <span className="truncate">{s.name || 'Visitor'}</span>
                        <span className="text-xs font-normal text-subtle">#{s.code}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted">{formatDate(s.lastMessageAt.toISOString(), { day: 'numeric', month: 'short' })}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {[s.city, s.country].filter(Boolean).join(', ') || 'Location unknown'}
                      {s.status !== 'open' && `, ${s.status}`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {selected && (
            <section className="flex min-h-[60vh] flex-col overflow-hidden rounded-2xl border border-line bg-surface">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {selected.name || 'Visitor'} <span className="text-sm font-normal text-subtle">#{selected.code}</span>
                  </p>
                  <p className="truncate text-xs text-muted">
                    {[selected.email, [selected.city, selected.country].filter(Boolean).join(', '), selected.page && `on ${selected.page}`].filter(Boolean).join(', ') ||
                      'No details shared'}
                  </p>
                </div>
                <ChatActions id={String(selected._id)} status={selected.status} email={selected.email} waiting={waiting(selected)} />
              </header>
              <ol className="flex max-h-[55vh] flex-1 flex-col gap-2 overflow-y-auto px-5 py-4" data-lenis-prevent>
                {messages.map((m) => (
                  <li
                    key={String(m._id)}
                    className={cn(
                      'max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm',
                      m.from === 'visitor' && 'self-start rounded-bl-md bg-surface-2',
                      m.from === 'owner' && 'self-end rounded-br-md bg-accent text-accent-ink',
                      m.from === 'system' && 'self-center bg-transparent text-xs text-muted',
                    )}
                  >
                    {m.text}
                    <span className={cn('mt-1 block text-[11px]', m.from === 'owner' ? 'text-accent-ink/70' : 'text-subtle')}>
                      {time(m.createdAt)}
                      {m.from === 'owner' && m.via !== 'site' && `, via ${m.via}`}
                    </span>
                  </li>
                ))}
              </ol>
              {selected.status !== 'blocked' && <ChatReply id={String(selected._id)} />}
            </section>
          )}
        </div>
      )}
    </>
  );
}
