/**
 * npm run seed        -> creates your admin account + default site settings
 * npm run seed:demo   -> also adds 2 demo clients, 3 projects and payments
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import '../src/lib/dns-fix';

import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../src/lib/models/User';
import { Project } from '../src/lib/models/Project';
import { Payment } from '../src/lib/models/Payment';
import { Settings } from '../src/lib/models/Settings';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';
import { Subscription } from '../src/lib/models/Subscription';
import { Invoice } from '../src/lib/models/Invoice';
import { createInvoiceForPayment } from '../src/lib/invoices';
import { addMonths, monthKey } from '../src/lib/periods';

async function main() {
  const uri = process.env.MONGODB_URI;
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = 'Admin' } = process.env;
  if (!uri) throw new Error('MONGODB_URI missing in .env.local');
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 10)
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (10+ chars) in .env.local');

  await mongoose.connect(uri);
  await Promise.all([User.syncIndexes(), Project.syncIndexes(), Payment.syncIndexes(), Settings.syncIndexes()]);

  const email = ADMIN_EMAIL.toLowerCase();
  if (await User.exists({ email })) console.log(`Admin ${email} already exists, skipping.`);
  else {
    await User.create({ name: ADMIN_NAME, email, role: 'admin', passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12) });
    console.log(`Admin created: ${email}`);
  }

  if (!(await Settings.exists({ key: 'site' }))) {
    await Settings.create({ key: 'site', ...DEFAULT_SETTINGS, name: ADMIN_NAME, email, yearsExperience: process.argv.includes('--demo') ? 6 : 0 });
    console.log('Default site settings created.');
  }

  if (process.argv.includes('--demo')) {
    const pw = await bcrypt.hash('demo-client-123', 12);
    const a = await User.findOneAndUpdate(
      { email: 'priya@demo.test' },
      { name: 'Priya Sharma', company: 'Lotus Retail', role: 'client', preferredCurrency: 'INR', passwordHash: pw },
      { upsert: true, new: true },
    );
    const b = await User.findOneAndUpdate(
      { email: 'liam@demo.test' },
      { name: 'Liam Carter', company: 'Northbay Labs', role: 'client', preferredCurrency: 'CAD', passwordHash: pw },
      { upsert: true, new: true },
    );
    const month = (m: number, d = 12) => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - m, d));

    const p1 = await Project.create({
      client: a._id, name: 'Lotus storefront', status: 'delivered', totalCost: 180000, currency: 'INR',
      stack: ['Next.js', 'Node.js', 'MongoDB', 'Razorpay'], startDate: month(7), deliveredAt: month(3),
      summary: 'Headless e-commerce storefront with inventory sync and Razorpay checkout.', showInPortfolio: true, sortOrder: 1,
      outcome: 'Checkout time cut from 4 minutes to under 90 seconds.',
      testimonial: { quote: 'Launched a week early and our mobile conversions jumped in the first month.', author: 'Priya Sharma', role: 'Founder, Lotus Retail' },
      liveUrl: 'https://example.com', previewUrl: 'https://example.netlify.app',
    });
    const p2 = await Project.create({
      client: b._id, name: 'Northbay analytics dashboard', status: 'in-progress', totalCost: 14500, currency: 'CAD',
      stack: ['React', 'NestJS', 'PostgreSQL', 'AWS'], startDate: month(4),
      summary: 'Real-time lab analytics with role-based access and scheduled PDF reports.', showInPortfolio: true, sortOrder: 2,
      outcome: 'Weekly reporting went from two days of spreadsheets to one click.', liveUrl: 'https://example.com',
    });
    const p3 = await Project.create({
      client: b._id, name: 'Sample-tracking mobile app', status: 'planning', totalCost: 6000, currency: 'USD',
      stack: ['React Native', 'Expo'], startDate: month(0, 2), showInPortfolio: true, sortOrder: 3,
      outcome: 'Barcode tracking for every sample, online or offline.',
    });
    await Payment.insertMany([
      { project: p1._id, client: a._id, amount: 60000, currency: 'INR', fxRate: 1, amountInProjectCurrency: 60000, paidAt: month(7, 5), method: 'upi', reference: 'INV-001' },
      { project: p1._id, client: a._id, amount: 60000, currency: 'INR', fxRate: 1, amountInProjectCurrency: 60000, paidAt: month(5, 9), method: 'bank', reference: 'INV-004' },
      { project: p1._id, client: a._id, amount: 45000, currency: 'INR', fxRate: 1, amountInProjectCurrency: 45000, paidAt: month(3, 20), method: 'bank', reference: 'INV-007' },
      { project: p2._id, client: b._id, amount: 4000, currency: 'CAD', fxRate: 1, amountInProjectCurrency: 4000, paidAt: month(4, 3), method: 'interac', reference: 'INV-005' },
      { project: p2._id, client: b._id, amount: 3000, currency: 'USD', fxRate: 1.37, amountInProjectCurrency: 4110, paidAt: month(1, 14), method: 'wise', reference: 'INV-009', note: 'Milestone 2: dashboards' },
      { project: p3._id, client: b._id, amount: 1500, currency: 'USD', fxRate: 1, amountInProjectCurrency: 1500, paidAt: month(0, 3), method: 'stripe', reference: 'INV-010', note: 'Deposit' },
    ]);
    // Monthly services: Liam hasn't paid this month yet (his portal shows the alert); Priya is fully paid.
    const thisMonth = monthKey();
    const social = await Subscription.create({
      client: b._id, name: 'Social media management', currency: 'CAD', amount: 800, dueDay: 5, startMonth: addMonths(thisMonth, -3),
      priceHistory: [{ from: addMonths(thisMonth, -3), amount: 800 }],
      description: '12 posts a month across Instagram and LinkedIn, plus a monthly performance report.',
    });
    const care = await Subscription.create({
      client: a._id, name: 'Website care plan', currency: 'INR', amount: 6000, dueDay: 10, startMonth: addMonths(thisMonth, -2),
      priceHistory: [{ from: addMonths(thisMonth, -2), amount: 6000 }],
      description: 'Hosting, security updates, backups and up to 3 hours of changes a month.',
    });
    const subPay = (sub: typeof social, client: unknown, period: string, amount: number, method: string) => ({
      subscription: sub._id, period, client, amount, currency: sub.currency, fxRate: 1, amountInProjectCurrency: amount,
      paidAt: new Date(`${period}-04T00:00:00Z`), method, reference: `UTR${Math.floor(Math.random() * 1e8)}`,
    });
    await Payment.insertMany([
      subPay(social, b._id, addMonths(thisMonth, -3), 800, 'interac'),
      subPay(social, b._id, addMonths(thisMonth, -2), 800, 'interac'),
      subPay(social, b._id, addMonths(thisMonth, -1), 400, 'interac'),
      subPay(care, a._id, addMonths(thisMonth, -2), 6000, 'upi'),
      subPay(care, a._id, addMonths(thisMonth, -1), 6000, 'upi'),
      subPay(care, a._id, thisMonth, 6000, 'upi'),
    ]);

    // Invoices for every demo payment; the older ones are marked as already sent.
    const all = await Payment.find({ client: { $in: [a._id, b._id] }, invoice: null }).sort({ paidAt: 1 });
    for (const [i, pay] of all.entries()) {
      const inv = await createInvoiceForPayment(pay._id);
      if (inv && i < all.length - 2) await Invoice.updateOne({ _id: inv._id }, { status: 'sent', sentAt: new Date(), sentTo: 'demo' });
    }
    console.log('Demo data added. Client logins: priya@demo.test / liam@demo.test, password demo-client-123');
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
