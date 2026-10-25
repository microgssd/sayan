'use client';

import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n';

/** Keeps the browser tab title in the current language after a switch. */
export function TitleSync({ name }: { name: string }) {
  const { t, fmt } = useI18n();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) return void (first.current = false); // the server already rendered the right title
    document.title = fmt(t.meta.title, { name });
  }, [t, fmt, name]);
  return null;
}
