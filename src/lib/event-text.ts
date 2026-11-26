import { formatMoney, type Currency } from './currency';
import { dictionaries, fmt, LANG_META, type Lang } from './i18n';
import { monthLabel } from './periods';

export type EventData = Record<string, string | number | null>;

/** Fills a translated template from an event's data, in the viewer's language. */
export function renderEvent(type: string, data: EventData, lang: Lang) {
  const dict = dictionaries[lang];
  const locale = LANG_META[lang].locale;
  const pair = (dict.events.types as unknown as Record<string, readonly string[]>)[type] ?? ['', ''];
  const vars: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(data)) vars[k] = v == null ? '' : v;
  if (typeof data.amount === 'number' && data.currency) vars.amount = formatMoney(data.amount, data.currency as Currency, { locale });
  if (data.period) vars.period = monthLabel(String(data.period), 'long', locale);
  else if (data.name) vars.period = String(data.name); // a project payment: 'for Lotus storefront'
  if (data.date) vars.date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(String(data.date)));
  if (data.status && (dict.status as Record<string, string>)[String(data.status)]) vars.status = (dict.status as Record<string, string>)[String(data.status)]!.toLowerCase();
  return { title: fmt(pair[0] ?? '', vars), body: fmt(pair[1] ?? '', vars) };
}
