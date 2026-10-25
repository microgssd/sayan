import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { connectDB } from './db';
import { round2, type Currency } from './currency';
import { Counter, Invoice, type InvoiceDoc } from './models/Invoice';
import { Payment } from './models/Payment';
import { Project } from './models/Project';
import { Subscription } from './models/Subscription';
import { User } from './models/User';
import { monthLabel, priceFor } from './periods';
import { METHOD_LABEL, type PaymentMethod } from './types';


/** INV-2026-0001, INV-2026-0002 … numbered per calendar year, never reused. */
export async function nextInvoiceNumber(date = new Date()) {
  const year = date.getUTCFullYear();
  const c = await Counter.findOneAndUpdate({ _id: `invoice-${year}` }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return `INV-${year}-${String(c.seq).padStart(4, '0')}`;
}

/** Figures for a payment as they stand right now (used for new and still-unsent invoices). */
async function snapshot(pay: any) {
  if (pay.project) {
    const proj: any = await Project.findById(pay.project).lean();
    if (!proj) return null;
    const all: any[] = await Payment.find({ project: proj._id }).lean();
    // Paid to date counts this payment and everything received on or before its date.
    const upTo = all.filter((p) => p.paidAt < pay.paidAt || (p.paidAt.getTime() === pay.paidAt.getTime() && p.createdAt <= pay.createdAt));
    const paidToDate = round2(upTo.reduce((t, p) => t + p.amountInProjectCurrency, 0));
    return { kind: 'project', itemName: proj.name, period: '', currency: proj.currency, totalCost: proj.totalCost, paidToDate, pending: round2(Math.max(proj.totalCost - paidToDate, 0)) };
  }
  const sub: any = await Subscription.findById(pay.subscription).lean();
  if (!sub) return null;
  const all: any[] = await Payment.find({ subscription: sub._id, period: pay.period }).lean();
  const paidToDate = round2(all.filter((p) => p.createdAt <= pay.createdAt).reduce((t, p) => t + p.amountInProjectCurrency, 0));
  const price = priceFor(sub, pay.period);
  return { kind: 'subscription', itemName: sub.name, period: pay.period, currency: sub.currency, totalCost: price, paidToDate, pending: round2(Math.max(price - paidToDate, 0)) };
}

/** Creates the invoice for a payment (once). Called automatically whenever you record a payment. */
export async function createInvoiceForPayment(paymentId: unknown) {
  await connectDB();
  const pay: any = await Payment.findById(paymentId).lean();
  if (!pay || pay.invoice) return null;
  const snap = await snapshot(pay);
  if (!snap) return null;
  const client: any = pay.client ? await User.findById(pay.client).lean() : null;
  const inv = await Invoice.create({
    number: await nextInvoiceNumber(),
    payment: pay._id,
    client: pay.client ?? null,
    clientName: client?.name ?? '',
    clientCompany: client?.company ?? '',
    clientEmail: client?.email ?? '',
    ...snap,
    amountPaid: pay.amountInProjectCurrency,
    receivedAmount: pay.amount,
    receivedCurrency: pay.currency,
    fxRate: pay.fxRate,
    paymentDate: pay.paidAt,
    method: pay.method,
    reference: pay.reference ?? '',
  });
  await Payment.updateOne({ _id: pay._id }, { invoice: inv._id, invoiceNumber: inv.number });
  return inv;
}

/** After a payment is edited: unsent invoices are refreshed, sent ones are left exactly as the client received them. */
export async function refreshInvoiceForPayment(paymentId: unknown) {
  const pay: any = await Payment.findById(paymentId).lean();
  if (!pay?.invoice) return;
  const inv = await Invoice.findById(pay.invoice);
  if (!inv || inv.status !== 'draft') return;
  const snap = await snapshot(pay);
  if (!snap) return;
  inv.set({ ...snap, amountPaid: pay.amountInProjectCurrency, receivedAmount: pay.amount, receivedCurrency: pay.currency, fxRate: pay.fxRate, paymentDate: pay.paidAt, method: pay.method, reference: pay.reference ?? '' });
  await inv.save();
}

/** A deleted payment voids its invoice. The number is kept, never reused, for a clean audit trail. */
export async function voidInvoiceForPayment(paymentId: unknown) {
  await Invoice.updateOne({ payment: paymentId }, { status: 'void' });
}

/* ---------------- PDF ---------------- */

// Standard PDF fonts can't draw every character; map the common ones and drop the rest safely.
const pdfSafe = (s: string) =>
  s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u00A0\u202F\u2009]/g, ' ')
    .replace(/\u20B9/g, 'Rs ')
    .replace(/[^\x20-\x7E\xA0-\xFF\u20AC]/g, '?');

