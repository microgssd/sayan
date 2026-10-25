import type { Currency } from './currency';

export const PROJECT_STATUSES = ['planning', 'in-progress', 'delivered', 'maintenance', 'paused'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: 'Planning',
  'in-progress': 'In progress',
  delivered: 'Delivered',
  maintenance: 'Maintenance',
  paused: 'Paused',
};

export const PAYMENT_METHODS = ['bank', 'upi', 'paypal', 'stripe', 'wise', 'interac', 'cash', 'crypto', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const METHOD_LABEL: Record<PaymentMethod, string> = {
  bank: 'Bank transfer', upi: 'UPI', paypal: 'PayPal', stripe: 'Stripe', wise: 'Wise',
  interac: 'Interac e-Transfer', cash: 'Cash', crypto: 'Crypto', other: 'Other',
};

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export type ClientLite = { id: string; name: string; email: string; company: string };

export type ClientRow = ClientLite & {
  phone: string;
  preferredCurrency: Currency;
  active: boolean;
  notes: string;
  createdAt: string;
};

export type InvoiceStatus = 'draft' | 'sent' | 'void';
export type InvoiceInfo = { id: string; number: string; status: InvoiceStatus };

export type PaymentRow = {
  id: string;
  kind: 'project' | 'subscription';
  /** Project id, or subscription id for subscription payments */
  projectId: string;
  /** Project name, or "Subscription name, Oct 2026" */
  projectName: string;
  period: string | null;
  invoice: InvoiceInfo | null;
  clientId: string | null;
  clientName: string | null;
  amount: number;
  currency: Currency;
  fxRate: number;
  amountInProjectCurrency: number;
  projectCurrency: Currency;
  paidAt: string;
  method: PaymentMethod;
  reference: string;
  note: string;
};

export type ProjectRow = {
  id: string;
  name: string;
  summary: string;
  stack: string[];
  liveUrl: string;
  previewUrl: string;
  repoUrl: string;
  coverImage: string;
  gallery: string[];
  outcome: string;
  testimonial: { quote: string; author: string; role: string };
  status: ProjectStatus;
  totalCost: number;
  currency: Currency;
  startDate: string;
  deliveredAt: string | null;
  showInPortfolio: boolean;
  sortOrder: number;
  translations: ProjectTranslations;
  client: ClientLite | null;
  paid: number;
  pending: number;
  overpaid: number;
  payments: PaymentRow[];
};

export type PublicProject = Pick<
  ProjectRow,
  | 'id'
  | 'name'
  | 'summary'
  | 'stack'
  | 'liveUrl'
  | 'previewUrl'
  | 'repoUrl'
  | 'coverImage'
  | 'gallery'
  | 'outcome'
  | 'testimonial'
  | 'status'
  | 'startDate'
> & { translations: ProjectTranslations };

export const PROJECT_TR_FIELDS = ['summary', 'outcome', 'quote', 'role'] as const;
export type ProjectTrField = (typeof PROJECT_TR_FIELDS)[number];
export type ProjectTranslations = Partial<Record<'fr' | 'de' | 'es', Partial<Record<ProjectTrField, string>>>>;

export type PortfolioStats = { years: number; shipped: number; clients: number };

export type StackGroup = { category: string; items: string[] };

export type SiteSettings = {
  name: string;
  headline: string;
  heroTitle: string;
  yearsExperience: number;
  bio: string;
  photoUrl: string;
  location: string;
  timezone: string;
  email: string;
  availability: string;
  resumeUrl: string;
  socials: { github: string; linkedin: string; x: string; website: string };
  stacks: StackGroup[];
  galleryImages: string[];
  heroPills: string[];
  translations: Partial<Record<'fr' | 'de' | 'es', Record<string, string>>>; // TranslatableField keys, plus `cat:<English category>`
};

export const TRANSLATABLE_FIELDS = ['heroTitle', 'headline', 'bio', 'availability', 'location'] as const;
export type TranslatableField = (typeof TRANSLATABLE_FIELDS)[number];

export type PeriodStatus = 'paid' | 'partial' | 'due' | 'overdue';
export type PeriodRow = {
  period: string; // YYYY-MM
  label: string; // Oct 2026
  dueDate: string; // ISO
  price: number; // the monthly price for this month
  paid: number;
  remaining: number;
  status: PeriodStatus;
  paymentIds: string[];
};

export type SubscriptionRow = {
  id: string;
  name: string;
  description: string;
  amount: number;
  currency: Currency;
  dueDay: number;
  startMonth: string;
  endMonth: string | null;
  status: 'active' | 'ended';
  translations: Partial<Record<'fr' | 'de' | 'es', { description?: string }>>;
  client: ClientLite | null;
  periods: PeriodRow[]; // newest first, every billed month so far
  current: PeriodRow | null; // this month, if billed
  billed: number;
  paid: number;
  pending: number;
  unpaidCount: number;
};
