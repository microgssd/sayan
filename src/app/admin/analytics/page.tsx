import { requireAdmin } from '@/lib/auth';
import { loadAllPayments } from '@/lib/ledger';
import { loadSubscriptions } from '@/lib/subscriptions';
import { getRates } from '@/lib/rates';
import { convert } from '@/lib/currency';
import { PageHeader } from '@/components/admin/shell';
import { Analytics, type AnalyticsPayment } from '@/components/admin/analytics';

export default async function AnalyticsPage() {
  await requireAdmin();
  const [payments, subs, { rates }] = await Promise.all([loadAllPayments(), loadSubscriptions(), getRates()]);
  // Every payment is normalised to USD here (in its own item currency first), then shown in whatever currency you pick.
  const rows: AnalyticsPayment[] = payments.map((p) => ({
    id: p.id,
    at: p.paidAt,
    usd: convert(p.amountInProjectCurrency, p.projectCurrency, 'USD', rates),
    kind: p.kind,
    item: p.projectName,
    client: p.clientName ?? 'Personal',
    method: p.method,
    invoice: p.invoice?.number ?? '',
  }));
  const active = subs.filter((s) => s.status === 'active');
  const mrr = active.reduce((t, s) => t + convert(s.amount, s.currency, 'USD', rates), 0);
  return (
    <>
      <PageHeader title="Analytics" description="What you were paid, day by day, week by week, month by month and year by year." />
      <Analytics payments={rows} mrrUSD={mrr} activeSubs={active.length} />
    </>
  );
}
