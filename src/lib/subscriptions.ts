import { connectDB } from './db';
import { Subscription } from './models/Subscription';
import { Payment } from './models/Payment';
import { round2 } from './currency';
import { dueDateOf, monthKey, monthLabel, monthsBetween, priceFor } from './periods';
import type { ClientLite, PeriodRow, SubscriptionRow } from './types';


/** Subscriptions with the status of every billed month. */
export async function loadSubscriptions(opts: { clientId?: string } = {}): Promise<SubscriptionRow[]> {
  await connectDB();
  const subs: any[] = await Subscription.find(opts.clientId ? { client: opts.clientId } : {})
    .populate('client', 'name email company')
    .sort({ status: 1, createdAt: -1 })
    .lean();
  const payments: any[] = await Payment.find({ subscription: { $in: subs.map((s) => s._id) } }).lean();
  const now = new Date();
  const thisMonth = monthKey(now);

  return subs.map((s) => {
    const last = s.endMonth && s.endMonth < thisMonth ? s.endMonth : thisMonth;
    const months = s.startMonth <= last ? monthsBetween(s.startMonth, last) : [];
    const mine = payments.filter((p) => String(p.subscription) === String(s._id));
    const periods: PeriodRow[] = months
      .map((period) => {
        const ps = mine.filter((p) => p.period === period);
        const paid = round2(ps.reduce((t, p) => t + p.amountInProjectCurrency, 0));
        const price = priceFor(s, period);
        const remaining = round2(Math.max(price - paid, 0));
        const due = dueDateOf(period, s.dueDay);
        const status: PeriodRow['status'] = remaining <= 0.009 ? 'paid' : paid > 0 ? 'partial' : now > due ? 'overdue' : 'due';
        return { period, label: monthLabel(period), dueDate: due.toISOString(), price, paid, remaining, status, paymentIds: ps.map((p) => String(p._id)) };
      })
      .reverse();
    const client: ClientLite | null = s.client?._id
      ? { id: String(s.client._id), name: s.client.name, email: s.client.email, company: s.client.company ?? '' }
      : null;
    const paid = round2(periods.reduce((t, p) => t + p.paid, 0));
    const billed = round2(periods.reduce((t, p) => t + p.price, 0));
    return {
      id: String(s._id),
      name: s.name,
      description: s.description ?? '',
      amount: s.amount,
      currency: s.currency,
      dueDay: s.dueDay,
      startMonth: s.startMonth,
      endMonth: s.endMonth ?? null,
      status: s.status,
      translations: s.translations ?? {},
      client,
      periods,
      current: periods.find((p) => p.period === thisMonth) ?? null,
      billed,
      paid,
      pending: round2(periods.reduce((t, p) => t + p.remaining, 0)),
      unpaidCount: periods.filter((p) => p.status !== 'paid').length,
    };
  });
}
