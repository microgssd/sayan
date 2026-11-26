'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { convert, formatMoney, isCurrency, type Currency, type Rates } from '@/lib/currency';
import { useI18n } from './i18n';

type Ctx = {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rates: Rates;
  ratesUpdatedAt: string;
  ratesLive: boolean;
};

const CurrencyCtx = createContext<Ctx | null>(null);
const KEY = 'display-currency';

export function CurrencyProvider({
  rates,
  updatedAt,
  live,
  children,
}: {
  rates: Rates;
  updatedAt: string;
  live: boolean;
  children: React.ReactNode;
}) {
  const [currency, setState] = useState<Currency>('USD');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (isCurrency(saved)) setState(saved);
    } catch {}
  }, []);

  const setCurrency = useCallback((c: Currency) => {
    setState(c);
    try {
      localStorage.setItem(KEY, c);
    } catch {}
  }, []);

  const value = useMemo(
    () => ({ currency, setCurrency, rates, ratesUpdatedAt: updatedAt, ratesLive: live }),
    [currency, setCurrency, rates, updatedAt, live],
  );
  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyCtx);
  if (!ctx) throw new Error('useCurrency must be used inside CurrencyProvider');
  return ctx;
}

/** Applies a client's preferred currency the first time they visit (unless they've picked one). */
export function PreferredCurrency({ value }: { value: Currency }) {
  const { setCurrency } = useCurrency();
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setCurrency(value);
    } catch {}
  }, [value, setCurrency]);
  return null;
}

/** Renders an amount converted into the viewer's chosen display currency. */
export function Money({
  amount,
  from = 'USD',
  compact,
  className,
}: {
  amount: number;
  from?: Currency;
  compact?: boolean;
  className?: string;
}) {
  const { currency, rates } = useCurrency();
  const { lang, locale } = useI18n();
  const value = convert(amount, from, currency, rates);
  // English keeps each currency's home format; other languages use their own (e.g. 1 234,00 $ in French).
  const loc = lang === 'en' ? undefined : locale;
  return (
    <span
      className={['tabular-nums', className].filter(Boolean).join(' ')}
      title={from !== currency ? formatMoney(amount, from, { locale: loc }) : undefined}
    >
      {formatMoney(value, currency, { compact, locale: loc })}
    </span>
  );
}
