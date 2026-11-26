'use client';

import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, FolderKanban, Repeat } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { convert, formatMoney } from '@/lib/currency';
import { METHOD_LABEL, type PaymentMethod } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import { Money, useCurrency } from '../currency-context';

export type AnalyticsPayment = {
  id: string;
  at: string; // ISO
  usd: number;
  kind: 'project' | 'subscription';
  item: string;
  client: string;
  method: PaymentMethod;
  invoice: string;
};

type Range = 'day' | 'week' | 'month' | 'year';
const RANGES: { id: Range; label: string; count: number; unit: string }[] = [
  { id: 'day', label: 'Daily', count: 30, unit: 'last 30 days' },
  { id: 'week', label: 'Weekly', count: 12, unit: 'last 12 weeks' },
  { id: 'month', label: 'Monthly', count: 12, unit: 'last 12 months' },
  { id: 'year', label: 'Yearly', count: 5, unit: 'last 5 years' },
];

const DAY = 86_400_000;
const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const startOf = (range: Range, d: Date) => {
  if (range === 'day') return utcDay(d);
  if (range === 'week') return utcDay(d) - ((d.getUTCDay() + 6) % 7) * DAY; // weeks start on Monday
  if (range === 'month') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  return Date.UTC(d.getUTCFullYear(), 0, 1);
};
const step = (range: Range, t: number, n: number) => {
  const d = new Date(t);
  if (range === 'day') return t + n * DAY;
  if (range === 'week') return t + n * 7 * DAY;
  if (range === 'month') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1);
  return Date.UTC(d.getUTCFullYear() + n, 0, 1);
};
const bucketLabel = (range: Range, t: number) => {
  const d = new Date(t);
  const o: Intl.DateTimeFormatOptions = { timeZone: 'UTC' };
  if (range === 'day') return d.toLocaleDateString('en-GB', { ...o, day: 'numeric', month: 'short' });
  if (range === 'week') return d.toLocaleDateString('en-GB', { ...o, day: 'numeric', month: 'short' });
  if (range === 'month') return d.toLocaleDateString('en-GB', { ...o, month: 'short', year: '2-digit' });
  return String(d.getUTCFullYear());
};
const bucketTitle = (range: Range, t: number) => {
  const d = new Date(t);
  if (range === 'day') return formatDate(d.toISOString(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (range === 'week') return `Week of ${formatDate(d.toISOString(), { day: 'numeric', month: 'long', year: 'numeric' })}`;
  if (range === 'month') return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return String(d.getUTCFullYear());
};

export function Analytics({ payments, mrrUSD, activeSubs }: { payments: AnalyticsPayment[]; mrrUSD: number; activeSubs: number }) {
  const [range, setRange] = useState<Range>('month');
  const [selected, setSelected] = useState<number | null>(null);
  const { currency, rates } = useCurrency();
  const cfg = RANGES.find((r) => r.id === range)!;

  const { buckets, inRange, prevTotal } = useMemo(() => {
    const end = startOf(range, new Date());
    const first = step(range, end, -(cfg.count - 1));
    const prevFirst = step(range, first, -cfg.count);
    const keys = Array.from({ length: cfg.count }, (_, i) => step(range, first, i));
    const sums = new Map(keys.map((k) => [k, 0]));
    const inRange: AnalyticsPayment[] = [];
    let prevTotal = 0;
    for (const p of payments) {
      const t = new Date(p.at).getTime();
      if (t >= first) {
        const k = startOf(range, new Date(p.at));
        if (sums.has(k)) {
          sums.set(k, sums.get(k)! + p.usd);
          inRange.push(p);
        }
      } else if (t >= prevFirst) prevTotal += p.usd;
    }
    return { buckets: keys.map((k) => ({ key: k, label: bucketLabel(range, k), usd: sums.get(k)! })), inRange, prevTotal };
  }, [payments, range, cfg.count]);

  const focus = selected === null ? inRange : inRange.filter((p) => startOf(range, new Date(p.at)) === selected);
  const total = focus.reduce((s, p) => s + p.usd, 0);
  const rangeTotal = inRange.reduce((s, p) => s + p.usd, 0);
  const change = prevTotal > 0 ? ((rangeTotal - prevTotal) / prevTotal) * 100 : null;
  const projectUSD = focus.filter((p) => p.kind === 'project').reduce((s, p) => s + p.usd, 0);
  const subUSD = total - projectUSD;

  const groupTop = (key: 'client' | 'method' | 'item') => {
    const m = new Map<string, number>();
    for (const p of focus) m.set(p[key], (m.get(p[key]) ?? 0) + p.usd);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  };
  const chartData = buckets.map((b) => ({ ...b, value: Math.round(convert(b.usd, 'USD', currency, rates)) }));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-line bg-surface p-1 text-sm font-semibold">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setRange(r.id);
                setSelected(null);
              }}
              className={cn('relative rounded-full px-4 py-2 transition-colors', range === r.id ? 'text-accent-ink' : 'text-muted hover:text-ink')}
            >
              {range === r.id && <motion.span layoutId="range-pill" className="absolute inset-0 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
              <span className="relative">{r.label}</span>
            </button>
          ))}
        </div>
        {selected !== null && (
          <button onClick={() => setSelected(null)} className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-accent">
            Show all of the {cfg.unit}
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={selected !== null ? bucketTitle(range, selected) : `Received, ${cfg.unit}`} value={<Money amount={total} />} accent>
          {selected === null && change !== null && (
            <span className={cn('inline-flex items-center gap-1 font-semibold', change >= 0 ? 'text-accent-fg' : 'text-danger')}>
              {change >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {Math.abs(change).toFixed(0)}% vs the previous period
            </span>
          )}
        </Kpi>
        <Kpi label="Payments" value={<span className="tabular-nums">{focus.length}</span>}>
          {focus.length > 0 && (
            <>
              Average <Money amount={total / focus.length} />
            </>
          )}
        </Kpi>
        <Kpi label="Projects vs subscriptions" value={<Money amount={projectUSD} />}>
          <Split a={projectUSD} b={subUSD} />
        </Kpi>
        <Kpi label="Monthly recurring revenue" value={<Money amount={mrrUSD} />}>
          {activeSubs} active subscription{activeSubs === 1 ? '' : 's'}
        </Kpi>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-semibold">Money received, {cfg.unit}</h2>
          <p className="text-xs text-muted">Click a bar to see its payments.</p>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 10, right: 4, left: 0, bottom: 0 }} onClick={(e) => e?.activePayload?.[0] && setSelected(e.activePayload[0].payload.key)}>
              <defs>
                <linearGradient id="an" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity={1} />
                  <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity={0.45} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeDasharray="3 6" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} tick={{ fill: 'rgb(var(--muted))', fontSize: 11 }} />
              <YAxis width={64} tickLine={false} axisLine={false} tick={{ fill: 'rgb(var(--muted))', fontSize: 11 }} tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })} />
              <Tooltip
                cursor={{ fill: 'rgb(var(--accent) / 0.08)' }}
                contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))', borderRadius: 12, color: 'rgb(var(--ink))', fontSize: 13 }}
                formatter={(v: number) => [formatMoney(v, currency), 'Received']}
              />
              <Bar dataKey="value" radius={[8, 8, 2, 2]} maxBarSize={44} className="cursor-pointer" animationDuration={700}>
                {chartData.map((b) => (
                  <Cell key={b.key} fill={selected === b.key ? 'rgb(var(--brass))' : 'url(#an)'} fillOpacity={selected !== null && selected !== b.key ? 0.35 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Breakdown title="By client" rows={groupTop('client')} total={total} />
        <Breakdown title="By project or subscription" rows={groupTop('item')} total={total} />
        <Breakdown title="By payment method" rows={groupTop('method').map(([k, v]) => [METHOD_LABEL[k as PaymentMethod] ?? k, v])} total={total} />
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="mb-3 font-display text-base font-semibold">{selected !== null ? `Payments, ${bucketTitle(range, selected)}` : `Payments, ${cfg.unit}`}</h2>
        {focus.length === 0 ? (
          <p className="text-sm text-muted">No payments in this period.</p>
        ) : (
          <ul className="divide-y divide-line">
            {[...focus]
              .sort((a, b) => b.at.localeCompare(a.at))
              .slice(0, 100)
              .map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2">
                      {p.kind === 'subscription' ? <Repeat className="h-4 w-4 text-accent-fg" /> : <FolderKanban className="h-4 w-4 text-accent-fg" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.item}</span>
                      <span className="block truncate text-xs text-muted">
                        {formatDate(p.at)}, {p.client}
                        {p.invoice && `, ${p.invoice}`}
                      </span>
                    </span>
                  </span>
                  <Money amount={p.usd} className="shrink-0 font-semibold" />
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, children, accent }: { label: string; value: React.ReactNode; children?: React.ReactNode; accent?: boolean }) {
  return (
    <div className={cn('rounded-2xl border bg-surface p-5', accent ? 'border-accent/40' : 'border-line')}>
      <p className="truncate text-sm text-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{value}</p>
      {children && <p className="mt-1.5 text-xs text-muted">{children}</p>}
    </div>
  );
}

function Split({ a, b }: { a: number; b: number }) {
  const t = a + b || 1;
  return (
    <span className="block">
      <span className="mb-1 flex h-1.5 overflow-hidden rounded-full bg-surface-2">
        <span className="bg-accent" style={{ width: `${(a / t) * 100}%` }} />
        <span className="bg-brass" style={{ width: `${(b / t) * 100}%` }} />
      </span>
      Subscriptions <Money amount={b} />
    </span>
  );
}

function Breakdown({ title, rows, total }: { title: string; rows: [string, number][]; total: number }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="mb-4 font-display text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet.</p>
      ) : (
        <ul className="grid gap-3">
          {rows.map(([k, v]) => (
            <li key={k}>
              <div className="mb-1 flex justify-between gap-3 text-sm">
                <span className="truncate">{k}</span>
                <Money amount={v} className="shrink-0 font-semibold" />
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${total ? (v / total) * 100 : 0}%` }} transition={{ duration: 0.6 }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
