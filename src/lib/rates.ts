import 'server-only';
import { CURRENCIES, FALLBACK_RATES, type Rates } from './currency';

export type RatesInfo = { rates: Rates; updatedAt: string; live: boolean };

/** Live FX rates (base USD), cached by Next for 6 hours. Falls back to static rates. */
export async function getRates(): Promise<RatesInfo> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { next: { revalidate: 60 * 60 * 6 } });
    if (!res.ok) throw new Error(`Rates API ${res.status}`);
    const data = await res.json();
    const rates = Object.fromEntries(CURRENCIES.map((c) => [c, Number(data?.rates?.[c])])) as Rates;
    if (CURRENCIES.some((c) => !Number.isFinite(rates[c]) || rates[c] <= 0)) throw new Error('Incomplete rates');
    return { rates, updatedAt: data.time_last_update_utc ?? new Date().toUTCString(), live: true };
  } catch {
    return { rates: FALLBACK_RATES, updatedAt: 'offline fallback', live: false };
  }
}
