'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, BellRing, CheckCircle2, ChevronRight, FileDown, FolderKanban, LogOut, Printer, Repeat } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { logout } from '@/lib/actions/auth';
import { convert, formatMoney, type Currency } from '@/lib/currency';
import { monthLabel } from '@/lib/periods';
import { matchesQuery } from '@/lib/search';
import { groupByMonth } from '@/lib/summary';
import { type PaymentRow, type PeriodRow, type ProjectRow, type SubscriptionRow } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import { CurrencySwitcher } from '../currency-switcher';
import { Money, PreferredCurrency, useCurrency } from '../currency-context';
import { ThemeToggle } from '../theme-toggle';
import { KindFilter, SearchBox } from '../admin/payments-explorer';
import { Rich, useI18n } from '../i18n';
import { LanguageSwitcher } from '../language-switcher';
import { BrandMark } from '../brand-mark';
import { Dialog, EmptyState, PaidBar, StatusBadge } from '../ui';

type View = 'billed' | 'paid' | 'pending';
const ease = [0.22, 1, 0.36, 1] as const;

/** Picks up changes you make in the admin (like ticking a month paid) without the client reloading. */
function useLiveRefresh(ms = 30000) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => !document.hidden && router.refresh();
    const t = setInterval(tick, ms);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [ms, router]);
}

export function PortalView({
  name,
  company,
  preferredCurrency,
  projects,
  subscriptions,
  payments,
  totals,
}: {
  name: string;
  company: string;
  preferredCurrency: Currency;
  projects: ProjectRow[];
  subscriptions: SubscriptionRow[];
  payments: PaymentRow[];
  totals: { billed: number; paid: number; pending: number };
}) {
  useLiveRefresh();
  const { t, fmt, locale, lang } = useI18n();
  const P = t.portal;
  const [view, setView] = useState<View | null>(null);
  const { currency } = useCurrency();
  const pct = totals.billed > 0 ? Math.round((totals.paid / totals.billed) * 100) : 0;
  const due = subscriptions.filter((s) => s.status === 'active' && s.current && s.current.status !== 'paid');
  const allPaidThisMonth = subscriptions.some((s) => s.status === 'active' && s.current) && due.length === 0;
  const hasAnything = projects.length > 0 || subscriptions.length > 0;

  return (
    <div className="min-h-screen">
      <PreferredCurrency value={preferredCurrency} />
      <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl">
        {/* Phones: title and buttons on one row, currencies on the next. Wider screens: one row. */}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-2 gap-y-3 px-4 py-3 sm:px-5">
          <p className="mr-auto flex items-center gap-2.5 font-display text-sm font-semibold">
            <BrandMark className="h-8 w-8" />
            {P.heading}
          </p>
          <CurrencySwitcher className="order-last w-full justify-between sm:order-none sm:w-auto" />
          <LanguageSwitcher />
          <ThemeToggle />
          <button onClick={() => window.print()} aria-label={P.print} className="hidden h-10 w-10 place-items-center rounded-full border border-line bg-surface text-muted hover:text-ink sm:grid">
            <Printer className="h-4 w-4" />
          </button>
          <form action={logout}>
            <button aria-label={P.signOut} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-muted hover:text-danger">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
          <p className="text-muted">
            {fmt(P.hello, { name: name.split(' ')[0]! })}
            {company && `, ${company}`}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {totals.pending > 0.5 ? (
              <>
                <Money amount={totals.pending} className="text-brass" /> {P.leftToPay}
              </>
            ) : hasAnything ? (
              P.paidUp
            ) : (
              P.nothingYet
            )}
          </h1>
        </motion.section>

        {/* Subscription alerts: animate while a month is unpaid, and calm down the moment it's marked paid */}
        <AnimatePresence initial={false}>
          {due.map((s) => (
            <DueAlert key={s.id} sub={s} period={s.current!} />
          ))}
        </AnimatePresence>
        {allPaidThisMonth && (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex items-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent-fg">
            <CheckCircle2 className="h-5 w-5 shrink-0" /> {fmt(P.allPaidMonth, { month: monthLabel(new Date().toISOString().slice(0, 7), 'long', locale) })}
          </motion.p>
        )}

        {hasAnything && (
          <section className="mt-8">
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryCard label={P.totalBilled} amount={totals.billed} onClick={() => setView('billed')} />
              <SummaryCard label={P.paidSoFar} amount={totals.paid} tone="paid" onClick={() => setView('paid')} />
              <SummaryCard label={P.pending} amount={totals.pending} tone="pending" onClick={() => setView('pending')} />
            </div>
            <div className="mt-4 rounded-2xl border border-line bg-surface px-5 py-4">
              <div className="mb-2 flex justify-between text-xs text-muted">
                <span>{fmt(P.pctPaid, { pct })}</span>
                <span>
                  {projects.length === 1 ? P.projectsCountOne : fmt(P.projectsCount, { n: projects.length })}
                  {subscriptions.length > 0 && `, ${subscriptions.length === 1 ? P.subsCountOne : fmt(P.subsCount, { n: subscriptions.length })}`}
                </span>
              </div>
              <PaidBar paid={totals.paid} total={totals.billed} />
              {[...projects.map((p) => p.currency), ...subscriptions.map((s) => s.currency)].some((c) => c !== currency) && (
                <p className="mt-3 text-xs text-muted">{fmt(P.mixed, { currency })}</p>
              )}
            </div>
          </section>
        )}

        {subscriptions.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 font-display text-xl font-semibold">{P.services}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {subscriptions.map((s, i) => (
                <SubscriptionPanel key={s.id} sub={s} index={i} />
              ))}
            </div>
          </section>
        )}

        <section className="mt-12">
          <h2 className="mb-4 font-display text-xl font-semibold">{P.projects}</h2>
          {projects.length === 0 ? (
            <EmptyState title={P.noProjects}>{P.noProjectsBody}</EmptyState>
          ) : (
            <div className="grid gap-4">
              {projects.map((p, i) => (
                <ProjectCard key={p.id} project={p} index={i} />
              ))}
            </div>
          )}
        </section>

        {payments.length > 0 && <PaymentHistory payments={payments} />}
        <p className="mt-12 text-center text-xs text-muted">{P.questions}</p>
      </main>

      <Breakdown view={view} onClose={() => setView(null)} projects={projects} subscriptions={subscriptions} payments={payments} />
    </div>
  );
}

