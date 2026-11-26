'use client';

import { motion, useInView } from 'framer-motion';
import { Bell, CheckCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { markEventsRead } from '@/lib/actions/autopay';
import { renderEvent } from '@/lib/event-text';
import { fmt as fill } from '@/lib/i18n';
import type { ClientEventRow } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import { useI18n } from '../i18n';

const DOT = { info: 'bg-line', success: 'bg-accent', warning: 'bg-brass', danger: 'bg-danger' } as const;

/** The client's Updates feed: payments, plan and project news, and notes from you, in their language. */
export function UpdatesPanel({ events }: { events: ClientEventRow[] }) {
  const { t, lang, locale } = useI18n();
  const E = t.events;
  const [all, setAll] = useState(false);
  const [cleared, setCleared] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const seen = useInView(ref, { amount: 0.5 });
  const unread = cleared ? 0 : events.filter((e) => !e.read).length;

  // reading them for a few seconds counts as seen; you can also press the button
  useEffect(() => {
    if (!seen || !unread) return;
    const id = setTimeout(() => {
      setCleared(true);
      void markEventsRead();
    }, 4000);
    return () => clearTimeout(id);
  }, [seen, unread]);

  const shown = all ? events : events.slice(0, 4);
  return (
    <section ref={ref} className="mt-12">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 font-display text-xl font-semibold">
          <Bell className="h-5 w-5 text-accent-fg" />
          {E.heading}
          {unread > 0 && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-accent-ink">{fill(E.newCount, { n: unread })}</span>}
        </h2>
        {unread > 0 && (
          <button
            type="button"
            onClick={() => {
              setCleared(true);
              void markEventsRead();
            }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-fg underline-offset-4 hover:underline"
          >
            <CheckCheck className="h-4 w-4" /> {E.markRead}
          </button>
        )}
      </div>

      {events.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">{E.empty}</p>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-2 sm:p-3">
          <ol className="grid gap-0.5">
            {shown.map((e, i) => {
              const own = lang !== 'en' ? e.translations?.[lang] : undefined;
              const text = e.type === 'note' ? { title: own?.title?.trim() || e.title, body: own?.body?.trim() || e.body } : renderEvent(e.type, e.data, lang);
              const isNew = !cleared && !e.read;
              return (
                <motion.li
                  key={e.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.4 }}
                  className={cn('flex items-start gap-3 rounded-xl px-3 py-3', isNew && 'bg-accent/[0.07]')}
                >
                  <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', DOT[e.severity])} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-snug">
                      {text.title}
                      {e.by === 'admin' && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent-fg">{E.fromMe}</span>}
                    </p>
                    {text.body && <p className="mt-0.5 break-words text-sm leading-relaxed text-muted">{text.body}</p>}
                    <p suppressHydrationWarning className="mt-1 text-xs text-subtle">{formatDate(e.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }, locale)}</p>
                  </div>
                </motion.li>
              );
            })}
          </ol>
          {events.length > 4 && (
            <button type="button" onClick={() => setAll((v) => !v)} className="mt-1 w-full rounded-xl px-3 py-2.5 text-center text-sm font-semibold text-accent-fg hover:bg-surface-2">
              {all ? E.showLess : E.showAll}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
