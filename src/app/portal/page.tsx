import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireClient } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { loadAllPayments, loadLedger } from '@/lib/ledger';
import { loadSubscriptions } from '@/lib/subscriptions';
import { User } from '@/lib/models/User';
import { getRates } from '@/lib/rates';
import { totalsUSD } from '@/lib/summary';
import { convert, isCurrency } from '@/lib/currency';
import { PortalView } from '@/components/portal/portal-view';

export const metadata: Metadata = { title: 'Your projects', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function PortalPage() {
  const session = await requireClient();
  await connectDB();
  const user = await User.findById(session.sub).lean();
  if (!user || !user.active) redirect('/login');

  // Always scoped to the logged-in client. Never read an id from the URL here.
  const [projects, subs, allPayments, { rates }] = await Promise.all([
    loadLedger({ clientId: session.sub }),
    loadSubscriptions({ clientId: session.sub }),
    loadAllPayments({ clientId: session.sub }),
    getRates(),
  ]);
  // Clients only see invoices you have sent; drafts and void ones stay private.
  const payments = allPayments.map((p) => ({ ...p, invoice: p.invoice?.status === 'sent' ? p.invoice : null }));
  const pt = totalsUSD(projects, rates);
  const su = (k: 'billed' | 'paid' | 'pending') => subs.reduce((t, s) => t + convert(s[k], s.currency, 'USD', rates), 0);

  return (
    <PortalView
      name={user.name}
      company={user.company ?? ''}
      preferredCurrency={isCurrency(user.preferredCurrency) ? user.preferredCurrency : 'USD'}
      projects={projects}
      subscriptions={subs}
      payments={payments}
      totals={{ billed: pt.billed + su('billed'), paid: pt.paid + su('paid'), pending: pt.pending + su('pending') }}
    />
  );
}
