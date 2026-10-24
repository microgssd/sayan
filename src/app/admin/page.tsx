import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { loadAllPayments, loadClients, loadLedger } from '@/lib/ledger';
import { loadSubscriptions } from '@/lib/subscriptions';
import { getRates } from '@/lib/rates';
import { monthlyUSD, totalsUSD } from '@/lib/summary';
import { PageHeader } from '@/components/admin/shell';
import { Stat } from '@/components/admin/stat';
import { RevenueChart } from '@/components/admin/revenue-chart';
import { PaymentDialog } from '@/components/admin/payment-dialog';
import { PaymentsTable } from '@/components/admin/tables';
import { toOptions } from '@/lib/options';
import { Money } from '@/components/currency-context';
import { EmptyState, PaidBar } from '@/components/ui';
import { convert } from '@/lib/currency';

export default async function Overview() {
  await requireAdmin();
  const [projects, clients, subs, payments, { rates }] = await Promise.all([loadLedger(), loadClients(), loadSubscriptions(), loadAllPayments(), getRates()]);
  const projectTotals = totalsUSD(projects, rates);
  const usd = (n: number, c: (typeof subs)[number]['currency']) => convert(n, c, 'USD', rates);
  const totals = {
    billed: projectTotals.billed + subs.reduce((t, s) => t + usd(s.billed, s.currency), 0),
    paid: projectTotals.paid + subs.reduce((t, s) => t + usd(s.paid, s.currency), 0),
    pending: projectTotals.pending + subs.reduce((t, s) => t + usd(s.pending, s.currency), 0),
  };
  const activeSubs = subs.filter((s) => s.status === 'active');
  const mrr = activeSubs.reduce((t, s) => t + usd(s.amount, s.currency), 0);
  const unpaidThisMonth = activeSubs.filter((s) => s.current && s.current.status !== 'paid').length;
  const months = monthlyUSD(payments, rates);
  const thisMonth = months.at(-1)?.usd ?? 0;
  const outstanding = projects
    .filter((p) => p.pending > 0)
    .sort((a, b) => convert(b.pending, b.currency, 'USD', rates) - convert(a.pending, a.currency, 'USD', rates))
    .slice(0, 6);
  const options = toOptions(projects);

  return (
    <>
      <PageHeader title="Overview" description="Everything you’ve billed, received and are still owed.">
        <PaymentDialog projects={options} />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Total billed" usd={totals.billed} sub={`${projects.length} projects, ${subs.length} subscriptions`} />
        <Stat label="Received" usd={totals.paid} tone="accent" delay={0.05} sub={`${payments.length} payments`} />
        <Stat label="Outstanding" usd={totals.pending} tone="brass" delay={0.1} sub={`${outstanding.length ? 'Across ' + projects.filter((p) => p.pending > 0).length + ' projects' : 'All settled'}`} />
        <Stat label="Received this month" usd={thisMonth} delay={0.15} sub={`${clients.filter((c) => c.active).length} active clients`} />
        <Stat
          label="Monthly recurring"
          usd={mrr}
          tone="accent"
          delay={0.2}
          sub={activeSubs.length ? `${activeSubs.length} subscriptions, ${unpaidThisMonth ? `${unpaidThisMonth} unpaid this month` : 'all paid this month'}` : 'No subscriptions yet'}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-base font-semibold">Money received, last 12 months</h2>
            <Link href="/admin/analytics" className="text-sm font-semibold text-accent-fg hover:underline">
              Full analytics
            </Link>
          </div>
          <p className="mt-1 text-xs text-muted">The current month is shown in gold.</p>
          <RevenueChart data={months} />
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="mb-4 font-display text-base font-semibold">Largest balances owed</h2>
          {outstanding.length ? (
            <ul className="grid gap-4">
              {outstanding.map((p) => (
                <li key={p.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">
                      <span className="font-semibold">{p.name}</span>
                      {p.client && (
                        <Link href={`/admin/clients/${p.client.id}`} className="ml-2 text-muted hover:text-accent-fg">
                          {p.client.name}
                        </Link>
                      )}
                    </span>
                    <Money amount={p.pending} from={p.currency} className="shrink-0 font-semibold text-brass" />
                  </div>
                  <PaidBar paid={p.paid} total={p.totalCost} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing outstanding. Every project is fully paid.</p>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">Recent payments</h2>
          <Link href="/admin/payments" className="text-sm font-semibold text-accent-fg hover:underline">
            All payments
          </Link>
        </div>
        {payments.length ? (
          <PaymentsTable payments={payments.slice(0, 8)} projects={options} />
        ) : (
          <EmptyState title="No payments recorded">Add a client and a project, then record the first payment here.</EmptyState>
        )}
      </section>
    </>
  );
}
