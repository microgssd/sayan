import { requireAdmin } from '@/lib/auth';
import { loadClients, loadLedger } from '@/lib/ledger';
import { PageHeader } from '@/components/admin/shell';
import { ProjectDialog } from '@/components/admin/project-dialog';
import { ProjectsTable } from '@/components/admin/tables';

export default async function ProjectsPage() {
  await requireAdmin();
  const [projects, clients] = await Promise.all([loadLedger(), loadClients()]);
  return (
    <>
      <PageHeader title="Projects" description="Client builds and personal projects. Tick “Show on public portfolio” to feature one on your site.">
        <ProjectDialog clients={clients} />
      </PageHeader>
      <ProjectsTable projects={projects} clients={clients} />
    </>
  );
}
