'use client';

import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { useRef } from 'react';
import type { SiteSettings } from '@/lib/types';
import { useLocalizedSettings } from '../use-localized';

/** Statement that lights up word by word as it scrolls through the viewport. */
export function About({ settings }: { settings: SiteSettings }) {
  const { bio: text, name } = useLocalizedSettings(settings);
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.4'] });
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 py-32 sm:px-8 sm:py-44">
      <p ref={ref} className="text-[clamp(1.7rem,3.8vw,3.4rem)] font-bold leading-[1.15] tracking-[-0.03em] text-heading">
        {words.map((w, i) => (
          <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
            {i < words.length - 1 ? `${w} ` : w}
          </Word>
        ))}
      </p>
      <p className="mt-10 text-sm font-semibold text-muted">{name}</p>
    </section>
  );
}

function Word({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.13, 1]);
  return (
    <motion.span style={{ opacity }}>
      {children}
    </motion.span>
  );
}