function SummaryCard({ label, amount, tone, onClick }: { label: string; amount: number; tone?: 'paid' | 'pending'; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      className="group rounded-2xl border border-line bg-surface p-5 text-left transition-colors hover:border-accent/60"
    >
      <p className="text-sm text-muted">{label}</p>
      <p className={cn('mt-1 font-display text-2xl font-semibold tracking-tight', tone === 'paid' && 'text-accent-fg', tone === 'pending' && 'text-brass')}>
        <Money amount={amount} />
      </p>
      <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-muted transition-colors group-hover:text-accent-fg">
        {t.portal.seeWhat} <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </p>
    </motion.button>
  );
}

function DueAlert({ sub, period }: { sub: SubscriptionRow; period: PeriodRow }) {
  const overdue = period.status === 'overdue';
  const { t, fmt, locale, lang } = useI18n();
  const P = t.portal;
  const m = (n: number) => formatMoney(n, sub.currency, { locale: lang === 'en' ? undefined : locale });
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, scale: 0.97, height: 0 }}
      transition={{ duration: 0.4, ease }}
      className="mt-6 overflow-hidden"
    >
      <div role="status" className={cn('relative flex items-center gap-4 overflow-hidden rounded-2xl border p-4 sm:p-5', overdue ? 'border-danger/50 bg-danger/10' : 'border-brass/50 bg-brass/10')}>
        <span className="relative grid h-11 w-11 shrink-0 place-items-center">
          <span className={cn('absolute inset-0 animate-ping rounded-full opacity-40 motion-reduce:hidden', overdue ? 'bg-danger' : 'bg-brass')} />
          <span className={cn('relative grid h-11 w-11 place-items-center rounded-full', overdue ? 'bg-danger text-white' : 'bg-brass text-black')}>
            <motion.span animate={{ rotate: [0, -16, 14, -10, 6, 0] }} transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 1.6 }}>
              <BellRing className="h-5 w-5" />
            </motion.span>
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-heading">{fmt(overdue ? P.alertOverdue : P.alertDue, { month: monthLabel(period.period, 'long', locale), name: sub.name })}</p>
          <p className="text-sm text-muted">
            {fmt(overdue ? P.alertOverdueBody : P.alertDueBody, { amount: m(period.remaining), date: formatDate(period.dueDate, { day: 'numeric', month: 'long' }, locale) })}
            {period.status === 'partial' && fmt(P.alreadyReceived, { amount: m(period.paid) })}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

