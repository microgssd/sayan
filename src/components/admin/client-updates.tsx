'use client';

import { Mail, Send, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { postUpdate, deleteUpdate } from '@/lib/actions/waas-admin';
import { renderEvent } from '@/lib/event-text';
import type { ClientEventRow } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import { ActionButton, Button, Field, Input, Textarea, useActionForm } from '../ui';

const DOT: Record<ClientEventRow['severity'], string> = { info: 'bg-line', success: 'bg-accent', warning: 'bg-brass', danger: 'bg-danger' };

/** The client's Updates feed as you see it (with whether they've read each one), plus a form to post your own. */
export function ClientUpdates({ clientId, events }: { clientId: string; events: ClientEventRow[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const { onSubmit, pending } = useActionForm((fd) => postUpdate(clientId, fd), () => formRef.current?.reset());
  return (
    <section className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">Updates</h2>
      <p className="mt-1 text-sm text-muted">What this client sees in their portal: payments, plan and project news, and notes from you. System entries appear on their own.</p>

      <form ref={formRef} onSubmit={onSubmit} className="mt-4 grid gap-3 rounded-xl border border-line p-4">
        <Field label="Post an update">
          <Input name="title" placeholder="e.g. Your site migration is scheduled for Friday" maxLength={120} required />
        </Field>
        <Field label="Details (optional)">
          <Textarea name="body" className="min-h-[72px]" maxLength={1000} />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="email" className="h-4 w-4 accent-[rgb(var(--accent))]" />
            <Mail className="h-4 w-4 text-muted" /> Also email it to the client
          </label>
          <Button loading={pending} size="sm">
            <Send /> Post
          </Button>
        </div>
      </form>

      {events.length ? (
        <ol className="mt-5 grid gap-1">
          {events.map((e) => {
            const text = e.type === 'note' ? { title: e.title, body: e.body } : renderEvent(e.type, e.data, 'en');
            return (
              <li key={e.id} className="group flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-2">
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', DOT[e.severity])} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {text.title}
                    {e.by === 'admin' && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent-fg">YOU</span>}
                  </p>
                  {text.body && <p className="mt-0.5 break-words text-sm text-muted">{text.body}</p>}
                  <p suppressHydrationWarning className="mt-1 text-xs text-subtle">
                    {formatDate(e.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {e.read ? 'seen by client' : 'not seen yet'}
                  </p>
                </div>
                <ActionButton variant="ghost" size="sm" className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" confirm confirmLabel="Remove?" action={deleteUpdate.bind(null, e.id)}>
                  <Trash2 />
                </ActionButton>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-5 text-sm text-muted">Nothing yet. Payments, project changes and your notes will show up here.</p>
      )}
    </section>
  );
}
