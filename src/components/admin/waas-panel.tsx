'use client';

import { CalendarPlus, Copy, Link2, RotateCcw, ShieldCheck, ShieldOff, ShieldAlert, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { cancelAutopayAdmin, extendGrace, retryAutopayNow, suspendSite } from '@/lib/actions/waas-admin';
import { formatMoney } from '@/lib/currency';
import { GUARD_MIDDLEWARE } from '@/lib/guard-snippet';
import type { AutopayStatus, SiteStatus, SubscriptionRow } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import { ActionButton, Button, Dialog, Field, Input } from '../ui';

const SITE: Record<SiteStatus, { label: string; cls: string }> = {
  active: { label: 'Website online', cls: 'border-accent/40 bg-accent/10 text-accent-fg' },
  grace: { label: 'Grace period', cls: 'border-brass/50 bg-brass/10 text-brass' },
  suspended: { label: 'Website suspended', cls: 'border-danger/60 bg-danger/10 text-danger' },
};
const AUTOPAY: Record<AutopayStatus, { label: string; cls: string }> = {
  none: { label: 'No autopay', cls: 'border-line text-muted' },
  pending: { label: 'Autopay pending', cls: 'border-brass/50 bg-brass/10 text-brass' },
  active: { label: 'Autopay on', cls: 'border-accent/40 bg-accent/10 text-accent-fg' },
  paused: { label: 'Autopay paused', cls: 'border-brass/50 bg-brass/10 text-brass' },
  cancelled: { label: 'Autopay cancelled', cls: 'border-line text-muted' },
  failed: { label: 'Autopay failed', cls: 'border-danger/60 bg-danger/10 text-danger' },
};

export function Chip({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', cls)}>{children}</span>;
}

function copy(text: string, what: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${what} copied.`),
    () => toast.error('Couldn’t copy. Select it and copy by hand.'),
  );
}

function ExtendGrace({ sub }: { sub: SubscriptionRow }) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(7);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CalendarPlus /> Extend grace
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Give more time to pay" description={`${sub.name} stays online while the extension runs. If it's already suspended, it comes back online now.`}>
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            {[3, 7, 14, 30].map((d) => (
              <Button key={d} type="button" size="sm" variant={days === d ? 'primary' : 'outline'} onClick={() => setDays(d)}>
                {d} days
              </Button>
            ))}
          </div>
          <Field label="Or choose any number of days">
            <Input type="number" min={1} max={60} value={days} onChange={(e) => setDays(Number(e.target.value))} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await extendGrace(sub.id, days);
                  if (r.ok) {
                    toast.success(r.message ?? 'Done.');
                    setOpen(false);
                    router.refresh();
                  } else toast.error(r.error);
                })
              }
            >
              Extend by {days} day{days === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

function GuardDialog({ sub }: { sub: SubscriptionRow }) {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState(''); // read when opened, so the server and browser render the same page first
  const env = `WAAS_PORTAL_URL=${origin}\nWAAS_SITE_KEY=${sub.waas.siteKey}`;
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOrigin(window.location.origin);
          setOpen(true);
        }}
      >
        <ShieldCheck /> Site guard
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} wide title={`Site guard for ${sub.waas.projectName || sub.name}`} description="Three steps, once per client website. After that it's automatic.">
        <div className="grid gap-5 text-sm">
          <div>
            <p className="font-semibold">1. Add these two environment variables on the client’s Vercel project</p>
            <pre className="mt-2 overflow-x-auto rounded-xl border border-line bg-bg p-3 text-xs">{env}</pre>
            <Button className="mt-2" size="sm" variant="outline" onClick={() => copy(env, 'Variables')}>
              <Copy /> Copy variables
            </Button>
          </div>
          <div>
            <p className="font-semibold">2. Add this file to the client’s Next.js project, as <code className="rounded bg-surface-2 px-1">middleware.ts</code></p>
            <p className="mt-1 text-xs text-muted">Already have a middleware.ts? Keep yours and call <code>waasGuard(req)</code> at its top, as explained in the file’s first comment.</p>
            <pre className="mt-2 max-h-64 overflow-auto rounded-xl border border-line bg-bg p-3 text-xs">{GUARD_MIDDLEWARE}</pre>
            <Button className="mt-2" size="sm" variant="outline" onClick={() => copy(GUARD_MIDDLEWARE, 'middleware.ts')}>
              <Copy /> Copy middleware.ts
            </Button>
          </div>
          <div>
            <p className="font-semibold">3. Redeploy, then test</p>
            <p className="mt-1 text-muted">
              Press <b>Suspend site</b> on this card, wait a minute, and open the client’s website: it should show the “temporarily unavailable” page. Then press <b>Restore site</b>.
              The guard keeps working if this portal is ever unreachable (it fails open), and it never touches the client’s data.
            </p>
          </div>
        </div>
      </Dialog>
    </>
  );
}

