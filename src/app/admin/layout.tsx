import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { AdminShell } from '@/components/admin/shell';
import { I18nProvider } from '@/components/i18n';
import { connectDB } from '@/lib/db';
import { Message } from '@/lib/models/Message';
import { ChatSession } from '@/lib/models/Chat';

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  await connectDB();
  const [unread, waitingChats] = await Promise.all([
    Message.countDocuments({ status: 'new' }),
    // Conversations where the visitor spoke last and you haven't read or answered since.
    ChatSession.countDocuments({
      status: 'open',
      lastVisitorAt: { $ne: null },
      $expr: {
        $and: [
          { $gt: ['$lastVisitorAt', { $ifNull: ['$lastOwnerAt', new Date(0)] }] },
          { $gt: ['$lastVisitorAt', { $ifNull: ['$ownerReadAt', new Date(0)] }] },
        ],
      },
    }),
  ]);
  return (
    // Your dashboard stays in English whatever language the public site is set to.
    <I18nProvider lang="en">
      <AdminShell name={session.name} unread={unread} waitingChats={waitingChats}>
        {children}
      </AdminShell>
    </I18nProvider>
  );
}
