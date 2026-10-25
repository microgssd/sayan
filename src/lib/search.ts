import type { PaymentRow } from './types';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/**
 * Everything a payment can be found by: invoice number, item, client, method, reference,
 * and its date written every common way (2026-10-23, 23/10/2026, 23 oct 2026, october 2026 …).
 */
export function paymentHaystack(p: PaymentRow) {
  const d = new Date(p.paidAt);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  const month = MONTHS[d.getUTCMonth()]!;
  return [
    p.invoice?.number,
    p.projectName,
    p.clientName,
    p.method,
    p.reference,
    p.note,
    p.kind === 'subscription' ? 'subscription monthly' : 'project',
    `${yyyy}-${mm}-${dd}`,
    `${dd}/${mm}/${yyyy}`,
    `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${yyyy}`,
    `${d.getUTCDate()} ${month} ${yyyy}`,
    `${d.getUTCDate()} ${month.slice(0, 3)} ${yyyy}`,
    `${month} ${yyyy}`,
    `${month.slice(0, 3)} ${yyyy}`,
  ]
    .filter(Boolean)
    .join(' | ')
    .toLowerCase();
}

/** Every word in the query must appear somewhere (so "oct lotus" finds Lotus payments in October). */
export function matchesQuery(p: PaymentRow, query: string) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = paymentHaystack(p);
  return words.every((w) => hay.includes(w));
}
