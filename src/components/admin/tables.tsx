'use client';

import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { deletePayment } from '@/lib/actions/payments';
import { deleteProject } from '@/lib/actions/projects';
import { METHOD_LABEL, type ClientLite, type PaymentRow, type ProjectRow } from '@/lib/types';
import { formatMoney } from '@/lib/currency';
import { formatDate } from '@/lib/utils';
import { Money } from '../currency-context';
import { ActionButton, EmptyState, PaidBar, StatusBadge } from '../ui';
import type { ProjectOption } from '@/lib/options';
import { PaymentDialog } from './payment-dialog';
import { ProjectDialog } from './project-dialog';
import { InvoiceCell } from './invoice-cell';
import { Repeat } from 'lucide-react';

export function ProjectsTable({ projects, clients, showClient = true }: { projects: ProjectRow[]; clients: ClientLite[]; showClient?: boolean }) {
  if (!projects.length) return <EmptyState title="No projects yet">Create a project to start tracking its cost and payments.</EmptyState>;
  return (
    <>
    {/* Phones: one card per project */}
    <ul className="grid gap-3 md:hidden">
      {projects.map((p) => (
        <li key={p.id} className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{p.name}</p>
              <p className="mt-0.5 truncate text-xs text-muted">
                {showClient && (p.client ? p.client.name : 'Personal')}
                {showClient && ', '}
                {p.currency}
                {p.showInPortfolio && ', on portfolio'}
              </p>
            </div>
            <StatusBadge status={p.status} />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted">Cost</dt>
              <dd className="font-semibold"><Money amount={p.totalCost} from={p.currency} compact /></dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Paid</dt>
              <dd className="font-semibold text-accent-fg"><Money amount={p.paid} from={p.currency} compact /></dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{p.overpaid > 0 ? 'Credit' : 'Pending'}</dt>
              <dd className="font-semibold text-brass"><Money amount={p.overpaid > 0 ? p.overpaid : p.pending} from={p.currency} compact /></dd>
            </div>
          </dl>
          <div className="mt-3"><PaidBar paid={p.paid} total={p.totalCost} /></div>
          <div className="mt-3 flex justify-end gap-1 border-t border-line pt-3">
            <ProjectDialog project={p} clients={clients} />
            <ActionButton variant="danger" size="sm" confirm confirmLabel="Delete project + payments?" action={() => deleteProject(p.id)} aria-label={`Delete ${p.name}`}>
              <Trash2 />
            </ActionButton>
          </div>
        </li>
      ))}
    </ul>
    <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface md:block" data-lenis-prevent>
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="px-5 py-3 font-semibold">Project</th>
            {showClient && <th className="px-3 py-3 font-semibold">Client</th>}
            <th className="px-3 py-3 font-semibold">Status</th>
            <th className="px-3 py-3 text-right font-semibold">Cost</th>
            <th className="px-3 py-3 text-right font-semibold">Paid</th>
            <th className="px-3 py-3 text-right font-semibold">Pending</th>
            <th className="w-40 px-3 py-3 font-semibold">Progress</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} className="border-b border-line last:border-0 transition-colors hover:bg-surface-2/50">
              <td className="px-5 py-4">
                <p className="font-semibold">{p.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {p.currency}
                  {p.showInPortfolio && ', on portfolio'}
                </p>
              </td>
              {showClient && (
                <td className="px-3 py-4">
                  {p.client ? (
                    <Link href={`/admin/clients/${p.client.id}`} className="hover:text-accent-fg">
                      {p.client.name}
                    </Link>
                  ) : (
                    <span className="text-muted">Personal</span>
                  )}
                </td>
              )}
              <td className="px-3 py-4">
                <StatusBadge status={p.status} />
              </td>
              <td className="px-3 py-4 text-right">
                <Money amount={p.totalCost} from={p.currency} />
              </td>
              <td className="px-3 py-4 text-right text-accent-fg">
                <Money amount={p.paid} from={p.currency} />
              </td>
              <td className="px-3 py-4 text-right">
                {p.overpaid > 0 ? (
                  <span className="text-xs font-semibold text-brass">Overpaid {formatMoney(p.overpaid, p.currency)}</span>
                ) : (
                  <Money amount={p.pending} from={p.currency} className={p.pending > 0 ? 'text-brass' : 'text-muted'} />
                )}
              </td>
              <td className="px-3 py-4">
                <PaidBar paid={p.paid} total={p.totalCost} />
              </td>
              <td className="px-5 py-4">
                <div className="flex justify-end gap-1">
                  <ProjectDialog project={p} clients={clients} />
                  <ActionButton variant="danger" size="sm" confirm confirmLabel="Delete project + payments?" action={() => deleteProject(p.id)} aria-label={`Delete ${p.name}`}>
                    <Trash2 />
                  </ActionButton>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

export function PaymentsTable({ payments, projects, showProject = true }: { payments: PaymentRow[]; projects: ProjectOption[]; showProject?: boolean }) {
  return (
    <>
    {/* Phones: stacked rows */}
    <ul className="divide-y divide-line md:hidden">
      {payments.map((p) => (
        <li key={p.id} className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0">
            {showProject && (
              <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                {p.kind === 'subscription' && <Repeat className="h-3.5 w-3.5 shrink-0 text-accent-fg" aria-label="Subscription" />}
                {p.projectName}
              </p>
            )}
            <p className="truncate text-xs text-muted">
              {formatDate(p.paidAt, { day: 'numeric', month: 'short', year: 'numeric' })}, {METHOD_LABEL[p.method]}
              {p.clientName && showProject && `, ${p.clientName}`}
            </p>
            <div className="mt-1 -ml-2">
              <InvoiceCell payment={p} />
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums">{formatMoney(p.amount, p.currency)}</p>
            <div className="-mr-2 flex justify-end">
              {p.kind === 'project' && <PaymentDialog payment={p} projects={projects} />}
              <ActionButton variant="danger" size="sm" confirm confirmLabel="Delete?" action={() => deletePayment(p.id)} aria-label="Delete payment">
                <Trash2 />
              </ActionButton>
            </div>
          </div>
        </li>
      ))}
    </ul>
    <div className="hidden overflow-x-auto md:block" data-lenis-prevent>
      <table className="w-full min-w-[820px] text-sm">
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-b border-line last:border-0">
              <td className="w-28 py-3 pr-3 text-muted tabular-nums">{formatDate(p.paidAt, { day: 'numeric', month: 'short' })}</td>
              {showProject && (
                <td className="py-3 pr-3">
                  <p className="flex items-center gap-1.5 font-medium">
                    {p.kind === 'subscription' && <Repeat className="h-3.5 w-3.5 shrink-0 text-accent-fg" aria-label="Subscription" />}
                    {p.projectName}
                  </p>
                  {p.clientName && <p className="text-xs text-muted">{p.clientName}</p>}
                </td>
              )}
              <td className="py-3 pr-3 text-muted">
                {METHOD_LABEL[p.method]}
                {p.reference && <span className="block text-xs">{p.reference}</span>}
              </td>
              <td className="py-3 pr-3">
                <InvoiceCell payment={p} />
              </td>
              <td className="py-3 pr-3 text-right">
                <span className="font-semibold tabular-nums">{formatMoney(p.amount, p.currency)}</span>
                {p.currency !== p.projectCurrency && (
                  <span className="block text-xs text-muted tabular-nums">= {formatMoney(p.amountInProjectCurrency, p.projectCurrency)}</span>
                )}
              </td>
              <td className="w-24 py-3">
                <div className="flex justify-end">
                  {p.kind === 'project' && <PaymentDialog payment={p} projects={projects} />}
                  <ActionButton variant="danger" size="sm" confirm confirmLabel="Delete?" action={() => deletePayment(p.id)} aria-label="Delete payment">
                    <Trash2 />
                  </ActionButton>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
