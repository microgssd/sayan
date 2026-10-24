'use client';

import { Archive, Mail, MailOpen, Trash2 } from 'lucide-react';
import { deleteMessage, setMessageStatus } from '@/lib/actions/messages';
import { cn, formatDate } from '@/lib/utils';
import { ActionButton } from '../ui';

export type MessageRow = {
  id: string; name: string; email: string; company: string; projectTypes: string[]; budget: string;
  details: string; status: 'new' | 'read' | 'archived'; city: string; country: string; createdAt: string;
};

export function MessageCard({ message: m }: { message: MessageRow }) {
  const isNew = m.status === 'new';
  return (
    <article className={cn('rounded-2xl border bg-surface p-5', isNew ? 'border-accent/60' : 'border-line')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            {isNew && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
            <span className="truncate">{m.name}</span>
            {m.company && <span className="truncate font-normal text-muted">{m.company}</span>}
          </p>
          <a href={`mailto:${m.email}?subject=Re: your project`} className="text-sm text-accent-fg hover:underline">
            {m.email}
          </a>
        </div>
        <p className="text-xs text-muted">
          {formatDate(m.createdAt)}
          {(m.city || m.country) && `, ${[m.city, m.country].filter(Boolean).join(', ')}`}
        </p>
      </div>
      {(m.projectTypes.length > 0 || m.budget) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {m.projectTypes.map((t) => (
            <span key={t} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold">
              {t}
            </span>
          ))}
          {m.budget && <span className="rounded-full bg-brass/15 px-2.5 py-1 text-xs font-semibold text-brass">{m.budget}</span>}
        </div>
      )}
      {m.details && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{m.details}</p>}
      <div className="mt-4 flex flex-wrap gap-1">
        <a href={`mailto:${m.email}?subject=Re: your project`} className="inline-flex h-8 items-center gap-2 rounded-full bg-accent px-3 text-xs font-semibold text-accent-ink">
          <Mail className="h-4 w-4" /> Reply
        </a>
        <ActionButton variant="ghost" size="sm" action={setMessageStatus.bind(null, m.id, isNew ? 'read' : 'new')}>
          <MailOpen /> {isNew ? 'Mark read' : 'Mark unread'}
        </ActionButton>
        {m.status !== 'archived' ? (
          <ActionButton variant="ghost" size="sm" action={setMessageStatus.bind(null, m.id, 'archived')}>
            <Archive /> Archive
          </ActionButton>
        ) : (
          <ActionButton variant="ghost" size="sm" action={setMessageStatus.bind(null, m.id, 'read')}>
            <Archive /> Restore
          </ActionButton>
        )}
        <ActionButton variant="danger" size="sm" confirm confirmLabel="Delete?" action={deleteMessage.bind(null, m.id)} aria-label="Delete message">
          <Trash2 />
        </ActionButton>
      </div>
    </article>
  );
}
