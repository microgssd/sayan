// Calendar-month helpers for subscriptions. All in UTC so a month means the same thing everywhere.

export const monthKey = (d: Date = new Date()) => d.toISOString().slice(0, 7);

export const monthLabel = (key: string, style: 'short' | 'long' = 'short', locale = 'en-US') =>
  new Date(`${key}-01T00:00:00Z`).toLocaleString(locale, { month: style, year: 'numeric', timeZone: 'UTC' });

export function addMonths(key: string, n: number) {
  const [y, m] = key.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return monthKey(d);
}

/** Every month from start to end inclusive. */
export function monthsBetween(start: string, end: string) {
  const out: string[] = [];
  for (let k = start; k <= end && out.length < 600; k = addMonths(k, 1)) out.push(k);
  return out;
}

/** The monthly price in force for a given month. */
export function priceFor(sub: { amount: number; priceHistory?: { from?: string | null; amount?: number | null }[] | null }, period: string) {
  const hit = (sub.priceHistory ?? [])
    .filter((h) => h.from && h.from <= period && typeof h.amount === 'number')
    .sort((a, b) => a.from!.localeCompare(b.from!))
    .pop();
  return hit?.amount ?? sub.amount;
}

export const dueDateOf = (key: string, dueDay: number) => new Date(`${key}-${String(dueDay).padStart(2, '0')}T23:59:59Z`);
