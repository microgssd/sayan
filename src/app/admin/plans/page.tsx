import { CheckCircle2, CircleAlert, CircleX } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { cashfreeEnv, cashfreeReady } from '@/lib/cashfree';
import { connectDB } from '@/lib/db';
import { mailReady } from '@/lib/mailer';
import { Plan } from '@/lib/models/Plan';
import { Subscription } from '@/lib/models/Subscription';
import { WebhookLog } from '@/lib/models/WebhookLog';
import { planRow } from '@/lib/subscriptions';
import { telegramReady } from '@/lib/telegram';
import { translationProvider } from '@/lib/translate';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/admin/shell';
import { NewPlanButton, PlansList } from '@/components/admin/plans';

export const dynamic = 'force-dynamic';

type Check = { ok: boolean | 'warn'; label: string; detail: string };

export default async function PlansPage() {
  await requireAdmin();
  await connectDB();
  const [plans, counts, logs]: [any[], any[], any[]] = await Promise.all([
    Plan.find().sort({ sortOrder: 1, createdAt: 1 }).lean(),
    Subscription.aggregate([{ $match: { plan: { $ne: null }, status: 'active' } }, { $group: { _id: '$plan', n: { $sum: 1 } } }]),
    WebhookLog.find().sort({ createdAt: -1 }).limit(15).lean(),
  ]);
  const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const live = cashfreeEnv() === 'production';
  const lastCron: any = logs.find((l) => l.type === 'daily job');
  const checks: Check[] = [
    { ok: cashfreeReady(), label: 'Cashfree keys', detail: cashfreeReady() ? `Connected in ${live ? 'LIVE' : 'test (sandbox)'} mode.` : 'Add CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET.' },
    { ok: /^https:\/\//.test(site), label: 'Public site address', detail: /^https:\/\//.test(site) ? site : 'Set NEXT_PUBLIC_SITE_URL to your https address. Cashfree sends payments to it.' },
    { ok: !!process.env.CRON_SECRET, label: 'Daily job secret', detail: process.env.CRON_SECRET ? (lastCron ? `Last ran ${formatDate(lastCron.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}: ${lastCron.summary}.` : 'Set. Waiting for its first daily run.') : 'Add CRON_SECRET (any long random text) so reminders and retries run daily.' },
    { ok: mailReady() ? true : 'warn', label: 'Email to clients', detail: mailReady() ? 'Payment failures, warnings and receipts are emailed.' : 'Add RESEND_API_KEY and CONTACT_FROM_EMAIL. Without them clients only see updates in their portal.' },
    { ok: telegramReady() ? true : 'warn', label: 'Telegram alerts to you', detail: telegramReady() ? 'You’re pinged when a payment fails or a site is suspended.' : 'Optional: connect Telegram under Live chat to get alerts on your phone.' },
    { ok: translationProvider() ? true : 'warn', label: 'Automatic translation', detail: translationProvider() ? 'Plan details and your notes are translated for clients.' : 'Optional: add DEEPL_API_KEY so plan details and notes appear in the client’s language.' },
  ];
  const Icon = ({ ok }: { ok: Check['ok'] }) => (ok === true ? <CheckCircle2 className="h-5 w-5 text-accent-fg" /> : ok === 'warn' ? <CircleAlert className="h-5 w-5 text-brass" /> : <CircleX className="h-5 w-5 text-danger" />);

  return (
    <div>
      <PageHeader title="Plans & autopay" description="Your website-as-a-service plans, and the connection to Cashfree that collects the payments.">
        <NewPlanButton />
      </PageHeader>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-lg font-semibold">Plans</h2>
        <PlansList plans={plans.map(planRow)} counts={Object.fromEntries(counts.map((c) => [String(c._id), c.n]))} />
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Setup checklist</h2>
        <ul className="mt-4 grid gap-3">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-3">
              <Icon ok={c.ok} />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{c.label}</p>
                <p className="text-sm text-muted">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-5 rounded-xl border border-line bg-bg/40 p-4 text-sm">
          <p className="font-semibold">Webhook address for Cashfree</p>
          <p className="mt-1 text-muted">In the Cashfree dashboard, under Developers → Webhooks, add this address for both Payments and Subscriptions:</p>
          <code className="mt-2 block overflow-x-auto rounded-lg border border-line bg-bg px-3 py-2 text-xs">{site ? `${site}/api/cashfree/webhook` : 'Set NEXT_PUBLIC_SITE_URL first'}</code>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Recent notifications from Cashfree</h2>
        <p className="mt-1 text-sm text-muted">Each payment and autopay change lands here. If something looks off during testing, this tells you what arrived and what happened.</p>
        {logs.length ? (
          <ul className="mt-4 divide-y divide-line text-sm">
            {logs.map((l) => (
              <li key={String(l._id)} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                <span className="min-w-0">
                  <b className={l.ok ? '' : 'text-danger'}>{l.ok ? '✓' : '✗'} {l.type || 'event'}</b>
                  <span className="ml-2 text-muted">{l.ok ? l.summary : l.error}</span>
                </span>
                <span className="text-xs text-subtle">{formatDate(l.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">Nothing received yet.</p>
        )}
      </section>
    </div>
  );
}
