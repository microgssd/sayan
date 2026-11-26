import { Types } from 'mongoose';
import { connectDB } from './db';
import { ClientEvent } from './models/ClientEvent';
import { User } from './models/User';
import { dictionaries, type Lang } from './i18n';
import { emailLayout, sendMail } from './mailer';
import { esc, telegramReady, tg } from './telegram';
import type { EventType } from './types';

type Severity = 'info' | 'success' | 'warning' | 'danger';
const SEVERITY: Record<string, Severity> = {
  payment_received: 'success', site_restored: 'success', autopay_active: 'success', project_delivered: 'success', plan_subscribed: 'success',
  payment_failed: 'danger', site_suspended: 'danger', final_warning: 'danger', autopay_failed: 'danger',
  payment_reminder: 'warning', payment_due: 'warning', grace_started: 'warning', autopay_cancelled: 'warning', plan_cancelled: 'warning', project_paused: 'warning',
};
/** These also arrive by email; the rest stay in the portal feed. */
const EMAIL_EVENTS = new Set<string>(['payment_failed', 'payment_reminder', 'final_warning', 'site_suspended', 'site_restored', 'autopay_active', 'autopay_cancelled', 'plan_subscribed', 'grace_started', 'payment_due']);
/** These ping you on Telegram. */
const OWNER_ALERTS = new Set<string>(['payment_failed', 'final_warning', 'site_suspended', 'site_restored', 'autopay_active', 'autopay_cancelled', 'payment_received']);

import { renderEvent, type EventData } from './event-text';
export { renderEvent };

export type EventInput = {
  client: unknown;
  type: EventType;
  data?: EventData;
  subscription?: unknown;
  project?: unknown;
  by?: 'system' | 'admin';
  title?: string;
  body?: string;
  translations?: Record<string, { title?: string; body?: string }>;
  /** Email this one too (always for the important types; optional for your own notes). */
  email?: boolean;
  /** Where the email button should lead. */
  cta?: { url: string; kind: 'portal' | 'pay' };
};

/** Records an update in the client's feed and, where it matters, emails the client and pings you. Never throws. */
export async function logEvent(e: EventInput): Promise<void> {
  try {
    await connectDB();
    const doc = await ClientEvent.create({
      client: new Types.ObjectId(String(e.client)),
      type: e.type,
      severity: SEVERITY[e.type] ?? 'info',
      data: e.data ?? {},
      subscription: e.subscription ? new Types.ObjectId(String(e.subscription)) : null,
      project: e.project ? new Types.ObjectId(String(e.project)) : null,
      by: e.by ?? 'system',
      title: e.title ?? '',
      body: e.body ?? '',
      translations: e.translations ?? {},
    });
    const user: any = await User.findById(e.client).select('name email language').lean();
    if (!user) return;
    const lang: Lang = (['en', 'fr', 'de', 'es'] as const).includes(user.language) ? user.language : 'en';
    const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
    const brand = process.env.CONTACT_FROM_NAME || 'Sayan Dhar';

    if ((e.email ?? EMAIL_EVENTS.has(e.type)) && user.email) {
      const text = e.type === 'note' ? { title: e.translations?.[lang]?.title || e.title || '', body: e.translations?.[lang]?.body || e.body || '' } : renderEvent(e.type, e.data ?? {}, lang);
      const dict = dictionaries[lang];
      const pay = e.cta?.kind === 'pay';
      const mail = emailLayout({ brand, title: text.title, body: text.body, ctaLabel: pay ? dict.events.payNow : dict.events.openPortal, ctaUrl: e.cta?.url || `${site}/login` });
      if (await sendMail({ to: user.email, subject: text.title, ...mail })) await ClientEvent.updateOne({ _id: doc._id }, { emailedAt: new Date() });
    }

    if (OWNER_ALERTS.has(e.type) && telegramReady()) {
      const en = renderEvent(e.type, e.data ?? {}, 'en');
      const icon = { success: '✅', danger: '🚨', warning: '⚠️', info: 'ℹ️' }[SEVERITY[e.type] ?? 'info'];
      await tg('sendMessage', { chat_id: process.env.TELEGRAM_OWNER_CHAT_ID, text: `${icon} <b>${esc(user.name)}</b>: ${esc(en.title)}\n${esc(en.body)}`, parse_mode: 'HTML' }).catch(() => {});
    }
  } catch (err) {
    console.error('[events] could not log', e.type, (err as Error).message);
  }
}
