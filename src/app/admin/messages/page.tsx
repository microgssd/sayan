import { requireAdmin } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { Message } from '@/lib/models/Message';
import { PageHeader } from '@/components/admin/shell';
import { MessageCard, type MessageRow } from '@/components/admin/message-card';
import { EmptyState } from '@/components/ui';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default async function MessagesPage({ searchParams }: { searchParams: { view?: string } }) {
  await requireAdmin();
  await connectDB();
  const archived = searchParams.view === 'archived';
  const docs: any[] = await Message.find(archived ? { status: 'archived' } : { status: { $ne: 'archived' } })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  const messages: MessageRow[] = docs.map((m) => ({
    id: String(m._id),
    name: m.name,
    email: m.email,
    company: m.company ?? '',
    projectTypes: m.projectTypes ?? [],
    budget: m.budget ?? '',
    details: m.details ?? '',
    status: m.status,
    city: m.city ?? '',
    country: m.country ?? '',
    createdAt: new Date(m.createdAt).toISOString(),
  }));

  return (
    <>
      <PageHeader title="Messages" description="Enquiries from the contact form on your site.">
        <div className="inline-flex rounded-full border border-line bg-surface p-1 text-sm font-semibold">
          {[
            ['Inbox', '/admin/messages', !archived],
            ['Archived', '/admin/messages?view=archived', archived],
          ].map(([label, href, on]) => (
            <Link key={String(label)} href={String(href)} className={cn('rounded-full px-4 py-1.5', on ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink')}>
              {label}
            </Link>
          ))}
        </div>
      </PageHeader>
      {messages.length === 0 ? (
        <EmptyState title={archived ? 'Nothing archived' : 'No messages yet'}>
          {archived ? 'Archived enquiries show up here.' : 'When someone fills in the contact form on your homepage, it lands here.'}
        </EmptyState>
      ) : (
        <div className="grid gap-3">
          {messages.map((m) => (
            <MessageCard key={m.id} message={m} />
          ))}
        </div>
      )}
    </>
  );
}
