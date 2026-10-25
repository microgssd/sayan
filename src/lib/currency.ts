export const CURRENCIES = ['USD', 'CAD', 'INR', 'EUR', 'AUD'] as const;
export type Currency = (typeof CURRENCIES)[number];
/** Units of each currency per 1 USD. */
export type Rates = Record<Currency, number>;

/** Used only when the live rates API is unreachable. */
export const FALLBACK_RATES: Rates = { USD: 1, CAD: 1.38, INR: 84.5, EUR: 0.92, AUD: 1.53 };

export const CURRENCY_META: Record<Currency, { label: string; locale: string }> = {
  USD: { label: 'US dollar', locale: 'en-US' },
  CAD: { label: 'Canadian dollar', locale: 'en-US' },
  INR: { label: 'Indian rupee', locale: 'en-IN' },
  EUR: { label: 'Euro', locale: 'en-US' },
  AUD: { label: 'Australian dollar', locale: 'en-US' },
};

export function isCurrency(v: unknown): v is Currency {
  return typeof v === 'string' && (CURRENCIES as readonly string[]).includes(v);
}

export function convert(amount: number, from: Currency, to: Currency, rates: Rates) {
  if (from === to) return amount;
  return (amount / rates[from]) * rates[to];
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function formatMoney(amount: number, currency: Currency, opts: { compact?: boolean; locale?: string } = {}) {
  const whole = Number.isInteger(round2(amount));
  // en-US with symbol display gives unambiguous CA$, A$, € and $.
  return new Intl.NumberFormat(opts.locale ?? CURRENCY_META[currency].locale, {
    style: 'currency',
    currency,
    notation: opts.compact ? 'compact' : 'standard',
    minimumFractionDigits: opts.compact || whole ? 0 : 2,
    maximumFractionDigits: opts.compact ? 1 : 2,
  }).format(amount);
}
