'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowUpRight, MessageCircle } from 'lucide-react';
import { openChat } from './chat-widget';
import { useRef } from 'react';
import type { SiteSettings } from '@/lib/types';
import { ContactForm } from './contact-form';
import { FitText } from './fit-text';
import { LocalTime } from './local-time';
import { useI18n } from '../i18n';
import { useLocalizedSettings } from '../use-localized';

export function Contact({ settings: raw }: { settings: SiteSettings }) {
  const settings = useLocalizedSettings(raw);
  const ref = useRef<HTMLElement>(null);
  const { t } = useI18n();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] });
  const x = useTransform(scrollYProgress, [0, 0.6], ['10%', '0%']);
  const wordY = useTransform(scrollYProgress, [0.5, 1], ['30%', '6%']);

  const socials = [
    { label: 'GitHub', href: settings.socials.github },
    { label: 'LinkedIn', href: settings.socials.linkedin },
    { label: 'X', href: settings.socials.x },
    { label: t.social.website, href: settings.socials.website },
    { label: t.social.resume, href: settings.resumeUrl },
  ].filter((s) => s.href);

  return (
    <footer ref={ref} id="contact" className="relative overflow-hidden border-t border-line">
      <div aria-hidden className="pointer-events-none absolute bottom-0 left-1/2 h-[60vh] w-[80vw] -translate-x-1/2 translate-y-1/3 rounded-full bg-accent/[0.14] blur-[140px]" />
      <div className="relative mx-auto max-w-7xl px-5 pt-24 sm:px-8 sm:pt-28">
        <motion.h2 style={{ x }} className="text-balance text-[clamp(2.6rem,9vw,9rem)] font-extrabold leading-[0.92] tracking-[-0.06em]">
          {t.contact.title}
        </motion.h2>
        <p className="mt-5 max-w-xl text-lg text-muted">{t.contact.subtitle}</p>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.45fr_0.55fr] lg:gap-8">
          <ContactForm />
          <aside className="grid content-start gap-6">
            <LocalTime myTz={settings.timezone} myPlace={settings.location} />
            <button
              onClick={openChat}
              className="group flex items-center gap-4 rounded-[26px] border border-line bg-surface p-6 text-left transition-colors hover:border-accent"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition-transform duration-300 group-hover:scale-110">
                <MessageCircle className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-muted">{t.contact.preferChat}</span>
                <span className="block text-lg font-bold text-heading">{t.contact.startChat}</span>
              </span>
            </button>
            <div className="rounded-[26px] border border-line bg-surface p-6">
              <p className="text-sm font-semibold text-muted">{t.contact.preferEmail}</p>
              <a href={`mailto:${settings.email}`} className="group mt-2 inline-flex max-w-full items-center gap-2 break-all text-lg font-bold text-heading sm:text-xl">
                {settings.email}
                <ArrowUpRight className="h-5 w-5 shrink-0 text-accent-fg transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
              {socials.length > 0 && (
                <ul className="mt-5 flex flex-wrap gap-2">
                  {socials.map((s) => (
                    <li key={s.label}>
                      <a href={s.href} target="_blank" rel="noreferrer" className="inline-block rounded-full border border-line px-3.5 py-1.5 text-sm font-semibold text-heading transition-colors hover:border-accent hover:text-accent-fg">
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>

        <div className="mt-20 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8 text-sm text-muted">
          <span>
            © {new Date().getFullYear()} {settings.name}
          </span>
          <Link href="/login" className="font-semibold transition-colors hover:text-heading">
            {t.nav.clientLogin}
          </Link>
        </div>
      </div>

      <motion.div style={{ y: wordY }} className="pointer-events-none select-none px-3 pt-6">
        <FitText text={settings.name} className="font-extrabold leading-[0.8] tracking-[-0.06em] text-heading/[0.08]" />
      </motion.div>
    </footer>
  );
}
