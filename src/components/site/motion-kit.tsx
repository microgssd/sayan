'use client';

import {
  animate,
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { TechIcon } from '@/lib/tech-icons';
import { useI18n } from '../i18n';

/** Pulls its child toward the pointer while hovered. */
export function Magnetic({ children, strength = 0.35, className }: { children: React.ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 220, damping: 16, mass: 0.4 });
  const y = useSpring(0, { stiffness: 220, damping: 16, mass: 0.4 });
  return (
    <motion.div
      ref={ref}
      style={{ x, y }}
      className={cn('inline-block', className)}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        const r = ref.current!.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/** Counts up to `to` when it scrolls into view (and `start` is true). */
export function CountUp({ to, start = true, suffix = '' }: { to: number; start?: boolean; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView || !start) return;
    const c = animate(0, to, { duration: 1.6, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setValue(Math.round(v)) });
    return () => c.stop();
  }, [inView, start, to]);
  return (
    <span ref={ref} className="tabular-nums">
      {value}
      {suffix}
    </span>
  );
}

const wrap = (min: number, max: number, v: number) => {
  const r = max - min;
  return ((((v - min) % r) + r) % r) + min;
};

const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};

/** Infinite logo marquee. Drifts slowly, follows scroll direction, pauses on hover. */
export function VelocityMarquee({ items, baseSpeed = 0.55 }: { items: TechIcon[]; baseSpeed?: number }) {
  const base = useMotionValue(0);
  const { scrollY } = useScroll();
  const velocity = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 300 });
  const factor = useTransform(velocity, [0, 1000], [0, 1.2], { clamp: false });
  const direction = useRef(-1);
  const hovered = useRef(false);
  const { t } = useI18n();
  const x = useTransform(base, (v) => `${wrap(-50, 0, v)}%`);

  useAnimationFrame((_, delta) => {
    if (hovered.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let move = direction.current * baseSpeed * (delta / 1000);
    if (factor.get() < 0) direction.current = 1;
    else if (factor.get() > 0) direction.current = -1;
    move += direction.current * Math.abs(move) * Math.min(Math.abs(factor.get()), 1.5);
    base.set(base.get() + move);
  });

  const row = items.map((t, i) => {
    // Brand colour on hover, unless it would vanish on the background (black or white logos).
    const brand = t.hex && luminance(t.hex) > 0.04 && luminance(t.hex) < 0.85 ? t.hex : 'rgb(var(--heading))';
    return (
      <span
        key={`${t.name}-${i}`}
        style={{ '--brand': brand } as React.CSSProperties}
        className="group flex shrink-0 items-center gap-3 px-6 text-subtle transition-colors duration-300 hover:text-[color:var(--brand)] sm:px-8"
      >
        {t.path ? (
          <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" fill="currentColor" aria-hidden>
            <path d={t.path} />
          </svg>
        ) : (
          <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-md border-2 border-current px-1 text-[10px] font-extrabold uppercase leading-none sm:h-8 sm:min-w-8">
            {t.mono}
          </span>
        )}
        <span className="whitespace-nowrap text-lg font-bold tracking-[-0.02em] text-muted transition-colors duration-300 group-hover:text-heading sm:text-xl">
          {t.name}
        </span>
      </span>
    );
  });

  return (
    <div
      className="mask-fade-x overflow-hidden py-6 sm:py-7"
      onMouseEnter={() => (hovered.current = true)}
      onMouseLeave={() => (hovered.current = false)}
    >
      <p className="sr-only">
        {t.hero.technologies}: {items.map((i) => i.name).join(', ')}
      </p>
      <motion.div className="flex w-max" style={{ x }} aria-hidden>
        {row}
        {row}
      </motion.div>
    </div>
  );
}

/** Pointer follower that grows into a label over elements with data-cursor="Label". */
export function CursorFollower() {
  const [label, setLabel] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const current = useRef<string | null>(null);
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const sx = useSpring(x, { stiffness: 520, damping: 42, mass: 0.35 });
  const sy = useSpring(y, { stiffness: 520, damping: 42, mass: 0.35 });

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      setVisible(true);
      const el = (e.target as Element | null)?.closest?.('[data-cursor]');
      const next = el?.getAttribute('data-cursor') ?? null;
      if (next !== current.current) {
        current.current = next;
        setLabel(next);
      }
    };
    const leave = () => setVisible(false);
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
    };
  }, [x, y]);

  return (
    <motion.div data-cursor-follower aria-hidden style={{ x: sx, y: sy }} className="pointer-events-none fixed left-0 top-0 z-[90]">
      <motion.div
        className="grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-center text-[11px] font-bold leading-tight text-accent-ink"
        animate={{ width: label ? 104 : 10, height: label ? 104 : 10, opacity: visible ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      >
        {label && (
          <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className="px-3">
            {label}
          </motion.span>
        )}
      </motion.div>
    </motion.div>
  );
}
