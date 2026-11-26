'use client';

import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { convert, type Rates } from '@/lib/currency';
import type { ProjectOption } from '@/lib/options';
import { matchesQuery } from '@/lib/search';
import { groupByMonth } from '@/lib/summary';
import type { PaymentRow } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Money, useCurrency } from '../currency-context';
import { EmptyState } from '../ui';
import { PaymentsTable } from './tables';
import { useI18n } from '../i18n';

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const { t } = useI18n();
  return (
    <label className="relative flex min-w-0 flex-1 items-center">
      <Search className="pointer-events-none absolute left-4 h-4 w-4 text-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={t.portal.searchLabel}
        className="h-12 w-full rounded-full border border-line bg-surface pl-11 pr-11 text-sm text-ink outline-none transition-colors placeholder:text-muted/80 focus:border-accent focus:ring-4 focus:ring-accent/15 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button onClick={() => onChange('')} aria-label={t.portal.clear} className="absolute right-3 grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      )}
    </label>
  );
}

export function KindFilter({ value, onChange }: { value: 'all' | 'project' | 'subscription'; onChange: (v: 'all' | 'project' | 'subscription') => void }) {
  const { t } = useI18n();
  return (
    <div className="inline-flex max-w-full shrink-0 overflow-x-auto rounded-full border border-line bg-surface p-1 text-sm font-semibold">
      {(
        [
          ['all', t.portal.all],
          ['project', t.portal.filterProjects],
          ['subscription', t.portal.filterSubs],
        ] as const
      ).map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} className={cn('shrink-0 rounded-full px-3.5 py-1.5 transition-colors', value === k ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink')}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function PaymentsExplorer({ payments, projects }: { payments: PaymentRow[]; projects: ProjectOption[] }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | 'project' | 'subscription'>('all');
  const { rates } = useCurrency();
  const filtered = useMemo(() => payments.filter((p) => (kind === 'all' || p.kind === kind) && matchesQuery(p, q)), [payments, q, kind]);
  const months = groupByMonth(filtered);
  const totalUSD = (list: PaymentRow[], r: Rates) => list.reduce((s, p) => s + convert(p.amountInProjectCurrency, p.projectCurrency, 'USD', r), 0);

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBox value={q} onChange={setQ} placeholder="Search by invoice number, project, client or date (e.g. oct 2026)" />
        <KindFilter value={kind} onChange={setKind} />
      </div>
      {(q || kind !== 'all') && (
        <p className="mb-4 text-sm text-muted">
          {filtered.length} payment{filtered.length === 1 ? '' : 's'} found, totalling <Money amount={totalUSD(filtered, rates)} className="font-semibold text-accent-fg" />
        </p>
      )}
      {months.length === 0 ? (
        <EmptyState title={payments.length ? 'No payments match that search' : 'No payments recorded'}>
          {payments.length ? 'Try an invoice number like INV-2026-0003, a project name, or a month like “sep 2026”.' : 'Use “Record payment” when money comes in.'}
        </EmptyState>
      ) : (
        <div className="grid gap-5">
          {months.map((m) => (
            <section key={m.key} className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
              <div className="mb-2 flex items-baseline justify-between gap-4 border-b border-line pb-3">
                <h2 className="font-display text-base font-semibold">{m.label}</h2>
                <p className="text-sm text-muted">
                  {m.items.length} payment{m.items.length === 1 ? '' : 's'}, <Money amount={totalUSD(m.items, rates)} className="font-semibold text-accent-fg" />
                </p>
              </div>
              <PaymentsTable payments={m.items} projects={projects} />
            </section>
          ))}
        </div>
      )}
    </>
  );
}
