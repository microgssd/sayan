import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { isValidObjectId } from 'mongoose';
import { requireAdmin } from '@/lib/auth';
import { loadAllPayments, loadClients, loadLedger } from '@/lib/ledger';
import { loadSubscriptions } from '@/lib/subscriptions';
import { SubscriptionCard, SubscriptionDialog } from '@/components/admin/subscriptions';
import { convert } from '@/lib/currency';
import { getRates } from '@/lib/rates';
import { totalsUSD } from '@/lib/summary';
import { deleteClient, setClientActive } from '@/lib/actions/clients';
import { PageHeader } from '@/components/admin/shell';
import { Stat } from '@/components/admin/stat';
import { ClientDialog } from '@/components/admin/client-dialog';
import { ProjectDialog } from '@/components/admin/project-dialog';
import { PaymentDialog } from '@/components/admin/payment-dialog';
import { PaymentsTable, ProjectsTable } from '@/components/admin/tables';
import { toOptions } from '@/lib/options';
import { ActionButton } from '@/components/ui';

export default async function ClientDetail({ params }: { params: { id: string } }) {
  await requireAdmin();
  if (!isValidObjectId(params.id)) notFound();
  const [clients, projects, subs, payments, { rates }] = await Promise.all([
    loadClients(),
    loadLedger({ clientId: params.id }),
    loadSubscriptions({ clientId: params.id }),
    loadAllPayments({ clientId: params.id }),
    getRates(),
  ]);
  const client = clients.find((c) => c.id === params.id);
  if (!client) notFound();
  const pt = totalsUSD(projects, rates);
  const su = (k: 'billed' | 'paid' | 'pending') => subs.reduce((s, x) => s + convert(x[k], x.currency, 'USD', rates), 0);
  const t = { billed: pt.billed + su('billed'), paid: pt.paid + su('paid'), pending: pt.pending + su('pending') };
  const lite = clients.map(({ id, name, email, company }) => ({ id, name, email, company }));
  const options = toOptions(projects);

  return (
    <>
      <Link href="/admin/clients" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="h-4 w-4" /> Clients
      </Link>
      <PageHeader
        title={client.name}
        description={[client.company, client.email, client.phone].filter(Boolean).join(', ')}
      >
        <ClientDialog client={client} />
        <ActionButton variant="outline" size="sm" action={setClientActive.bind(null, client.id, !client.active)}>
          {client.active ? 'Pause portal access' : 'Restore portal access'}
        </ActionButton>
        <ActionButton variant="danger" size="sm" confirm confirmLabel="Delete client?" action={deleteClient.bind(null, client.id)}>
          <Trash2 /> Delete
        </ActionButton>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Billed" usd={t.billed} />
        <Stat label="Paid" usd={t.paid} tone="accent" delay={0.05} />
        <Stat label="Pending" usd={t.pending} tone="brass" delay={0.1} />
      </div>

      {client.notes && (
        <p className="mt-6 rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
          <span className="font-semibold text-ink">Private note: </span>
          {client.notes}
        </p>
      )}

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Projects</h2>
          <ProjectDialog clients={clients} defaultClientId={client.id} />
        </div>
        <ProjectsTable projects={projects} clients={clients} showClient={false} />
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Subscriptions</h2>
          <SubscriptionDialog clients={lite} defaultClientId={client.id} />
        </div>
        {subs.length ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {subs.map((s) => (
              <SubscriptionCard key={s.id} sub={s} clients={lite} showClient={false} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No monthly services for this client.</p>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Payment history</h2>
          {options.length > 0 && <PaymentDialog projects={options} size="sm" />}
        </div>
        {payments.length ? <PaymentsTable payments={payments} projects={options} /> : <p className="text-sm text-muted">No payments yet.</p>}
      </section>
    </>
  );
}
