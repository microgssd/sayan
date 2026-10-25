'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useEffect, useState, type MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from './i18n';

type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> };
};

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';

  function toggle(e: MouseEvent<HTMLButtonElement>) {
    const next = isDark ? 'light' : 'dark';
    const root = document.documentElement;
    const apply = () => {
      root.classList.toggle('dark', next === 'dark');
      root.style.colorScheme = next;
      setTheme(next);
    };
    const doc = document as ViewTransitionDoc;
    if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      apply();
      return;
    }
    // Circular reveal that grows out of the toggle button.
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    doc.startViewTransition(apply).ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' },
      );
    });
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? t.theme.toLight : t.theme.toDark}
      className={cn(
        'relative grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-line bg-surface text-ink transition-colors hover:border-accent/60',
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {!mounted ? (
          <span key="blank" className="h-5 w-5" />
        ) : isDark ? (
          <motion.svg
            key="moon"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            initial={{ rotate: -120, scale: 0, opacity: 0, y: 8 }}
            animate={{ rotate: 0, scale: 1, opacity: 1, y: 0 }}
            exit={{ rotate: 120, scale: 0, opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          >
            <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" fill="rgb(var(--brass))" />
            {[
              [17, 4, 0.15],
              [20.5, 8, 0.35],
            ].map(([cx, cy, d]) => (
              <motion.circle
                key={cx}
                cx={cx}
                cy={cy}
                r={0.9}
                fill="rgb(var(--ink))"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.4, 1] }}
                transition={{ delay: 0.25 + d, duration: 0.5 }}
              />
            ))}
          </motion.svg>
        ) : (
          <motion.svg
            key="sun"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            initial={{ rotate: 120, scale: 0, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: -120, scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          >
            <circle cx="12" cy="12" r="4.2" fill="rgb(var(--brass))" />
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.line
                key={i}
                x1="12"
                y1="2.5"
                x2="12"
                y2="4.6"
                stroke="rgb(var(--brass))"
                strokeWidth="1.8"
                strokeLinecap="round"
                transform={`rotate(${i * 45} 12 12)`}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.04, duration: 0.3 }}
              />
            ))}
          </motion.svg>
        )}
      </AnimatePresence>
    </button>
  );
}
