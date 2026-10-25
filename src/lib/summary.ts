import { convert, type Rates } from './currency';
import type { PaymentRow, ProjectRow } from './types';

/** Totals across projects in mixed currencies, normalised to USD at today's rate. */
export function totalsUSD(projects: ProjectRow[], rates: Rates) {
  return projects.reduce(
    (t, p) => ({
      billed: t.billed + convert(p.totalCost, p.currency, 'USD', rates),
      paid: t.paid + convert(p.paid, p.currency, 'USD', rates),
      pending: t.pending + convert(p.pending, p.currency, 'USD', rates),
    }),
    { billed: 0, paid: 0, pending: 0 },
  );
}

export type MonthBucket = { key: string; label: string; usd: number };

export function monthlyUSD(payments: PaymentRow[], rates: Rates, months = 12): MonthBucket[] {
  const now = new Date();
  const buckets: MonthBucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    buckets.push({
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      usd: 0,
    });
  }
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const p of payments) {
    const i = index.get(p.paidAt.slice(0, 7));
    if (i !== undefined) buckets[i]!.usd += convert(p.amountInProjectCurrency, p.projectCurrency, 'USD', rates);
  }
  return buckets;
}

export type MonthGroup = { key: string; label: string; items: PaymentRow[] };

export function groupByMonth(payments: PaymentRow[]): MonthGroup[] {
  const map = new Map<string, PaymentRow[]>();
  for (const p of [...payments].sort((a, b) => b.paidAt.localeCompare(a.paidAt))) {
    const k = p.paidAt.slice(0, 7);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(p);
  }
  return [...map.entries()].map(([key, items]) => ({
    key,
    label: new Date(`${key}-01T00:00:00Z`).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    items,
  }));
}
