'use client';

import { useMemo } from 'react';
import { localizeProject, localizeSettings } from '@/lib/defaults';
import type { PublicProject, SiteSettings } from '@/lib/types';
import { useI18n } from './i18n';

/** Your site text in the visitor's current language (re-computed instantly on switch). */
export function useLocalizedSettings(s: SiteSettings) {
  const { lang } = useI18n();
  return useMemo(() => localizeSettings(s, lang), [s, lang]);
}

export function useLocalizedProjects<T extends PublicProject>(ps: T[]) {
  const { lang } = useI18n();
  return useMemo(() => ps.map((p) => localizeProject(p, lang)), [ps, lang]);
}
