import { connectDB } from './db';
import { Subscription } from './models/Subscription';
import { Payment } from './models/Payment';
import { round2 } from './currency';
import { dueDateOf, monthKey, monthLabel, monthsBetween, priceFor } from './periods';
import { Plan } from './models/Plan';
import { Project } from './models/Project';
import './models/User';
import { deriveSiteState } from './site-state';
import { CURRENCIES } from './currency';
import type { ClientLite, PeriodRow, PlanRow, SubscriptionRow, WaasInfo } from './types';

/** Every billed month of a subscription with what's paid, what's left and whether it's overdue. Newest first. */
export function buildPeriods(s: any, payments: any[], now = new Date()): PeriodRow[] {
  const thisMonth = monthKey(now);
  const last = s.endMonth && s.endMonth < thisMonth ? s.endMonth : thisMonth;
  const months = s.startMonth <= last ? monthsBetween(s.startMonth, last) : [];
  const mine = payments.filter((p) => String(p.subscription) === String(s._id));
  return months
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
}

export function planRow(p: any): PlanRow {
  const prices: PlanRow['prices'] = {};
  for (const c of CURRENCIES) if (typeof p.prices?.[c] === 'number' && p.prices[c] > 0) prices[c] = p.prices[c];
  return {
    id: String(p._id),
    name: p.name,
    description: p.description ?? '',
    features: p.features ?? [],
    prices,
    graceDays: p.graceDays ?? 7,
    active: p.active !== false,
    translations: p.translations ?? {},
  };
}

export function waasInfo(s: any, periods: PeriodRow[], plan: PlanRow | null, projectName: string, now = new Date()): WaasInfo {
  const st = deriveSiteState({ periods, graceDays: s.graceDays ?? 7, graceUntil: s.graceUntil ?? null, override: s.siteOverride ?? 'none', now });
  const a = s.autopay ?? {};
  return {
    enabled: !!s.waas,
    plan,
    projectId: s.project ? String(s.project) : null,
    projectName,
    siteUrl: s.siteUrl ?? '',
    siteStatus: s.waas && s.status === 'active' ? st.status : 'active',
    override: s.siteOverride ?? 'none',
    graceDays: s.graceDays ?? 7,
    graceUntil: s.graceUntil ? new Date(s.graceUntil).toISOString() : null,
    lateDays: st.lateDays,
    suspendOn: st.suspendOn ? st.suspendOn.toISOString() : null,
    amountDue: st.amountDue,
    autopay: {
      status: a.status ?? 'none',
      method: a.method ?? '',
      methodNote: a.methodNote ?? '',
      nextChargeAt: a.nextChargeAt ? new Date(a.nextChargeAt).toISOString() : null,
      lastFailure: a.lastFailure ?? '',
      lastFailureAt: a.lastFailureAt ? new Date(a.lastFailureAt).toISOString() : null,
      retryCount: a.retryCount ?? 0,
    },
    siteKey: s.siteKey ?? '',
    payKey: s.payKey ?? '',
  };
}


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

  const planDocs: any[] = await Plan.find({ _id: { $in: subs.map((s) => s.plan).filter(Boolean) } }).lean();
  const projectDocs: any[] = await Project.find({ _id: { $in: subs.map((s) => s.project).filter(Boolean) } }).select('name').lean();

  return subs.map((s) => {
    const periods = buildPeriods(s, payments, now);
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
      waas: waasInfo(
        s,
        periods,
        s.plan ? (planDocs.find((p) => String(p._id) === String(s.plan)) ? planRow(planDocs.find((p) => String(p._id) === String(s.plan))) : null) : null,
        projectDocs.find((p) => String(p._id) === String(s.project))?.name ?? '',
        now,
      ),
      periods,
      current: periods.find((p) => p.period === thisMonth) ?? null,
      billed,
      paid,
      pending: round2(periods.reduce((t, p) => t + p.remaining, 0)),
      unpaidCount: periods.filter((p) => p.status !== 'paid').length,
    };
  });
}