const dot: Record<PeriodRow['status'], string> = {
  paid: 'bg-accent',
  partial: 'bg-brass',
  due: 'bg-surface-2 ring-1 ring-line',
  overdue: 'bg-danger',
};

function SubscriptionPanel({ sub, index }: { sub: SubscriptionRow; index: number }) {
  const { t, fmt, locale, lang } = useI18n();
  const P = t.portal;
  const cur = sub.current;
  const ml = (k: string) => monthLabel(k, 'short', locale);
  const paid = cur?.status === 'paid';
  const recent = sub.periods.slice(0, 6).reverse();
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.06, duration: 0.5 }}
      className={cn('relative overflow-hidden rounded-2xl border bg-surface p-5 sm:p-6', cur && !paid && sub.status === 'active' ? 'border-brass/60' : 'border-line')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Repeat className="h-4 w-4 shrink-0 text-accent-fg" />
            {sub.name}
          </h3>
          <p className="mt-1 text-sm text-muted">
            <Rich text={P.perMonth} values={{ amount: <Money amount={sub.amount} from={sub.currency} /> }} />
            {sub.status === 'ended' && fmt(P.endedOn, { month: ml(sub.endMonth!) })}
          </p>
        </div>
        {cur && sub.status === 'active' && (
          <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold', paid ? 'bg-accent/15 text-accent-fg' : cur.status === 'overdue' ? 'bg-danger/15 text-danger' : 'bg-brass/15 text-brass')}>
            {paid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
            {paid
              ? fmt(P.monthPaid, { month: ml(cur.period) })
              : cur.status === 'overdue'
                ? fmt(P.monthOverdue, { month: ml(cur.period) })
                : fmt(P.monthDue, { month: ml(cur.period), date: formatDate(cur.dueDate, { day: 'numeric', month: 'short' }, locale) })}
          </span>
        )}
      </div>
      {sub.description && <p className="mt-3 text-sm leading-relaxed text-muted">{(lang !== 'en' && sub.translations?.[lang]?.description?.trim()) || sub.description}</p>}
      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold text-muted">{P.recentMonths}</p>
        <ol className="flex gap-2">
          {recent.map((p) => (
            <li key={p.period} className="flex flex-1 flex-col items-center gap-1.5" title={`${ml(p.period)}: ${p.status === 'paid' ? P.paidFor : p.status === 'partial' ? P.partPaid : p.status === 'overdue' ? P.overdue : P.due}`}>
              <span className={cn('h-2.5 w-full rounded-full', dot[p.status])} />
              <span className="text-[11px] capitalize text-muted">{new Date(`${p.period}-01T00:00:00Z`).toLocaleString(locale, { month: 'short', timeZone: 'UTC' })}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-4 text-xs text-muted">
        <PaidLine paid={sub.paid} pending={sub.pending} currency={sub.currency} />
      </p>
    </motion.article>
  );
}

function ProjectCard({ project: p, index }: { project: ProjectRow; index: number }) {
  const { t, fmt, locale } = useI18n();
  const P = t.portal;
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.06, duration: 0.5 }}
      className="rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent/50 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">{p.name}</h3>
          <p className="mt-1 text-xs text-muted">
            {fmt(P.started, { date: formatDate(p.startDate, undefined, locale) })}
            {p.deliveredAt && fmt(P.delivered, { date: formatDate(p.deliveredAt, undefined, locale) })}
            {fmt(P.billedIn, { currency: p.currency })}
          </p>
        </div>
        <StatusBadge status={p.status} />
      </div>
      {p.stack.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {p.stack.map((s) => (
            <li key={s} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
              {s}
            </li>
          ))}
        </ul>
      )}
      <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted">{P.cost}</dt>
          <dd className="font-semibold">
            <Money amount={p.totalCost} from={p.currency} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{P.paidSoFar}</dt>
          <dd className="font-semibold text-accent-fg">
            <Money amount={p.paid} from={p.currency} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{p.overpaid > 0 ? P.credit : P.pending}</dt>
          <dd className="font-semibold text-brass">
            <Money amount={p.overpaid > 0 ? p.overpaid : p.pending} from={p.currency} />
          </dd>
        </div>
      </dl>
      <div className="mt-4">
        <PaidBar paid={p.paid} total={p.totalCost} />
      </div>
      {(p.liveUrl || p.previewUrl) && (
        <div className="no-print mt-5 flex flex-wrap gap-2">
          {[
            [p.liveUrl, P.openLive],
            [p.previewUrl, P.openPreview],
          ]
            .filter(([href]) => href)
            .map(([href, label]) => (
              <a key={href} href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold hover:border-accent hover:text-accent-fg">
                {label} <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            ))}
        </div>
      )}
    </motion.article>
  );
}

