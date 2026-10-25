import 'server-only';
import { cache } from 'react';
import { connectDB } from './db';
import { Project } from './models/Project';
import { Payment } from './models/Payment';
import { User } from './models/User';
import { Settings } from './models/Settings';
import './models/Subscription';
import './models/Invoice';
import { monthLabel } from './periods';
import { DEFAULT_SETTINGS } from './defaults';
import { round2 } from './currency';
import type { ClientLite, ClientRow, PaymentRow, PortfolioStats, ProjectRow, PublicProject, SiteSettings } from './types';

const iso = (d: any) => (d ? new Date(d).toISOString() : null);

function toClientLite(c: any): ClientLite | null {
  if (!c || !c._id) return null;
  return { id: String(c._id), name: c.name, email: c.email, company: c.company ?? '' };
}

/** Projects with their payments and computed paid / pending (in each project's own currency). */
export async function loadLedger(opts: { clientId?: string } = {}): Promise<ProjectRow[]> {
  await connectDB();
  const projects: any[] = await Project.find(opts.clientId ? { client: opts.clientId } : {})
    .populate('client', 'name email company')
    .sort({ startDate: -1 })
    .lean();
  const payments: any[] = await Payment.find({ project: { $in: projects.map((p) => p._id) } })
    .populate('invoice', 'status')
    .sort({ paidAt: -1 })
    .lean();

  const byProject = new Map<string, any[]>();
  for (const pay of payments) {
    const k = String(pay.project);
    if (!byProject.has(k)) byProject.set(k, []);
    byProject.get(k)!.push(pay);
  }

  return projects.map((p) => {
    const client = toClientLite(p.client);
    const rows: PaymentRow[] = (byProject.get(String(p._id)) ?? []).map((pay) => ({
      id: String(pay._id),
      kind: 'project' as const,
      projectId: String(p._id),
      projectName: p.name,
      period: null,
      invoice: pay.invoice ? { id: String(pay.invoice._id ?? pay.invoice), number: pay.invoiceNumber, status: pay.invoice.status ?? 'draft' } : null,
      clientId: client?.id ?? null,
      clientName: client?.name ?? null,
      amount: pay.amount,
      currency: pay.currency,
      fxRate: pay.fxRate,
      amountInProjectCurrency: pay.amountInProjectCurrency,
      projectCurrency: p.currency,
      paidAt: iso(pay.paidAt)!,
      method: pay.method,
      reference: pay.reference ?? '',
      note: pay.note ?? '',
    }));
    const paid = round2(rows.reduce((s, r) => s + r.amountInProjectCurrency, 0));
    const diff = round2((p.totalCost ?? 0) - paid);
    return {
      id: String(p._id),
      name: p.name,
      summary: p.summary ?? '',
      stack: p.stack ?? [],
      liveUrl: p.liveUrl ?? '',
      previewUrl: p.previewUrl ?? '',
      repoUrl: p.repoUrl ?? '',
      coverImage: p.coverImage ?? '',
      gallery: p.gallery ?? [],
      outcome: p.outcome ?? '',
      testimonial: { quote: p.testimonial?.quote ?? '', author: p.testimonial?.author ?? '', role: p.testimonial?.role ?? '' },
      status: p.status,
      totalCost: p.totalCost ?? 0,
      currency: p.currency,
      startDate: iso(p.startDate)!,
      deliveredAt: iso(p.deliveredAt),
      showInPortfolio: !!p.showInPortfolio,
      sortOrder: p.sortOrder ?? 0,
      translations: p.translations ?? {},
      client,
      paid,
      pending: Math.max(diff, 0),
      overpaid: Math.max(-diff, 0),
      payments: rows,
    };
  });
}

/** Every payment, for projects and subscriptions alike, newest first. */
export async function loadAllPayments(opts: { clientId?: string } = {}): Promise<PaymentRow[]> {
  await connectDB();
  const payments: any[] = await Payment.find(opts.clientId ? { client: opts.clientId } : {})
    .populate('project', 'name currency')
    .populate('subscription', 'name currency')
    .populate('client', 'name')
    .populate('invoice', 'status')
    .sort({ paidAt: -1, createdAt: -1 })
    .lean();
  return payments
    .filter((p) => p.project || p.subscription)
    .map((p) => {
      const sub = p.subscription;
      const item = p.project ?? sub;
      return {
        id: String(p._id),
        kind: sub ? ('subscription' as const) : ('project' as const),
        projectId: String(item._id),
        projectName: sub ? `${sub.name}, ${monthLabel(p.period)}` : item.name,
        period: p.period ?? null,
        invoice: p.invoice ? { id: String(p.invoice._id), number: p.invoiceNumber, status: p.invoice.status } : null,
        clientId: p.client?._id ? String(p.client._id) : null,
        clientName: p.client?.name ?? null,
        amount: p.amount,
        currency: p.currency,
        fxRate: p.fxRate,
        amountInProjectCurrency: p.amountInProjectCurrency,
        projectCurrency: item.currency,
        paidAt: iso(p.paidAt)!,
        method: p.method,
        reference: p.reference ?? '',
        note: p.note ?? '',
      };
    });
}

