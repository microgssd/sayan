'use client';

import { FileDown, FilePlus2, Send } from 'lucide-react';
import { createInvoice, markInvoiceSent, sendInvoice } from '@/lib/actions/invoices';
import type { PaymentRow } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ActionButton } from '../ui';

const tone = { draft: 'bg-brass/15 text-brass', sent: 'bg-accent/15 text-accent-fg', void: 'bg-danger/10 text-danger line-through' };
const label = { draft: 'Not sent', sent: 'Sent', void: 'Void' };

/** Invoice number, status and the send/download controls for one payment. Admin only. */
export function InvoiceCell({ payment: p, compact }: { payment: PaymentRow; compact?: boolean }) {
  const inv = p.invoice;
  if (!inv)
    return (
      <ActionButton variant="ghost" size="sm" action={createInvoice.bind(null, p.id)}>
        <FilePlus2 /> Create invoice
      </ActionButton>
    );
  return (
    <div className={cn('flex flex-wrap items-center gap-1', compact && 'justify-end')}>
      <span className="font-mono text-xs font-semibold">{inv.number}</span>
      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', tone[inv.status])}>{label[inv.status]}</span>
      <a
        href={`/api/invoices/${inv.id}/pdf`}
        target="_blank"
        rel="noreferrer"
        title="Download PDF"
        aria-label={`Download ${inv.number}`}
        className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
      >
        <FileDown className="h-4 w-4" />
      </a>
      {inv.status === 'draft' && (
        <>
          <ActionButton variant="ghost" size="sm" action={sendInvoice.bind(null, inv.id)} title="Email the PDF to the client">
            <Send /> Send
          </ActionButton>
          <ActionButton variant="ghost" size="sm" action={markInvoiceSent.bind(null, inv.id)} title="You sent it yourself">
            Mark sent
          </ActionButton>
        </>
      )}
    </div>
  );
}
