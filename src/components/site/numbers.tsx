'use client';

import { motion, useInView } from 'framer-motion';
import { animate } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { resolveNumbers } from '@/lib/numbers';
import type { PortfolioStats, SiteSettings } from '@/lib/types';
import { useI18n } from '../i18n';
import { useLocalizedSettings } from '../use-localized';

const ease = [0.22, 1, 0.36, 1] as const;

/** Counts from 0 to the target the first time it scrolls into view, formatted for the visitor's language. */
function Counter({ to, suffix, delay }: { to: number; suffix: string; delay: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' }); // anywhere on screen except the very bottom edge
  const [v, setV] = useState(0);
  const { locale } = useI18n();
  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return void setV(to);
    const c = animate(0, to, { duration: Math.min(2.6, 1.2 + to / 400), delay, ease, onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [inView, to, delay]);
  return (
    <span ref={ref} className="tabular-nums" aria-label={`${to.toLocaleString(locale)}${suffix}`}>
      <span aria-hidden>
        {v.toLocaleString(locale)}
        <span className="text-accent-fg">{suffix}</span>
      </span>
    </span>
  );
}

/** "By the numbers": years, projects and clients counting up when scrolled into view. All editable in the admin. */
export function Numbers({ settings: raw, stats }: { settings: SiteSettings; stats: PortfolioStats }) {
  const settings = useLocalizedSettings(raw);
  const { t } = useI18n();
  const n = resolveNumbers(settings.numbers, stats);
  const items = [
    { key: 'years', ...n.years, label: n.years.label || t.numbers.years },
    { key: 'projects', ...n.projects, label: n.projects.label || t.numbers.projects },
    { key: 'clients', ...n.clients, label: n.clients.label || t.numbers.clients },
  ].filter((i) => i.value > 0);
  if (!items.length) return null;

  return (
    <section aria-label={t.numbers.title} className="relative overflow-hidden border-b border-line">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[60%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-[110px]" />
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15% 0px' }}
          transition={{ duration: 0.7, ease }}
          className="mb-10 text-sm font-semibold text-muted sm:mb-14"
        >
          {t.numbers.title}
        </motion.p>
        <dl className={`grid gap-y-12 sm:gap-x-8 ${items.length === 3 ? 'sm:grid-cols-3' : items.length === 2 ? 'sm:grid-cols-2' : ''}`}>
          {items.map((item, i) => (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-15% 0px' }}
              transition={{ duration: 0.8, ease, delay: i * 0.12 }}
              className="relative sm:border-l sm:border-line sm:pl-8 sm:first:border-l-0 sm:first:pl-0"
            >
              <dd
                className="text-[clamp(3.6rem,9vw,7rem)] font-extrabold leading-[0.95] tracking-[-0.05em] text-heading"
                style={{ fontFamily: 'var(--font-name), var(--font-jakarta), sans-serif' }}
              >
                <Counter to={item.value} suffix={item.suffix} delay={0.15 + i * 0.12} />
              </dd>
              <dt className="mt-3 max-w-[18ch] text-lg font-semibold leading-snug text-muted">{item.label}</dt>
              <motion.span
                aria-hidden
                className="mt-6 block h-[2px] origin-left rounded-full bg-gradient-to-r from-accent to-transparent"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.4, ease, delay: 0.3 + i * 0.12 }}
              />
            </motion.div>
          ))}
        </dl>
      </div>
    </section>
  );
}