const money = (n: number, c: string) =>
  `${c} ${new Intl.NumberFormat(c === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
const day = (d: Date | string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const INK = rgb(0.07, 0.09, 0.15);
const MUTED = rgb(0.38, 0.41, 0.48);
const LINE = rgb(0.88, 0.89, 0.92);
const ACCENT = rgb(0.659, 0.333, 0.969); // #A855F7
const ACCENT_SOFT = rgb(0.965, 0.937, 0.996);

export type Issuer = { name: string; email: string; location: string };

export async function renderInvoicePdf(inv: InvoiceDoc & { createdAt?: Date }, issuer: Issuer) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${inv.number}`);
  doc.setAuthor(issuer.name);
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = page.getWidth();
  const M = 56;

  const text = (p: PDFPage, s: string, x: number, y: number, size: number, f: PDFFont = font, color = INK) =>
    p.drawText(pdfSafe(s), { x, y, size, font: f, color });
  const right = (p: PDFPage, s: string, xr: number, y: number, size: number, f: PDFFont = font, color = INK) =>
    text(p, s, xr - f.widthOfTextAtSize(pdfSafe(s), size), y, size, f, color);

  // Header
  page.drawRectangle({ x: 0, y: 841.89 - 8, width: W, height: 8, color: ACCENT });
  let y = 770;
  text(page, issuer.name, M, y, 20, bold);
  text(page, issuer.email, M, y - 20, 10, font, MUTED);
  if (issuer.location) text(page, issuer.location, M, y - 34, 10, font, MUTED);
  right(page, 'INVOICE', W - M, y - 2, 26, bold, ACCENT);
  right(page, inv.number, W - M, y - 22, 11, bold);
  right(page, `Issued ${day(inv.createdAt ?? new Date())}`, W - M, y - 37, 10, font, MUTED);

  const full = inv.pending <= 0.009;
  const stamp = full ? 'PAID' : 'PART PAID';
  const sw = bold.widthOfTextAtSize(stamp, 10) + 20;
  page.drawRectangle({ x: W - M - sw, y: y - 66, width: sw, height: 20, color: full ? rgb(0.86, 0.97, 0.91) : rgb(1, 0.95, 0.82) });
  right(page, stamp, W - M - 10, y - 59, 10, bold, full ? rgb(0.05, 0.5, 0.3) : rgb(0.6, 0.38, 0.02));

  // Bill to
  y = 650;
  text(page, 'BILLED TO', M, y, 9, bold, MUTED);
  text(page, inv.clientName || 'Client', M, y - 18, 13, bold);
  let by = y - 34;
  if (inv.clientCompany) (text(page, inv.clientCompany, M, by, 10, font, MUTED), (by -= 14));
  if (inv.clientEmail) text(page, inv.clientEmail, M, by, 10, font, MUTED);
  text(page, 'PAYMENT DATE', W / 2 + 20, y, 9, bold, MUTED);
  text(page, day(inv.paymentDate), W / 2 + 20, y - 18, 12, bold);
  text(page, 'METHOD', W / 2 + 20, y - 40, 9, bold, MUTED);
  text(page, METHOD_LABEL[inv.method as PaymentMethod] ?? inv.method, W / 2 + 20, y - 54, 11);
  if (inv.reference) {
    text(page, 'REFERENCE', W / 2 + 140, y - 40, 9, bold, MUTED);
    text(page, inv.reference, W / 2 + 140, y - 54, 11);
  }

  // Line item
  y = 540;
  page.drawRectangle({ x: M, y: y - 8, width: W - 2 * M, height: 26, color: ACCENT_SOFT });
  text(page, 'DESCRIPTION', M + 12, y, 9, bold, MUTED);
  right(page, 'AMOUNT', W - M - 12, y, 9, bold, MUTED);
  y -= 34;
  const label = inv.kind === 'subscription' ? `${inv.itemName}, ${monthLabel(inv.period, 'long')}` : inv.itemName;
  text(page, label, M + 12, y, 12, bold);
  text(page, inv.kind === 'subscription' ? 'Monthly subscription' : 'Project payment', M + 12, y - 15, 10, font, MUTED);
  right(page, money(inv.amountPaid, inv.currency), W - M - 12, y, 12, bold);
  y -= 34;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINE });

  // Summary
  y -= 30;
  const rows: [string, string, boolean?][] = [
    [inv.kind === 'subscription' ? 'Monthly fee' : 'Total project cost', money(inv.totalCost, inv.currency)],
    ['Paid with this invoice', money(inv.amountPaid, inv.currency)],
    [inv.kind === 'subscription' ? 'Paid for this month' : 'Total paid to date', money(inv.paidToDate, inv.currency)],
    ['Balance pending', money(inv.pending, inv.currency), true],
  ];
  const sx = W / 2;
  for (const [k, v, strong] of rows) {
    if (strong) {
      page.drawRectangle({ x: sx - 12, y: y - 9, width: W - M - sx + 12, height: 28, color: ACCENT_SOFT });
      text(page, k, sx, y, 11, bold);
      right(page, v, W - M - 12, y, 13, bold, inv.pending > 0.009 ? rgb(0.6, 0.38, 0.02) : INK);
    } else {
      text(page, k, sx, y, 10, font, MUTED);
      right(page, v, W - M - 12, y, 11, bold);
    }
    y -= strong ? 34 : 22;
  }

  if (inv.receivedCurrency !== inv.currency) {
    text(page, `Received ${money(inv.receivedAmount, inv.receivedCurrency)} at 1 ${inv.receivedCurrency} = ${inv.fxRate.toFixed(4)} ${inv.currency}.`, M, y - 4, 9, font, MUTED);
    y -= 18;
  }

  // Footer
  page.drawLine({ start: { x: M, y: 90 }, end: { x: W - M, y: 90 }, thickness: 1, color: LINE });
  text(page, 'Thank you for your business.', M, 68, 11, bold);
  text(page, `Questions about this invoice? Email ${issuer.email}`, M, 52, 9, font, MUTED);
  right(page, inv.number, W - M, 52, 9, font, MUTED);
  if (inv.status === 'void') {
    page.drawText('VOID', { x: 150, y: 380, size: 120, font: bold, color: rgb(0.85, 0.2, 0.2), opacity: 0.18 });
  }
  return doc.save();
}

