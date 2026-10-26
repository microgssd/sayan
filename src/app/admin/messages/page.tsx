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
  const view = searchParams.view === 'archived' ? 'archived' : searchParams.view === 'spam' ? 'spam' : 'inbox';
  const archived = view === 'archived';
  const docs: any[] = await Message.find(view === 'inbox' ? { status: { $in: ['new', 'read'] } } : { status: view })
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
    spamReasons: m.spamReasons ?? [],
  }));
  const spamCount = await Message.countDocuments({ status: 'spam' });

  return (
    <>
      <PageHeader title="Messages" description="Enquiries from the contact form on your site.">
        <div className="inline-flex rounded-full border border-line bg-surface p-1 text-sm font-semibold">
          {[
            ['Inbox', '/admin/messages', view === 'inbox'],
            ['Archived', '/admin/messages?view=archived', archived],
            [`Spam${spamCount ? ` (${spamCount})` : ''}`, '/admin/messages?view=spam', view === 'spam'],
          ].map(([label, href, on]) => (
            <Link key={String(label)} href={String(href)} className={cn('rounded-full px-4 py-1.5', on ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink')}>
              {label}
            </Link>
          ))}
        </div>
      </PageHeader>
      {messages.length === 0 ? (
        <EmptyState title={view === 'spam' ? 'No spam' : archived ? 'Nothing archived' : 'No messages yet'}>
          {view === 'spam'
            ? 'Messages the spam filter catches land here, so nothing real is ever lost. Review them now and then.'
            : archived
              ? 'Archived enquiries show up here.'
              : 'When someone fills in the contact form on your homepage, it lands here.'}
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
