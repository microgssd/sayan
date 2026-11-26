import { requireAdmin } from '@/lib/auth';
import { loadAllPayments, loadLedger } from '@/lib/ledger';
import { toOptions } from '@/lib/options';
import { PageHeader } from '@/components/admin/shell';
import { PaymentDialog } from '@/components/admin/payment-dialog';
import { PaymentsExplorer } from '@/components/admin/payments-explorer';

export default async function PaymentsPage() {
  await requireAdmin();
  const [projects, payments] = await Promise.all([loadLedger(), loadAllPayments()]);
  const options = toOptions(projects);
  return (
    <>
      <PageHeader title="Payments" description="Every payment with its invoice. Send invoices to clients from here.">
        <PaymentDialog projects={options} />
      </PageHeader>
      <PaymentsExplorer payments={payments} projects={options} />
    </>
  );
}
