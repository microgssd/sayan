import { NextResponse } from 'next/server';
import { isValidObjectId } from 'mongoose';
import { getSession } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { renderInvoicePdf } from '@/lib/invoices';
import { getSettings } from '@/lib/ledger';
import { Invoice } from '@/lib/models/Invoice';

export const dynamic = 'force-dynamic';

// PDFs are generated on the fly from the stored invoice data; nothing is cached or saved.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (!isValidObjectId(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await connectDB();
  const inv = await Invoice.findById(params.id).lean();
  // Clients only ever see their own invoices, and only once you've sent them.
  const allowed = inv && (session.role === 'admin' || (String(inv.client) === session.sub && inv.status === 'sent'));
  if (!inv || !allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const s = await getSettings();
  const pdf = await renderInvoicePdf(inv, { name: s.name, email: s.email, location: s.location });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${inv.number}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
