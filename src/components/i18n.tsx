'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { dictionaries, fmt, LANG_META, type Dict, type Lang } from '@/lib/i18n';

type Ctx = { lang: Lang; t: Dict; locale: string; fmt: typeof fmt; setLang: (l: Lang) => void };
const I18nCtx = createContext<Ctx>({ lang: 'en', t: dictionaries.en, locale: LANG_META.en.locale, fmt, setLang: () => {} });

/**
 * Holds the current language in the browser. Every translation (interface and your own content)
 * is already on the page, so switching re-renders instantly with no trip to the server.
 */
export function I18nProvider({ lang: initial, children }: { lang: Lang; children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(initial);
  const value = useMemo(() => ({ lang, t: dictionaries[lang], locale: LANG_META[lang].locale, fmt, setLang }), [lang]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);

/** Inserts React nodes into a translated sentence: <Rich text="Paid {paid} so far" values={{ paid: <Money …/> }} /> */
export function Rich({ text, values }: { text: string; values: Record<string, React.ReactNode> }) {
  const parts = text.split(/(\{\w+\})/g);
  return (
    <>
      {parts.map((p, i) => {
        const key = p.match(/^\{(\w+)\}$/)?.[1];
        return key && key in values ? <span key={i}>{values[key]}</span> : p;
      })}
    </>
  );
}
