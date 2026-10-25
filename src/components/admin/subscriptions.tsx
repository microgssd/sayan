'use client';

import { motion } from 'framer-motion';
import { Check, Pencil, Plus, Repeat, Trash2, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { deletePayment } from '@/lib/actions/payments';
import { createSubscription, deleteSubscription, endSubscription, markMonthPaid, updateSubscription } from '@/lib/actions/subscriptions';
import { CURRENCIES, formatMoney } from '@/lib/currency';
import { monthKey } from '@/lib/periods';
import { METHOD_LABEL, PAYMENT_METHODS, type ClientLite, type PeriodRow, type SubscriptionRow } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import { ActionButton, Button, Dialog, Field, Input, Select, Textarea, useActionForm } from '../ui';

export function SubscriptionDialog({ sub, clients, defaultClientId }: { sub?: SubscriptionRow; clients: ClientLite[]; defaultClientId?: string }) {
  const [open, setOpen] = useState(false);
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
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Client">
            <Select name="clientId" defaultValue={sub?.client?.id ?? defaultClientId ?? clients[0]?.id}>
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
              <Select name="currency" defaultValue={sub?.currency ?? 'INR'}>
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

export function SubscriptionCard({ sub, clients, showClient = true }: { sub: SubscriptionRow; clients: ClientLite[]; showClient?: boolean }) {
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
          <SubscriptionDialog sub={sub} clients={clients} />
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
