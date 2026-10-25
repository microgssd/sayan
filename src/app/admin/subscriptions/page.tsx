import { requireAdmin } from '@/lib/auth';
import { loadClients } from '@/lib/ledger';
import { loadSubscriptions } from '@/lib/subscriptions';
import { getRates } from '@/lib/rates';
import { convert } from '@/lib/currency';
import { PageHeader } from '@/components/admin/shell';
import { Stat } from '@/components/admin/stat';
import { SubscriptionCard, SubscriptionDialog } from '@/components/admin/subscriptions';
import { EmptyState } from '@/components/ui';

export default async function SubscriptionsPage() {
  await requireAdmin();
  const [subs, clients, { rates }] = await Promise.all([loadSubscriptions(), loadClients(), getRates()]);
  const active = subs.filter((s) => s.status === 'active');
  const mrr = active.reduce((t, s) => t + convert(s.amount, s.currency, 'USD', rates), 0);
  const dueNow = active.filter((s) => s.current && s.current.status !== 'paid');
  const outstanding = subs.reduce((t, s) => t + convert(s.pending, s.currency, 'USD', rates), 0);
  const lite = clients.map(({ id, name, email, company }) => ({ id, name, email, company }));

  return (
    <>
      <PageHeader title="Subscriptions" description="Monthly services. Click a month to mark it paid; the client’s alert stops automatically.">
        <SubscriptionDialog clients={lite} />
      </PageHeader>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Monthly recurring" usd={mrr} tone="accent" sub={`${active.length} active subscription${active.length === 1 ? '' : 's'}`} />
        <Stat label="Unpaid this month" count={dueNow.length} tone="brass" delay={0.05} sub={dueNow.length ? dueNow.map((s) => s.client?.name).filter(Boolean).slice(0, 3).join(', ') : 'Everyone is paid up'} />
        <Stat label="Outstanding on subscriptions" usd={outstanding} delay={0.1} />
      </div>
      {subs.length === 0 ? (
        <EmptyState title="No subscriptions yet">Create one for any service you bill monthly, like social media management, hosting or maintenance.</EmptyState>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {subs.map((s) => (
            <SubscriptionCard key={s.id} sub={s} clients={lite} />
          ))}
        </div>
      )}
    </>
  );
}
