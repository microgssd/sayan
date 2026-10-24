import { requireAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/ledger';
import { translationProvider } from '@/lib/translate';
import { PageHeader } from '@/components/admin/shell';
import { PasswordForm, SettingsForm } from '@/components/admin/settings-form';

export default async function SettingsPage() {
  await requireAdmin();
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Site & profile" description="Everything on your public homepage comes from here." />
      <SettingsForm settings={settings} autoTranslate={translationProvider()} />
      <PasswordForm />
    </>
  );
}
