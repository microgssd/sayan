'use client';

import { AlertTriangle, CheckCircle2, Globe, ShieldAlert, ShieldCheck } from 'lucide-react';
import { payNowAction, startAutopayAction } from '@/lib/actions/autopay';
import { formatMoney } from '@/lib/currency';
import type { SubscriptionRow } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import { CheckoutButton } from '../cashfree-checkout';
import { useI18n } from '../i18n';

/** What a client sees for a website plan: its state, what's included, autopay, and the buttons to set up or pay. */
export function PlanBlock({ sub, online }: { sub: SubscriptionRow; online: boolean }) {
  const { t, fmt, locale, lang } = useI18n();
  const W = t.waas;
  const w = sub.waas;
  if (sub.status !== 'active' || (!w.plan && !w.enabled && w.autopay.status === 'none')) return null;

  const money = (n: number) => formatMoney(n, sub.currency, { locale });
  const tr = lang !== 'en' ? w.plan?.translations?.[lang] : undefined;
  const features = tr?.features?.trim() ? tr.features.split('\n').filter(Boolean) : (w.plan?.features ?? []);
  const description = tr?.description?.trim() || w.plan?.description || '';
  const now = Date.now();
  const payable = Math.round(sub.periods.filter((p) => p.remaining > 0.009 && new Date(p.dueDate).getTime() <= now + 7 * 86_400_000).reduce((x, p) => x + p.remaining, 0) * 100) / 100;
  const a = w.autopay;
  const autopayLabel = { none: W.autopayOff, cancelled: W.autopayOff, pending: W.autopayPending, active: W.autopayOn, paused: W.autopayPaused, failed: W.autopayFailed }[a.status];
  const hasAutopay = a.status === 'active' || a.status === 'paused';

  return (
    <div className="mt-5 grid gap-4 rounded-xl border border-line bg-bg/40 p-4">
      {w.enabled && w.siteStatus !== 'active' && (
        <div className={cn('flex items-start gap-3 rounded-lg border p-3', w.siteStatus === 'suspended' ? 'border-danger/50 bg-danger/10' : 'border-brass/50 bg-brass/10')}>
          {w.siteStatus === 'suspended' ? <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-brass" />}
          <div className="min-w-0 text-sm">
            <p className={cn('font-bold', w.siteStatus === 'suspended' ? 'text-danger' : 'text-brass')}>{w.siteStatus === 'suspended' ? W.siteSuspended : W.siteGrace}</p>
            <p className="mt-0.5 text-muted">
              {w.siteStatus === 'suspended' ? W.suspendedNote : w.suspendOn ? fmt(W.graceNote, { date: formatDate(w.suspendOn, { day: 'numeric', month: 'long', timeZone: 'UTC' }, locale) }) : ''}
            </p>
            {a.lastFailure && <p className="mt-1 text-xs text-muted">{a.lastFailure}</p>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        {w.enabled && w.siteStatus === 'active' && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-accent-fg">
            <ShieldCheck className="h-3.5 w-3.5" /> {W.siteOnline}
          </span>
        )}
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1', a.status === 'active' ? 'border-accent/40 text-accent-fg' : a.status === 'failed' ? 'border-danger/50 text-danger' : 'border-line text-muted')}>
          {a.status === 'active' && <CheckCircle2 className="h-3.5 w-3.5" />}
          {autopayLabel}
          {a.status === 'active' && a.methodNote ? ` · ${a.methodNote}` : ''}
        </span>
        {w.siteUrl && (
          <a href={w.siteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-heading hover:border-heading">
            <Globe className="h-3.5 w-3.5" /> {W.visit}
          </a>
        )}
      </div>

      {w.plan && (
        <div>
          <p className="text-xs font-semibold text-muted">
            {W.planLabel}: <span className="text-heading">{w.plan.name}</span>
          </p>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          {features.length > 0 && (
            <ul className="mt-2 grid gap-1 text-sm">
              {features.map((f) => (
                <li key={f} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-fg" /> <span className="min-w-0">{f}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {a.status === 'active' && a.nextChargeAt && <p className="text-xs text-muted">{fmt(W.nextCharge, { date: formatDate(a.nextChargeAt, { day: 'numeric', month: 'long', timeZone: 'UTC' }, locale) })}</p>}

      {online && (
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            {payable > 0 && (
              <CheckoutButton kind="payment" run={() => payNowAction(sub.id)}>
                {fmt(W.payNow, { amount: money(payable) })}
              </CheckoutButton>
            )}
            <CheckoutButton kind="mandate" askPhone variant={payable > 0 || hasAutopay ? 'outline' : 'primary'} run={(phone) => startAutopayAction(sub.id, phone)}>
              {hasAutopay || a.status === 'failed' ? W.changeMethod : W.setupAutopay}
            </CheckoutButton>
          </div>
          {!hasAutopay && sub.currency !== 'INR' && <p className="text-xs text-muted">{W.overseasNote}</p>}
          <p className="text-xs text-muted">{W.secure}</p>
        </div>
      )}
    </div>
  );
}
