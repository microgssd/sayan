'use client';

import { Ban, Check, CircleCheck, CircleX, Mail, RotateCcw, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { connectTelegramWebhook, detectTelegramChatId, markChatRead, replyFromDashboard, sendTelegramTest, setChatStatus } from '@/lib/actions/chat-admin';
import { ActionButton, Button, Textarea, useActionForm } from '../ui';
import { cn } from '@/lib/utils';

/** Keeps the inbox fresh while the page is open and visible. */
export function AutoRefresh({ every }: { every: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => !document.hidden && router.refresh(), every);
    return () => clearInterval(t);
  }, [every, router]);
  return null;
}

export function ChatReply({ id }: { id: string }) {
  const form = useRef<HTMLFormElement>(null);
  const { pending, onSubmit } = useActionForm(replyFromDashboard.bind(null, id), () => form.current?.reset());
  return (
    <form ref={form} onSubmit={onSubmit} className="flex items-end gap-2 border-t border-line p-3">
      <Textarea
        name="text"
        rows={1}
        placeholder="Write a reply"
        className="min-h-[44px] flex-1"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            form.current?.requestSubmit();
          }
        }}
      />
      <Button loading={pending} aria-label="Send reply">
        <Send /> Send
      </Button>
    </form>
  );
}

export function ChatActions({ id, status, email, waiting }: { id: string; status: string; email: string; waiting: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {email && (
        <a href={`mailto:${email}`} className="inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-ink">
          <Mail className="h-4 w-4" /> Email
        </a>
      )}
      {waiting && (
        <ActionButton variant="ghost" size="sm" action={markChatRead.bind(null, id)}>
          <Check /> Mark read
        </ActionButton>
      )}
      {status === 'open' ? (
        <ActionButton variant="ghost" size="sm" action={setChatStatus.bind(null, id, 'closed')}>
          <CircleCheck /> Close
        </ActionButton>
      ) : (
        <ActionButton variant="ghost" size="sm" action={setChatStatus.bind(null, id, 'open')}>
          <RotateCcw /> Reopen
        </ActionButton>
      )}
      {status !== 'blocked' && (
        <ActionButton variant="danger" size="sm" confirm confirmLabel="Block visitor?" action={setChatStatus.bind(null, id, 'blocked')}>
          <Ban /> Block
        </ActionButton>
      )}
    </div>
  );
}

type State = {
  env: { token: boolean; owner: boolean; secret: boolean; https: boolean };
  bot: string;
  webhook: { url: string; pending: number; error: string } | null;
};

export function TelegramSetup({ state }: { state: State }) {
  const { env, bot, webhook } = state;
  const hooked = Boolean(webhook?.url);
  const all = env.token && env.owner && env.secret && hooked && !webhook?.error;
  const checks = [
    { ok: env.token, label: 'Bot token', hint: bot ? `@${bot}` : 'TELEGRAM_BOT_TOKEN from @BotFather' },
    { ok: env.owner, label: 'Your chat ID', hint: 'TELEGRAM_OWNER_CHAT_ID' },
    { ok: env.secret, label: 'Webhook secret', hint: 'TELEGRAM_WEBHOOK_SECRET' },
    { ok: hooked && !webhook?.error, label: 'Webhook', hint: webhook?.error ? `Last error: ${webhook.error}` : hooked ? 'Connected' : 'Not connected yet' },
  ];
  if (all) return null;
  return (
    <section className="mb-6 rounded-2xl border border-accent/40 bg-surface p-5">
      <h2 className="font-display text-base font-semibold">Connect Telegram</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>In Telegram, message @BotFather, send /newbot, and copy the token into TELEGRAM_BOT_TOKEN.</li>
        <li>Open your new bot, press Start, then use “Find my chat ID” below and save it as TELEGRAM_OWNER_CHAT_ID.</li>
        <li>Set TELEGRAM_WEBHOOK_SECRET to a random string (letters, numbers, - and _), redeploy, then press “Connect webhook”.</li>
      </ol>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {checks.map((c) => (
          <li key={c.label} className={cn('flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm', c.ok ? 'border-line' : 'border-brass/50')}>
            {c.ok ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-fg" /> : <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-brass" />}
            <span className="min-w-0">
              <span className="block font-semibold">{c.label}</span>
              <span className="block truncate text-xs text-muted">{c.hint}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton variant="outline" size="sm" action={detectTelegramChatId}>Find my chat ID</ActionButton>
        <ActionButton variant="outline" size="sm" action={sendTelegramTest}>Send test message</ActionButton>
        <ActionButton size="sm" action={connectTelegramWebhook}>Connect webhook</ActionButton>
      </div>
    </section>
  );
}
