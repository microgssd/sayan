import type { SiteStatus } from './types';

const DAY = 86_400_000;

export type SiteState = {
  status: SiteStatus;
  lateDays: number; // days since the oldest unpaid due date (0 when nothing is overdue)
  dueAt: Date | null; // end of the oldest unpaid due day
  suspendOn: Date | null; // when the site goes offline if it stays unpaid
  amountDue: number;
  overduePeriods: string[];
};

/**
 * The one rule for when a website is online, in grace, or suspended. It is worked out from what is unpaid right now,
 * not stored, so a payment (from Cashfree, a bank transfer you tick off, anything) restores the site the moment it is recorded.
 *
 *  - Nothing overdue: active.
 *  - Overdue, within the grace period (default 7 days after the due day): grace.
 *  - Overdue past the grace period: suspended. Extending grace moves that date.
 *  - You can also suspend a site by hand (override), which holds until you restore it.
 */
export function deriveSiteState(opts: {
  periods: { period: string; dueDate: string; remaining: number }[];
  graceDays: number;
  graceUntil?: Date | null;
  override?: 'none' | 'suspend';
  now?: Date;
}): SiteState {
  const now = opts.now ?? new Date();
  const unpaid = opts.periods
    .filter((p) => p.remaining > 0.009 && new Date(p.dueDate) < now)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const amountDue = Math.round(unpaid.reduce((t, p) => t + p.remaining, 0) * 100) / 100;
  const dueAt = unpaid[0] ? new Date(unpaid[0].dueDate) : null;
  let suspendOn = dueAt ? new Date(dueAt.getTime() + opts.graceDays * DAY) : null;
  if (suspendOn && opts.graceUntil && opts.graceUntil > suspendOn) suspendOn = opts.graceUntil;
  const lateDays = dueAt ? Math.max(1, Math.floor((now.getTime() - dueAt.getTime()) / DAY) + 1) : 0;
  let status: SiteStatus = 'active';
  if (opts.override === 'suspend') status = 'suspended';
  else if (dueAt && suspendOn) status = now >= suspendOn ? 'suspended' : 'grace';
  return { status, lateDays, dueAt, suspendOn, amountDue, overduePeriods: unpaid.map((p) => p.period) };
}