/** Plan, website state and autopay for a subscription, plus the actions you need when a client doesn't pay. */
export function WaasStrip({ sub }: { sub: SubscriptionRow }) {
  const w = sub.waas;
  if (!w.enabled && !w.plan && w.autopay.status === 'none') return null;
  const active = sub.status === 'active';
  return (
    <div className="mt-4 grid gap-3 rounded-xl border border-line bg-bg/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {w.plan && <Chip cls="border-line text-heading">Plan: {w.plan.name}</Chip>}
        {w.projectName && <Chip cls="border-line text-heading">Site: {w.projectName}</Chip>}
        {w.enabled && active && (
          <Chip cls={SITE[w.siteStatus].cls}>
            {w.siteStatus === 'suspended' ? <ShieldOff className="h-3.5 w-3.5" /> : w.siteStatus === 'grace' ? <ShieldAlert className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {SITE[w.siteStatus].label}
            {w.override === 'suspend' && ' (by you)'}
          </Chip>
        )}
        <Chip cls={AUTOPAY[w.autopay.status].cls}>
          {AUTOPAY[w.autopay.status].label}
          {w.autopay.status === 'active' && w.autopay.method && ` · ${w.autopay.method.toUpperCase()}`}
        </Chip>
      </div>

      {w.enabled && active && w.siteStatus === 'grace' && w.suspendOn && (
        <p className="text-xs text-brass">
          {formatMoney(w.amountDue, sub.currency)} overdue ({w.lateDays} day{w.lateDays === 1 ? '' : 's'}). The website goes offline on {formatDate(w.suspendOn, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })} unless it’s paid.
        </p>
      )}
      {w.enabled && active && w.siteStatus === 'suspended' && (
        <p className="text-xs text-danger">
          {w.override === 'suspend' ? 'You suspended this site by hand.' : `${formatMoney(w.amountDue, sub.currency)} overdue.`} Recording the payment (or extending grace) brings it back online within a minute.
        </p>
      )}
      {w.autopay.lastFailure && w.autopay.status !== 'none' && (
        <p className="text-xs text-muted">
          Last autopay failure{w.autopay.lastFailureAt ? ` (${formatDate(w.autopay.lastFailureAt, { day: 'numeric', month: 'short', timeZone: 'UTC' })})` : ''}: {w.autopay.lastFailure}
        </p>
      )}
      {w.autopay.status === 'active' && w.autopay.nextChargeAt && <p className="text-xs text-muted">Next automatic payment: {formatDate(w.autopay.nextChargeAt, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</p>}

      {active && (
        <div className="flex flex-wrap gap-1.5">
          {w.enabled && (w.siteStatus !== 'active' || w.override === 'suspend') && <ExtendGrace sub={sub} />}
          {w.enabled &&
            (w.override === 'suspend' ? (
              <ActionButton variant="outline" size="sm" action={suspendSite.bind(null, sub.id, false)}>
                <ShieldCheck /> Restore site
              </ActionButton>
            ) : (
              <ActionButton variant="outline" size="sm" confirm confirmLabel="Take site offline?" action={suspendSite.bind(null, sub.id, true)}>
                <ShieldOff /> Suspend site
              </ActionButton>
            ))}
          {w.autopay.status === 'active' && w.autopay.lastFailure && (
            <ActionButton variant="outline" size="sm" action={retryAutopayNow.bind(null, sub.id)}>
              <RotateCcw /> Retry payment
            </ActionButton>
          )}
          {['active', 'paused', 'pending'].includes(w.autopay.status) && (
            <ActionButton variant="ghost" size="sm" confirm confirmLabel="Cancel autopay?" action={cancelAutopayAdmin.bind(null, sub.id)}>
              <XCircle /> Cancel autopay
            </ActionButton>
          )}
          {w.enabled && w.payKey && (
            <Button variant="ghost" size="sm" onClick={() => copy(`${window.location.origin}/pay/${w.payKey}`, 'Pay link')}>
              <Link2 /> Copy pay link
            </Button>
          )}
          {w.enabled && <GuardDialog sub={sub} />}
        </div>
      )}
    </div>
  );
}
