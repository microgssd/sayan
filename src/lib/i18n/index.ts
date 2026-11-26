import { de } from './de';
import { en, type Dict } from './en';
import { es } from './es';
import { fr } from './fr';

export const LANGS = ['en', 'fr', 'de', 'es'] as const;
export type Lang = (typeof LANGS)[number];
export type { Dict };
export const LANG_COOKIE = 'lang';

export const LANG_META: Record<Lang, { name: string; native: string; locale: string }> = {
  en: { name: 'English', native: 'English', locale: 'en-GB' },
  fr: { name: 'French', native: 'Français', locale: 'fr-FR' },
  de: { name: 'German', native: 'Deutsch', locale: 'de-DE' },
  es: { name: 'Spanish', native: 'Español', locale: 'es-ES' },
};

export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as readonly string[]).includes(v);
export const dictionaries: Record<Lang, Dict> = { en, fr, de, es };

/** Fills {placeholders}: fmt('Hi {name}', { name: 'Sayan' }) */
export const fmt = (s: string, vars: Record<string, string | number> = {}) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
