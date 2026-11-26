import './globals.css';
import localFont from 'next/font/local';
import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import { getRates } from '@/lib/rates';
import { getLang } from '@/lib/i18n/server';
import { I18nProvider } from '@/components/i18n';

// Self-hosted via next/font: preloaded, zero layout shift, no request to Google.
const jakarta = localFont({
  src: '../../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2',
  variable: '--font-jakarta',
  weight: '200 800',
  display: 'swap',
});

// Bricolage Grotesque, used only for your name in the opening animation.
const bricolage = localFont({
  src: '../../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-standard-normal.woff2',
  variable: '--font-name',
  weight: '200 800',
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Sayan Dhar, full-stack developer', template: '%s | Sayan Dhar' },
  applicationName: 'Sayan Dhar',
  description: 'Full-stack developer building SaaS, marketplaces, Web3 and ML products. Client portal for project billing.',
  openGraph: { type: 'website' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0B14' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { rates, updatedAt, live } = await getRates();
  const lang = getLang();
  return (
    <html lang={lang} suppressHydrationWarning className={`${jakarta.variable} ${bricolage.variable}`}>
      <body>
        <I18nProvider lang={lang}>
          <Providers rates={rates} ratesUpdatedAt={updatedAt} ratesLive={live}>
            {children}
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
