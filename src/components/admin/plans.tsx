'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { createPlan, deletePlan, updatePlan } from '@/lib/actions/plans';
import { CURRENCIES, CURRENCY_META, formatMoney } from '@/lib/currency';
import type { PlanRow } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ActionButton, Button, Dialog, Field, Input, Textarea, useActionForm } from '../ui';

const HOME = ['INR', 'CAD', 'USD', 'GBP'] as const; // the markets you sell to; others sit under "More currencies"

function PlanDialog({ plan }: { plan?: PlanRow }) {
  const [open, setOpen] = useState(false);
  const { onSubmit, pending } = useActionForm((fd) => (plan ? updatePlan(plan.id, fd) : createPlan(fd)), () => setOpen(false));
  const others = CURRENCIES.filter((c) => !(HOME as readonly string[]).includes(c));
  const price = (c: string) => (
    <Field key={c} label={`${c} per month`}>
      <Input name={`price_${c}`} type="number" min={0} step="0.01" inputMode="decimal" defaultValue={plan?.prices[c as keyof PlanRow['prices']] ?? ''} placeholder={CURRENCY_META[c as keyof typeof CURRENCY_META].label} />
    </Field>
  );
  return (
    <>
      {plan ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil /> Edit
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus /> New plan
        </Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} wide title={plan ? `Edit ${plan.name}` : 'New plan'} description="Clients see the name, what’s included and their own currency’s price.">
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan name" className="sm:col-span-2">
            <Input name="name" defaultValue={plan?.name} placeholder="Growth" maxLength={40} required />
          </Field>
          <Field label="Short description" className="sm:col-span-2">
            <Input name="description" defaultValue={plan?.description} placeholder="Hosting, security updates and support for your website" maxLength={400} />
          </Field>
          <Field label="What’s included (one per line)" className="sm:col-span-2" hint="Shown to the client as a checklist. Translated automatically.">
            <Textarea name="features" className="min-h-[96px]" defaultValue={plan?.features.join('\n')} placeholder={'Hosting and SSL\nMonthly backups\n3 hours of changes'} />
          </Field>
          {HOME.map(price)}
          <details className="sm:col-span-2">
            <summary className="cursor-pointer text-xs font-semibold text-muted">More currencies</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">{others.map(price)}</div>
          </details>
          <Field label="Grace days" hint="Days after the due date before the website goes offline.">
            <Input name="graceDays" type="number" min={0} max={60} defaultValue={plan?.graceDays ?? 7} />
          </Field>
          <label className="flex items-center gap-3 self-end rounded-lg border border-line px-3 py-2.5 text-sm">
            <input type="checkbox" name="active" defaultChecked={plan?.active ?? true} className="h-4 w-4 accent-[rgb(var(--accent))]" />
            Offered to new clients
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={pending}>{plan ? 'Save changes' : 'Create plan'}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function NewPlanButton() {
  return <PlanDialog />;
}

export function PlansList({ plans, counts }: { plans: PlanRow[]; counts: Record<string, number> }) {
  if (!plans.length)
    return (
      <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
        No plans yet. Create one (for example “Starter” and “Growth”), then pick it when you add a client’s subscription.
      </div>
    );
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {plans.map((p) => (
        <article key={p.id} className={cn('flex flex-col rounded-2xl border border-line bg-surface p-5', !p.active && 'opacity-60')}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display text-lg font-semibold">{p.name}</h3>
              <p className="text-xs text-muted">
                {counts[p.id] ?? 0} client{(counts[p.id] ?? 0) === 1 ? '' : 's'} · {p.graceDays} grace days {!p.active && '· not offered'}
              </p>
            </div>
          </div>
          {p.description && <p className="mt-3 text-sm text-muted">{p.description}</p>}
          <ul className="mt-3 grid gap-1 text-sm">
            {p.features.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-accent-fg">✓</span> {f}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
            {Object.entries(p.prices).map(([c, v]) => (
              <span key={c} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold tabular-nums">
                {formatMoney(v as number, c as keyof typeof CURRENCY_META)}
              </span>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <PlanDialog plan={p} />
            <ActionButton variant="ghost" size="sm" confirm confirmLabel="Delete plan?" action={deletePlan.bind(null, p.id)}>
              <Trash2 />
            </ActionButton>
          </div>
        </article>
      ))}
    </div>
  );
}