/** Plain-text version, used as the email body. */
export function invoiceText(inv: InvoiceDoc, issuer: Issuer) {
  const label = inv.kind === 'subscription' ? `${inv.itemName}, ${monthLabel(inv.period, 'long')}` : inv.itemName;
  return [
    `Hi ${inv.clientName.split(' ')[0] || 'there'},`,
    '',
    `Thank you for your payment. Your invoice ${inv.number} is attached.`,
    '',
    `${label}`,
    `Payment date: ${day(inv.paymentDate)}`,
    `Amount paid: ${money(inv.amountPaid, inv.currency)}`,
    `${inv.kind === 'subscription' ? 'Monthly fee' : 'Total project cost'}: ${money(inv.totalCost, inv.currency)}`,
    `Paid to date: ${money(inv.paidToDate, inv.currency)}`,
    `Balance pending: ${money(inv.pending, inv.currency)}`,
    '',
    `You can see all your payments and invoices in your client portal.`,
    '',
    issuer.name,
  ].join('\n');
}

export const invoiceEmailReady = () => Boolean(process.env.RESEND_API_KEY && process.env.CONTACT_FROM_EMAIL);

export async function emailInvoice(inv: InvoiceDoc & { createdAt?: Date }, issuer: Issuer, to: string) {
  const pdf = await renderInvoicePdf(inv, issuer);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM_EMAIL,
      to,
      reply_to: issuer.email,
      subject: `Invoice ${inv.number} from ${issuer.name}`,
      text: invoiceText(inv, issuer),
      attachments: [{ filename: `${inv.number}.pdf`, content: Buffer.from(pdf).toString('base64') }],
    }),
  });
  if (!res.ok) throw new Error(`Email failed (${res.status}): ${(await res.text()).slice(0, 160)}`);
}

export type { Currency };
