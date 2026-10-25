'use client';

import { motion } from 'framer-motion';
import { CURRENCIES, CURRENCY_META } from '@/lib/currency';
import { useCurrency } from './currency-context';
import { cn } from '@/lib/utils';
import { useI18n } from './i18n';

export function CurrencySwitcher({ className }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();
  const { t } = useI18n();
  return (
    <div
      role="radiogroup"
      aria-label={t.currency.label}
      className={cn('inline-flex rounded-full border border-line bg-surface p-1 text-xs font-semibold', className)}
    >
      {CURRENCIES.map((c) => {
        const active = c === currency;
        return (
          <button
            key={c}
            role="radio"
            aria-checked={active}
            title={CURRENCY_META[c].label}
            onClick={() => setCurrency(c)}
            className={cn(
              'relative rounded-full px-2.5 py-1.5 transition-colors sm:px-3',
              active ? 'text-accent-ink' : 'text-muted hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId="currency-pill"
                className="absolute inset-0 rounded-full bg-accent"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{c}</span>
          </button>
        );
      })}
    </div>
  );
}