export async function loadClients(): Promise<ClientRow[]> {
  await connectDB();
  const users: any[] = await User.find({ role: 'client' }).sort({ name: 1 }).lean();
  return users.map((u) => ({
    id: String(u._id),
    name: u.name,
    email: u.email,
    company: u.company ?? '',
    phone: u.phone ?? '',
    preferredCurrency: u.preferredCurrency ?? 'USD',
    active: u.active !== false,
    notes: u.notes ?? '',
    createdAt: iso(u.createdAt)!,
  }));
}

export async function getSettings(): Promise<SiteSettings> {
  await connectDB();
  const s: any = await Settings.findOne({ key: 'site' }).lean();
  if (!s) return DEFAULT_SETTINGS;
  return {
    name: s.name ?? DEFAULT_SETTINGS.name,
    headline: s.headline ?? DEFAULT_SETTINGS.headline,
    heroTitle: s.heroTitle || DEFAULT_SETTINGS.heroTitle,
    yearsExperience: s.yearsExperience ?? 0,
    bio: s.bio ?? DEFAULT_SETTINGS.bio,
    photoUrl: s.photoUrl ?? '',
    location: s.location ?? '',
    timezone: s.timezone || DEFAULT_SETTINGS.timezone,
    email: s.email ?? DEFAULT_SETTINGS.email,
    availability: s.availability ?? '',
    resumeUrl: s.resumeUrl ?? '',
    socials: {
      github: s.socials?.github ?? '',
      linkedin: s.socials?.linkedin ?? '',
      x: s.socials?.x ?? '',
      website: s.socials?.website ?? '',
    },
    stacks: s.stacks?.length ? s.stacks.map((g: any) => ({ category: g.category, items: g.items ?? [] })) : DEFAULT_SETTINGS.stacks,
    translations: s.translations ?? {},
    galleryImages: s.galleryImages ?? [],
    heroPills: s.heroPills?.length ? s.heroPills : DEFAULT_SETTINGS.heroPills,
  };
}

/** Public page data. Never includes client names or money. Never throws. */
/** Wrapped in React cache so metadata, the OG image and the page share one query per request. */
export const loadPortfolio = cache(async function loadPortfolio(): Promise<{
  settings: SiteSettings;
  projects: PublicProject[];
  stats: PortfolioStats;
}> {
  try {
    const settings = await getSettings();
    const [projects, shipped, clientIds] = await Promise.all([
      Project.find({ showInPortfolio: true })
        .select('name summary stack liveUrl previewUrl repoUrl coverImage gallery outcome testimonial status startDate sortOrder translations')
        .sort({ sortOrder: 1, startDate: -1 })
        .lean() as Promise<any[]>,
      Project.countDocuments({ status: { $in: ['delivered', 'maintenance'] } }),
      Project.distinct('client', { client: { $ne: null } }),
    ]);
    return {
      settings,
      stats: { years: settings.yearsExperience, shipped, clients: clientIds.length },
      projects: projects.map((p) => ({
        id: String(p._id),
        name: p.name,
        summary: p.summary ?? '',
        stack: p.stack ?? [],
        liveUrl: p.liveUrl ?? '',
        previewUrl: p.previewUrl ?? '',
        repoUrl: p.repoUrl ?? '',
        coverImage: p.coverImage ?? '',
        gallery: p.gallery ?? [],
        outcome: p.outcome ?? '',
        testimonial: { quote: p.testimonial?.quote ?? '', author: p.testimonial?.author ?? '', role: p.testimonial?.role ?? '' },
        status: p.status,
        startDate: iso(p.startDate)!,
        translations: p.translations ?? {},
      })),
    };
  } catch (err) {
    console.error('[portfolio] falling back to defaults:', (err as Error).message);
    return { settings: DEFAULT_SETTINGS, projects: [], stats: { years: 0, shipped: 0, clients: 0 } };
  }
});
