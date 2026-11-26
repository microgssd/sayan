'use client';

import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { CurrencyProvider } from './currency-context';
import type { Rates } from '@/lib/currency';

export function Providers({
  children,
  rates,
  ratesUpdatedAt,
  ratesLive,
}: {
  children: React.ReactNode;
  rates: Rates;
  ratesUpdatedAt: string;
  ratesLive: boolean;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <MotionConfig reducedMotion="user">
        <CurrencyProvider rates={rates} updatedAt={ratesUpdatedAt} live={ratesLive}>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: '!bg-surface !text-ink !border !border-line !rounded-xl !font-sans',
            }}
          />
        </CurrencyProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
