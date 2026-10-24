'use server';

import { isValidObjectId } from 'mongoose';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../auth';
import { connectDB } from '../db';
import { createInvoiceForPayment, emailInvoice, invoiceEmailReady } from '../invoices';
import { getSettings } from '../ledger';
import { Invoice } from '../models/Invoice';
import type { ActionResult } from '../types';

const fail = (error: string): ActionResult => ({ ok: false, error });
const refresh = () => {
  revalidatePath('/admin', 'layout');
  revalidatePath('/portal');
};

/** Emails the PDF to the client. Only you can trigger this. */
export async function sendInvoice(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(id)) return fail('Invoice not found.');
  if (!invoiceEmailReady()) return fail('Email isn’t set up. Add RESEND_API_KEY and CONTACT_FROM_EMAIL, or download the PDF and use “Mark as sent”.');
  await connectDB();
  const inv = await Invoice.findById(id);
  if (!inv) return fail('Invoice not found.');
  if (inv.status === 'void') return fail('This invoice is void and can’t be sent.');
  if (!inv.clientEmail) return fail('This client has no email address.');
  const s = await getSettings();
  try {
    await emailInvoice(inv.toObject(), { name: s.name, email: s.email, location: s.location }, inv.clientEmail);
  } catch (err) {
    return fail((err as Error).message);
  }
  inv.set({ status: 'sent', sentAt: new Date(), sentTo: inv.clientEmail });
  await inv.save();
  refresh();
  return { ok: true, message: `${inv.number} sent to ${inv.clientEmail}.` };
}

/** For invoices you delivered yourself (WhatsApp, your own email). Makes it visible in the client’s portal. */
export async function markInvoiceSent(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(id)) return fail('Invoice not found.');
  await connectDB();
  const inv = await Invoice.findById(id);
  if (!inv || inv.status === 'void') return fail('Invoice not found.');
  inv.set({ status: 'sent', sentAt: new Date(), sentTo: inv.sentTo || 'delivered manually' });
  await inv.save();
  refresh();
  return { ok: true, message: `${inv.number} marked as sent. The client can now download it.` };
}

/** For payments recorded before invoices existed. */
export async function createInvoice(paymentId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(paymentId)) return fail('Payment not found.');
  const inv = await createInvoiceForPayment(paymentId);
  refresh();
  return inv ? { ok: true, message: `Invoice ${inv.number} created.` } : fail('This payment already has an invoice.');
}
