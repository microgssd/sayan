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
import { cashfreeReady } from '@/lib/cashfree';
import { loadClientEvents } from '@/lib/client-events';
import { PayOrder } from '@/lib/models/PayOrder';
import { Subscription } from '@/lib/models/Subscription';
import { syncAutopay, verifyOrder } from '@/lib/waas';

export const metadata: Metadata = { title: 'Your projects', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function PortalPage({ searchParams }: { searchParams: { autopay?: string; paid?: string } }) {
  const session = await requireClient();
  await connectDB();
  const user = await User.findById(session.sub).lean();
  if (!user || !user.active) redirect('/login');

  // Back from Cashfree's checkout: ask Cashfree what happened instead of trusting the address bar.
  // Each check is limited to this client's own subscription or order.
  let notice: 'autopay' | 'paid' | null = null;
  if (cashfreeReady()) {
    if (searchParams.autopay && /^[a-f\d]{24}$/i.test(searchParams.autopay) && (await Subscription.exists({ _id: searchParams.autopay, client: session.sub }))) {
      notice = 'autopay';
      await syncAutopay(searchParams.autopay).catch(() => {});
    } else if (searchParams.paid && /^[\w-]{6,60}$/.test(searchParams.paid) && (await PayOrder.exists({ orderId: searchParams.paid, client: session.sub }))) {
      notice = 'paid';
      await verifyOrder(searchParams.paid).catch(() => {});
    }
  }

  // Always scoped to the logged-in client. Never read an id from the URL here.
  const [projects, subs, allPayments, { rates }, events] = await Promise.all([
    loadLedger({ clientId: session.sub }),
    loadSubscriptions({ clientId: session.sub }),
    loadAllPayments({ clientId: session.sub }),
    getRates(),
    loadClientEvents(session.sub, 30),
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
      // the keys that guard a website and its pay link never leave the server
      subscriptions={subs.map((s) => ({ ...s, waas: { ...s.waas, siteKey: '', payKey: '' } }))}
      events={events}
      paymentsOn={cashfreeReady()}
      notice={notice}
      payments={payments}
      totals={{ billed: pt.billed + su('billed'), paid: pt.paid + su('paid'), pending: pt.pending + su('pending') }}
    />
  );
}
