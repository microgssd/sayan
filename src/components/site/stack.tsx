'use client';

import { motion } from 'framer-motion';
import type { SiteSettings } from '@/lib/types';
import { useLocalizedSettings } from '../use-localized';
import { useI18n } from '../i18n';

export function Stack({ settings }: { settings: SiteSettings }) {
  const { t } = useI18n();
  const groups = useLocalizedSettings(settings).stacks;
  return (
    <section id="stack" className="mx-auto grid max-w-7xl gap-12 px-5 py-28 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="self-start lg:sticky lg:top-32">
        <h2 className="text-[clamp(2.4rem,5.5vw,5rem)] font-extrabold leading-[0.95] tracking-[-0.05em]">{t.stack.title}</h2>
        <p className="mt-6 max-w-sm leading-relaxed text-muted">
          {t.stack.subtitle}
        </p>
      </div>
      <div className="border-t border-line">
        {groups.map((g, gi) => (
          <motion.div
            key={gi} // stable across languages, so rows don't re-animate when the category name is translated
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: gi * 0.05 }}
            className="group grid gap-4 border-b border-line py-8 sm:grid-cols-[220px_1fr]"
          >
            <h3 className="flex items-baseline gap-3 text-xl font-extrabold tracking-[-0.02em]">
              {g.category}
              <span className="text-sm font-semibold text-subtle tabular-nums">{g.items.length}</span>
            </h3>
            <ul className="flex flex-wrap gap-2">
              {g.items.map((item) => (
                <li
                  key={item}
                  className="cursor-default rounded-full border border-line px-4 py-2 text-sm font-semibold text-heading transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent hover:text-accent-ink"
                >
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
