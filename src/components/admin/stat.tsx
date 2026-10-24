'use client';

import { motion } from 'framer-motion';
import { Money } from '../currency-context';
import { cn } from '@/lib/utils';

export function Stat({
  label,
  usd,
  count,
  tone = 'ink',
  sub,
  delay = 0,
}: {
  label: string;
  usd?: number;
  count?: number;
  tone?: 'ink' | 'accent' | 'brass';
  sub?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5"
    >
      <span
        className={cn(
          'absolute left-0 top-5 h-8 w-1 rounded-r-full',
          tone === 'accent' && 'bg-accent',
          tone === 'brass' && 'bg-brass',
          tone === 'ink' && 'bg-line',
        )}
      />
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
        {usd !== undefined ? <Money amount={usd} /> : <span className="tabular-nums">{count}</span>}
      </p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </motion.div>
  );
}
