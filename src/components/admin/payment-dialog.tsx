'use client';

import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { createPayment, updatePayment } from '@/lib/actions/payments';
import { CURRENCIES, formatMoney, round2, type Currency } from '@/lib/currency';
import { METHOD_LABEL, PAYMENT_METHODS, type PaymentRow } from '@/lib/types';
import { toDateInput } from '@/lib/utils';
import type { ProjectOption } from '@/lib/options';
import { useCurrency } from '../currency-context';
import { Button, Dialog, Field, Input, Select, Textarea, useActionForm } from '../ui';


export function PaymentDialog({
  payment,
  projects,
  defaultProjectId,
  size = 'md',
}: {
  payment?: PaymentRow;
  projects: ProjectOption[];
  defaultProjectId?: string;
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  const { rates } = useCurrency();
  const initialProject = payment?.projectId ?? defaultProjectId ?? projects[0]?.id ?? '';
  const [projectId, setProjectId] = useState(initialProject);
  const project = projects.find((p) => p.id === projectId);
  const [currency, setCurrency] = useState<Currency>(payment?.currency ?? project?.currency ?? 'USD');
  const [amount, setAmount] = useState(payment ? String(payment.amount) : '');
  const [fx, setFx] = useState(payment && payment.currency !== payment.projectCurrency ? String(payment.fxRate) : '');

  const action = payment ? updatePayment.bind(null, payment.id) : createPayment;
  const { pending, onSubmit } = useActionForm(action, () => {
    setOpen(false);
    if (!payment) setAmount('');
  });

  const crossCurrency = project && currency !== project.currency;
  const autoRate = project ? rates[project.currency] / rates[currency] : 1;
  const rate = Number(fx) > 0 ? Number(fx) : autoRate;
  const converted = project && Number(amount) > 0 ? round2(Number(amount) * rate) : null;

  return (
    <>
      {payment ? (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label="Edit payment">
          <Pencil />
        </Button>
      ) : (
        <Button size={size} onClick={() => setOpen(true)} disabled={!projects.length} title={projects.length ? undefined : 'Create a project first'}>
          <Plus /> Record payment
        </Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={payment ? 'Edit payment' : 'Record payment'} wide>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Project" className="sm:col-span-2" hint={project ? `Outstanding: ${formatMoney(project.pending, project.currency)}` : undefined}>
            <Select
              name="projectId"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                const p = projects.find((x) => x.id === e.target.value);
                if (p && !payment) setCurrency(p.currency);
                setFx('');
              }}
              required
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.clientName ? `${p.clientName}: ` : ''}
                  {p.name} ({p.currency})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amount received">
            <Input name="amount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </Field>
          <Field label="Received in">
            <Select
              name="currency"
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value as Currency);
                setFx('');
              }}
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          {crossCurrency && (
            <div className="grid gap-3 rounded-xl border border-brass/40 bg-brass/5 p-4 sm:col-span-2 sm:grid-cols-2">
              <Field label={`Rate: 1 ${currency} = ? ${project!.currency}`} hint="Leave blank to use today’s market rate. Enter your bank’s actual rate for an exact ledger.">
                <Input name="fxRate" type="number" step="any" min="0" placeholder={autoRate.toFixed(4)} value={fx} onChange={(e) => setFx(e.target.value)} />
              </Field>
              <div className="self-center text-sm">
                <p className="text-muted">Counts toward the project as</p>
                <p className="mt-1 font-display text-lg font-semibold tabular-nums">
                  {converted !== null ? formatMoney(converted, project!.currency) : '—'}
                </p>
              </div>
            </div>
          )}
          <Field label="Date received">
            <Input name="paidAt" type="date" defaultValue={toDateInput(payment?.paidAt) || new Date().toISOString().slice(0, 10)} required />
          </Field>
          <Field label="Method">
            <Select name="method" defaultValue={payment?.method ?? 'bank'}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference / invoice no." className="sm:col-span-2">
            <Input name="reference" defaultValue={payment?.reference} placeholder="INV-2026-014" />
          </Field>
          <Field label="Note" hint="Visible to the client in their portal." className="sm:col-span-2">
            <Textarea name="note" defaultValue={payment?.note} placeholder="Milestone 2: dashboard handover" />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={pending}>{payment ? 'Save changes' : 'Record payment'}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
