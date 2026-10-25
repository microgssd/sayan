'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { LANG_COOKIE, LANG_META, LANGS, type Lang } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { pickTransition, TRANSITIONS } from '@/lib/lang-transitions';
import { Flag } from './flags';
import { useI18n } from './i18n';

/**
 * Language picker. Each switch plays one of six animations, picked at random
 * (never the same twice in a row), and swaps the page's language with no reload.
 */
export function LanguageSwitcher({ className, align = 'right' }: { className?: string; align?: 'left' | 'right' }) {
  const { lang, t, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  // Close the menu on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /**
   * Switches the whole page to `to` in this exact frame (flushSync), remembers the choice for a year,
   * and resolves straight away, so the animation and the text change are always perfectly in step.
   */
  const swap = (to: Lang) => {
    document.cookie = `${LANG_COOKIE}=${to}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = to;
    flushSync(() => setLang(to));
    return Promise.resolve();
  };

  const choose = async (to: Lang) => {
    setOpen(false);
    if (to === lang || busy) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return void swap(to);
    const r = button.current!.getBoundingClientRect();
    setBusy(true);
    try {
      const fx = pickTransition();
      document.documentElement.dataset.langFx = fx; // which style is playing (handy for debugging)
      await TRANSITIONS[fx]({ to, native: LANG_META[to].native, x: r.left + r.width / 2, y: r.top + r.height / 2, swap: () => swap(to) });
    } catch (err) {
      console.error('[language] animation failed, switching without it:', err);
      if (document.documentElement.lang !== to || lang !== to) await swap(to); // still switch the language
    } finally {
      delete document.documentElement.dataset.langFx;
      setBusy(false);
    }
  };

  return (
    <div ref={box} className={cn('relative', className)}>
      <button
        ref={button}
        data-lang-button
        onClick={() => setOpen((o) => !o)}
        aria-label={`${t.lang.change}: ${LANG_META[lang].native}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-line bg-surface transition-colors hover:border-accent/60"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={lang}
            className="block h-6 w-6 overflow-hidden rounded-full ring-1 ring-black/10"
            initial={{ rotate: -120, scale: 0, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 120, scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          >
            <Flag lang={lang} className="h-full w-full" />
          </motion.span>
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="menu"
            aria-label={t.lang.label}
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'absolute top-12 z-[60] w-48 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-2xl',
              align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
            )}
          >
            {LANGS.map((l) => (
              <li key={l} role="none">
                <button
                  role="menuitemradio"
                  aria-checked={l === lang}
                  onClick={() => choose(l)}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors', l === lang ? 'bg-surface-2 text-heading' : 'text-muted hover:bg-surface-2 hover:text-heading')}
                >
                  <span className="block h-5 w-5 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
                    <Flag lang={l} className="h-full w-full" />
                  </span>
                  <span className="flex-1">{LANG_META[l].native}</span>
                  {l === lang && <Check className="h-4 w-4 text-accent-fg" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

    </div>
  );
}
