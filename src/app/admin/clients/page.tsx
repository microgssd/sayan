import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { loadClients, loadLedger } from '@/lib/ledger';
import { getRates } from '@/lib/rates';
import { totalsUSD } from '@/lib/summary';
import { PageHeader } from '@/components/admin/shell';
import { ClientDialog } from '@/components/admin/client-dialog';
import { Money } from '@/components/currency-context';
import { EmptyState } from '@/components/ui';
import { initials } from '@/lib/utils';

export default async function ClientsPage() {
  await requireAdmin();
  const [clients, projects, { rates }] = await Promise.all([loadClients(), loadLedger(), getRates()]);

  return (
    <>
      <PageHeader title="Clients" description="Each client gets a private login to see their own projects and payments.">
        <ClientDialog />
      </PageHeader>
      {clients.length === 0 ? (
        <EmptyState title="No clients yet">Add your first client. You’ll set their login password here.</EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => {
            const own = projects.filter((p) => p.client?.id === c.id);
            const t = totalsUSD(own, rates);
            return (
              <Link
                key={c.id}
                href={`/admin/clients/${c.id}`}
                className="group rounded-2xl border border-line bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-[0_16px_40px_-24px_rgb(var(--accent))]"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 font-display text-xs font-bold transition-colors group-hover:bg-accent group-hover:text-accent-ink">
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="truncate text-xs text-muted">{c.company || c.email}</p>
                  </div>
                  {!c.active && <span className="ml-auto rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">Paused</span>}
                </div>
                <dl className="mt-5 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted">Billed</dt>
                    <dd className="font-semibold"><Money amount={t.billed} compact /></dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Paid</dt>
                    <dd className="font-semibold text-accent-fg"><Money amount={t.paid} compact /></dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Pending</dt>
                    <dd className="font-semibold text-brass"><Money amount={t.pending} compact /></dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs text-muted">{own.length} project{own.length === 1 ? '' : 's'}</p>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
