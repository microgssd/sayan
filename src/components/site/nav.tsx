'use client';

import Link from 'next/link';
import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { useLenis } from 'lenis/react';
import { useState } from 'react';
import { ThemeToggle } from '../theme-toggle';
import { BrandMark } from '../brand-mark';
import { LogIn } from 'lucide-react';
import { useIntroDone } from './intro';
import { useI18n } from '../i18n';
import { LanguageSwitcher } from '../language-switcher';


export function SiteNav({ name }: { name: string }) {
  const done = useIntroDone();
  const { t, fmt } = useI18n();
  const links = [
    { href: '#work', label: t.nav.work },
    { href: '#stack', label: t.nav.stack },
    { href: '#contact', label: t.nav.contact },
  ];
  const lenis = useLenis();
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  // Hide while scrolling down, reveal on any scroll up.
  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setHidden(y > 240 && y > prev);
  });

  return (
    <motion.header
      initial={{ y: -120 }}
      animate={{ y: !done || hidden ? -120 : 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: done && !hidden ? 0.5 : 0 }}
      className="fixed inset-x-0 top-4 z-50 px-4"
    >
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-2 rounded-full border border-line bg-surface/70 p-1.5 shadow-[0_12px_40px_-20px_rgb(0_0_0/0.5)] backdrop-blur-xl">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-full pr-2 sm:pr-3" aria-label={fmt(t.nav.home, { name })}>
          <BrandMark className="h-10 w-10 transition-transform duration-500 hover:rotate-[-8deg]" />
          <span className="truncate text-[15px] font-bold tracking-tight text-heading">{name}</span>
        </Link>
        <ul className="hidden items-center md:flex" onMouseLeave={() => setHovered(null)}>
          {links.map((l) => (
            <li key={l.href} className="relative">
              {hovered === l.href && (
                <motion.span layoutId="nav-hover" className="absolute inset-0 rounded-full bg-surface-2" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
              )}
              <a
                href={l.href}
                onMouseEnter={() => setHovered(l.href)}
                onClick={(e) => {
                  if (!lenis) return;
                  e.preventDefault();
                  lenis.scrollTo(l.href, { offset: -24, duration: 1.4 });
                }}
                className="relative block rounded-full px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-heading"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex shrink-0 items-center gap-1.5">
          <LanguageSwitcher />
          <ThemeToggle />
          <Link
            href="/login"
            aria-label={t.nav.clientLogin}
            className="flex h-10 items-center gap-2 whitespace-nowrap rounded-full bg-heading px-3 text-sm font-bold text-bg transition-transform hover:scale-[1.03] active:scale-[0.98] min-[420px]:px-4"
          >
            {/* Icon only on the narrowest phones; the label returns from 420px up */}
            <LogIn className="h-4 w-4 min-[420px]:hidden" aria-hidden />
            <span className="hidden min-[420px]:inline">{t.nav.clientLogin}</span>
          </Link>
        </div>
      </nav>
    </motion.header>
  );
}