function PaymentHistory({ payments }: { payments: PaymentRow[] }) {
  const { t, fmt, locale } = useI18n();
  const P = t.portal;
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | 'project' | 'subscription'>('all');
  const filtered = useMemo(() => payments.filter((p) => (kind === 'all' || p.kind === kind) && matchesQuery(p, q)), [payments, q, kind]);
  const months = groupByMonth(filtered);
  return (
    <section className="mt-12">
      <h2 className="mb-4 font-display text-xl font-semibold">{P.history}</h2>
      <div className="no-print mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBox value={q} onChange={setQ} placeholder={P.searchPh} />
        <KindFilter value={kind} onChange={setKind} />
      </div>
      {months.length === 0 ? (
        <EmptyState title={P.noMatch}>{P.noMatchBody}</EmptyState>
      ) : (
        <div className="grid gap-4">
          {months.map((m) => (
            <div key={m.key} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="flex items-center justify-between gap-3 bg-surface-2/60 px-5 py-3">
                <p className="text-sm font-semibold capitalize">{monthLabel(m.key, 'long', locale)}</p>
                <p className="text-xs text-muted">{m.items.length === 1 ? P.paymentsCountOne : fmt(P.paymentsCount, { n: m.items.length })}</p>
              </div>
              <ul className="divide-y divide-line">
                <AnimatePresence initial={false}>
                  {m.items.map((p) => (
                    <motion.li
                      key={p.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-3 px-5 py-4"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2">
                        {p.kind === 'subscription' ? <Repeat className="h-4 w-4 text-accent-fg" /> : <FolderKanban className="h-4 w-4 text-accent-fg" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{p.projectName}</p>
                        <p className="truncate text-xs text-muted">
                          {formatDate(p.paidAt, undefined, locale)}, {t.methods[p.method]}
                          {p.reference && `, ${p.reference}`}
                        </p>
                        {p.note && <p className="mt-0.5 truncate text-xs text-muted">{p.note}</p>}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm font-bold tabular-nums text-accent-fg">{formatMoney(p.amount, p.currency, { locale: locale.startsWith('en') ? undefined : locale })}</span>
                        {p.invoice && (
                          <a
                            href={`/api/invoices/${p.invoice.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 font-mono text-[11px] font-semibold text-muted transition-colors hover:border-accent hover:text-accent-fg"
                          >
                            <FileDown className="h-3 w-3" /> {p.invoice.number}
                          </a>
                        )}
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Opens from the Total, Paid and Pending cards. Pick a month to see exactly what was paid for what. */
function Breakdown({
  view,
  onClose,
  projects,
  subscriptions,
  payments,
}: {
  view: View | null;
  onClose: () => void;
  projects: ProjectRow[];
  subscriptions: SubscriptionRow[];
  payments: PaymentRow[];
}) {
  const [month, setMonth] = useState<string>('all');
  const { rates } = useCurrency();
  const { t, fmt, locale } = useI18n();
  const B = t.portal.breakdown;
  const months = useMemo(() => [...new Set(payments.map((p) => p.paidAt.slice(0, 7)))].sort().reverse(), [payments]);
  const inMonth = (p: PaymentRow) => month === 'all' || p.paidAt.startsWith(month);
  const paidFor = (id: string) => payments.filter((p) => p.projectId === id && inMonth(p)).reduce((t, p) => t + p.amountInProjectCurrency, 0);
  const items = [
    ...projects.map((p) => ({ id: p.id, name: p.name, sub: false, currency: p.currency, billed: p.totalCost, pending: p.pending, paidInMonth: paidFor(p.id), unpaid: [] as string[] })),
    ...subscriptions.map((s) => ({
      id: s.id,
      name: s.name,
      sub: true,
      currency: s.currency,
      billed: s.billed,
      pending: s.pending,
      paidInMonth: paidFor(s.id),
      unpaid: s.periods.filter((p) => p.status !== 'paid').map((p) => monthLabel(p.period, 'short', locale)),
    })),
  ].filter((i) => (view === 'pending' ? i.pending > 0 : view === 'paid' ? i.paidInMonth > 0 : true));
  if (!view) return null;
  const { title, description } = B[view];
  // Items can be in different currencies, so the total is summed in USD and shown in the viewer's currency.
  const totalUSD = items.reduce((t, i) => t + convert(view === 'billed' ? i.billed : view === 'paid' ? i.paidInMonth : i.pending, i.currency, 'USD', rates), 0);
  const periodName = month === 'all' ? B.allTimeLower : monthLabel(month, 'long', locale);

  return (
    <Dialog open onClose={onClose} title={title} description={description} wide>
      <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1" data-lenis-prevent>
        {['all', ...months].map((m) => (
          <button
            key={m}
            onClick={() => setMonth(m)}
            className={cn('shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors', month === m ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted hover:text-ink')}
          >
            {m === 'all' ? B.allTime : monthLabel(m, 'short', locale)}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{view === 'paid' ? fmt(B.noPaid, { period: periodName }) : view === 'pending' ? B.noPending : B.noBilled}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {items.map((i) => (
            <li key={i.id} className="min-w-0 rounded-xl border border-line p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="flex min-w-0 items-center gap-2 font-semibold">
                  {i.sub ? <Repeat className="h-4 w-4 shrink-0 text-accent-fg" /> : <FolderKanban className="h-4 w-4 shrink-0 text-accent-fg" />}
                  <span className="truncate">{i.name}</span>
                </p>
                <span className={cn('shrink-0 font-display text-lg font-semibold', view === 'paid' && 'text-accent-fg', view === 'pending' && 'text-brass')}>
                  <Money amount={view === 'billed' ? i.billed : view === 'paid' ? i.paidInMonth : i.pending} from={i.currency} />
                </span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs text-muted min-[420px]:grid-cols-2 sm:grid-cols-3">
                {view !== 'billed' && (
                  <span>
                    {i.sub ? B.billedSoFar : B.totalCost}: <Money amount={i.billed} from={i.currency} className="font-semibold text-ink" />
                  </span>
                )}
                {view !== 'paid' && (
                  <span>
                    {fmt(B.paidIn, { period: periodName })}: <Money amount={i.paidInMonth} from={i.currency} className="font-semibold text-accent-fg" />
                  </span>
                )}
                {view !== 'pending' && (
                  <span>
                    {B.pendingLabel}: <Money amount={i.pending} from={i.currency} className="font-semibold text-brass" />
                  </span>
                )}
              </div>
              {view === 'pending' && i.unpaid.length > 0 && <p className="mt-2 text-xs text-muted">{fmt(B.unpaidMonths, { months: i.unpaid.join(', ') })}</p>}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
        <span className="text-sm font-semibold">{view === 'paid' ? fmt(B.totalPaid, { period: periodName }) : view === 'pending' ? B.totalPending : B.totalBilled}</span>
        <span className={cn('font-display text-xl font-bold', view === 'paid' && 'text-accent-fg', view === 'pending' && 'text-brass')}>
          <Money amount={totalUSD} />
        </span>
      </div>
    </Dialog>
  );
}

function PaidLine({ paid, pending, currency }: { paid: number; pending: number; currency: Currency }) {
  const { t } = useI18n();
  return (
    <>
      <Rich text={t.portal.paidOutstanding} values={{ paid: <Money amount={paid} from={currency} className="font-semibold text-accent-fg" /> }} />
      {pending > 0 && <Rich text={t.portal.outstanding} values={{ amount: <Money amount={pending} from={currency} className="font-semibold text-brass" /> }} />}
    </>
  );
}
