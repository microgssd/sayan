'use client';

import { motion } from 'framer-motion';
import { Check, Pencil, Plus, Repeat, Trash2, Undo2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { deletePayment } from '@/lib/actions/payments';
import { createSubscription, deleteSubscription, endSubscription, markMonthPaid, updateSubscription } from '@/lib/actions/subscriptions';
import { CURRENCIES, formatMoney } from '@/lib/currency';
import { monthKey } from '@/lib/periods';
import { METHOD_LABEL, PAYMENT_METHODS, type ClientLite, type PeriodRow, type SubscriptionRow } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import { ActionButton, Button, Dialog, Field, Input, Select, Textarea, useActionForm } from '../ui';
import type { BillingOptions } from '@/lib/plans';
import { WaasStrip } from './waas-panel';

export function SubscriptionDialog({ sub, clients, defaultClientId, options }: { sub?: SubscriptionRow; clients: ClientLite[]; defaultClientId?: string; options?: BillingOptions }) {
  const [open, setOpen] = useState(false);
  const plans = options?.plans ?? [];
  const [clientId, setClientId] = useState(sub?.client?.id ?? defaultClientId ?? clients[0]?.id ?? '');
  const formRef = useRef<HTMLFormElement>(null);
  const field = (name: string) => formRef.current?.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
  /** Picking a plan fills in its price (in the chosen currency) and grace days, and switches website protection on. */
  const applyPlan = (planId?: string, currency?: string) => {
    const plan = plans.find((p) => p.id === (planId ?? field('planId')?.value));
    if (!plan) return;
    const cur = (currency ?? field('currency')?.value ?? 'INR') as keyof typeof plan.prices;
    if (!sub) {
      const price = plan.prices[cur];
      if (price && field('amount')) field('amount')!.value = String(price);
      if (field('name') && !field('name')!.value) field('name')!.value = plan.name;
    }
    if (field('graceDays')) field('graceDays')!.value = String(plan.graceDays);
    const w = field('waas') as HTMLInputElement | null;
    if (w && !sub) w.checked = true;
  };
  const { pending, onSubmit } = useActionForm(sub ? updateSubscription.bind(null, sub.id) : createSubscription, () => setOpen(false));
  return (
    <>
      {sub ? (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Pencil /> Edit
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)} disabled={!clients.length} title={clients.length ? undefined : 'Add a client first'}>
          <Plus /> New subscription
        </Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={sub ? `Edit ${sub.name}` : 'New subscription'} description="A fixed amount billed every month, like social media management or hosting." wide>
        <form ref={formRef} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Client">
            <Select name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.company ? ` (${c.company})` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Service name">
            <Input name="name" defaultValue={sub?.name} placeholder="Social media management" required />
          </Field>
          <Field label="Monthly amount" hint={sub ? 'A new price applies from this month on. Earlier months keep their price.' : undefined}>
            <Input name="amount" type="number" step="0.01" min="0.01" defaultValue={sub?.current?.price ?? sub?.amount} required />
          </Field>
          <Field label="Currency" hint={sub && sub.paid > 0 ? 'Locked because months are paid.' : undefined}>
            {sub && sub.paid > 0 ? (
              <>
                <input type="hidden" name="currency" value={sub.currency} />
                <Select value={sub.currency} disabled>
                  <option>{sub.currency}</option>
                </Select>
              </>
            ) : (
              <Select name="currency" defaultValue={sub?.currency ?? 'INR'} onChange={(e) => applyPlan(undefined, e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="First billed month">
            <Input name="startMonth" type="month" defaultValue={sub?.startMonth ?? monthKey()} required />
          </Field>
          <Field label="Due on day" hint="Day of the month payment is due (1 to 28).">
            <Input name="dueDay" type="number" min={1} max={28} defaultValue={sub?.dueDay ?? 5} required />
          </Field>
          <Field label="What’s included" hint="Shown to the client in their portal." className="sm:col-span-2">
            <Textarea name="description" defaultValue={sub?.description} placeholder="12 posts a month across Instagram and LinkedIn, monthly report" />
          </Field>
          <fieldset className="grid gap-4 rounded-xl border border-line p-4 sm:col-span-2 sm:grid-cols-2">
            <legend className="px-1 text-xs font-semibold text-muted">Website as a service (optional)</legend>
            <Field label="Plan" hint={plans.length ? 'Picking a plan fills in the price for the chosen currency.' : 'Create plans under Plans & autopay.'}>
              <Select name="planId" defaultValue={sub?.waas.plan?.id ?? ''} onChange={(e) => applyPlan(e.target.value)}>
                <option value="">No plan</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Client’s website" hint="The project this plan keeps online.">
              <Select name="projectId" defaultValue={sub?.waas.projectId ?? ''}>
                <option value="">None</option>
                {(options?.projects ?? [])
                  .filter((p) => p.clientId === clientId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Website address" hint="Shown to you only, for reference.">
              <Input name="siteUrl" defaultValue={sub?.waas.siteUrl} placeholder="https://clientsite.com" />
            </Field>
            <Field label="Grace days" hint="Days after the due date before the site goes offline.">
              <Input name="graceDays" type="number" min={0} max={60} defaultValue={sub?.waas.graceDays ?? 7} />
            </Field>
            <label className="flex items-start gap-3 rounded-lg border border-line px-3 py-2.5 text-sm sm:col-span-2">
              <input type="checkbox" name="waas" defaultChecked={sub?.waas.enabled} className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]" />
              <span>
                <b>Take the website offline if payment stays overdue</b>
                <span className="block text-xs text-muted">Needs the Site guard file on the client’s website (shown on the subscription card after saving). Careful: months before today that you haven’t recorded as paid count as overdue, so set the start month to when billing really begins.</span>
              </span>
            </label>
          </fieldset>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={pending}>{sub ? 'Save changes' : 'Create subscription'}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

const chip: Record<PeriodRow['status'], string> = {
  paid: 'border-accent/50 bg-accent/15 text-accent-fg',
  partial: 'border-brass/50 bg-brass/10 text-brass',
  due: 'border-line text-heading',
  overdue: 'border-danger/60 bg-danger/10 text-danger',
};

function MonthDialog({ sub, period, onClose }: { sub: SubscriptionRow; period: PeriodRow; onClose: () => void }) {
  const { pending, onSubmit } = useActionForm(markMonthPaid.bind(null, sub.id), onClose);
  const paid = period.status === 'paid';
  return (
    <Dialog open onClose={onClose} title={`${sub.name}, ${period.label}`} description={`${formatMoney(period.price, sub.currency)} due ${formatDate(period.dueDate)}`}>
      {period.paymentIds.length > 0 && (
        <div className="mb-5 rounded-xl border border-line p-3 text-sm">
          <p className="font-semibold">
            {formatMoney(period.paid, sub.currency)} received{period.remaining > 0 && `, ${formatMoney(period.remaining, sub.currency)} still due`}
          </p>
          <p className="mt-1 text-xs text-muted">Undo removes the payment and voids its invoice. The client’s alert comes back.</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {period.paymentIds.map((id, i) => (
              <ActionButton key={id} variant="outline" size="sm" confirm confirmLabel="Remove payment?" action={deletePayment.bind(null, id)}>
                <Undo2 /> Undo payment {period.paymentIds.length > 1 ? i + 1 : ''}
              </ActionButton>
            ))}
          </div>
        </div>
      )}
      {!paid && (
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="period" value={period.period} />
          <Field label="Amount received">
            <Input name="amount" type="number" step="0.01" min="0.01" defaultValue={period.remaining} required />
          </Field>
          <Field label="Received in">
            <Select name="currency" defaultValue={sub.currency}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Date received">
            <Input name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          </Field>
          <Field label="Method">
            <Select name="method" defaultValue="upi">
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference" className="sm:col-span-2">
            <Input name="reference" placeholder="UTR or transaction ID" />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={pending}>
              <Check /> Mark {period.label} paid
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

export function SubscriptionCard({ sub, clients, showClient = true, options }: { sub: SubscriptionRow; clients: ClientLite[]; showClient?: boolean; options?: BillingOptions }) {
  const [openPeriod, setOpenPeriod] = useState<PeriodRow | null>(null);
  const cur = sub.current;
  return (
    <article className={cn('rounded-2xl border bg-surface p-5', cur && cur.status !== 'paid' && sub.status === 'active' ? 'border-brass/50' : 'border-line')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            <Repeat className="h-4 w-4 text-accent-fg" />
            {sub.name}
            {sub.status === 'ended' && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">Ended {sub.endMonth}</span>}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {showClient && sub.client && `${sub.client.name}, `}
            {formatMoney(sub.amount, sub.currency)} a month, due on the {ordinal(sub.dueDay)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <SubscriptionDialog sub={sub} clients={clients} options={options} />
          <ActionButton variant="ghost" size="sm" action={endSubscription.bind(null, sub.id, sub.status === 'active')}>
            {sub.status === 'active' ? 'End' : 'Reactivate'}
          </ActionButton>
          {sub.paid === 0 && (
            <ActionButton variant="danger" size="sm" confirm confirmLabel="Delete?" action={deleteSubscription.bind(null, sub.id)} aria-label="Delete subscription">
              <Trash2 />
            </ActionButton>
          )}
        </div>
      </div>

      <WaasStrip sub={sub} />

      <div className="mt-4 flex flex-wrap gap-2">
        {sub.periods.slice(0, 12).map((p) => (
          <motion.button
            key={p.period}
            whileTap={{ scale: 0.94 }}
            onClick={() => setOpenPeriod(p)}
            className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:border-accent', chip[p.status])}
            title={p.status === 'paid' ? 'Paid. Click to view or undo.' : 'Click to mark as paid'}
          >
            {p.status === 'paid' && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            {p.label}
            {p.status === 'overdue' && ' overdue'}
            {p.status === 'partial' && ' part paid'}
          </motion.button>
        ))}
        {!sub.periods.length && <p className="text-sm text-muted">Billing starts {sub.startMonth}.</p>}
      </div>
      <p className="mt-3 text-xs text-muted">
        Paid {formatMoney(sub.paid, sub.currency)} of {formatMoney(sub.billed, sub.currency)} billed so far
        {sub.pending > 0 && <span className="font-semibold text-brass">, {formatMoney(sub.pending, sub.currency)} outstanding</span>}
      </p>
      {openPeriod && <MonthDialog sub={sub} period={openPeriod} onClose={() => setOpenPeriod(null)} />}
    </article>
  );
}
