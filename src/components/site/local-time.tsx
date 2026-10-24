'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Clock, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Geo } from '@/lib/geo';
import { useI18n } from '../i18n';

const cityFromTz = (tz: string) => tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
const countryName = (code: string, locale = 'en') => {
  try {
    return code ? new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code : '';
  } catch {
    return code;
  }
};
/** Ticking clock where each digit rolls when it changes. */
function RollingTime({ date, tz, locale }: { date: Date; tz: string; locale: string }) {
  const t = new Intl.DateTimeFormat(locale, { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date);
  return (
    <span className="inline-flex tabular-nums" aria-label={t}>
      {t.split('').map((ch, i) => (
        <span key={i} className="relative inline-block overflow-hidden" aria-hidden>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={ch}
              className="inline-block"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: '0%', opacity: 1 }}
              exit={{ y: '-100%', opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {ch === ' ' ? '\u00A0' : ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

export function LocalTime({ myTz, myPlace }: { myTz: string; myPlace: string }) {
  const { t, lang, locale, fmt } = useI18n();
  const timeLocale = lang === 'en' ? 'en-US' : locale;
  const [now, setNow] = useState<Date | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [browserTz, setBrowserTz] = useState('UTC');

  useEffect(() => {
    setBrowserTz(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    fetch('/api/geo')
      .then((r) => r.json())
      .then(setGeo)
      .catch(() => setGeo({ city: '', region: '', country: '', timezone: '' }));
    return () => clearInterval(t);
  }, []);

  const tz = geo?.timezone || browserTz;
  const place = geo?.city ? [geo.city, countryName(geo.country, locale)].filter(Boolean).join(', ') : countryName(geo?.country ?? '', locale) || cityFromTz(tz);
  const myHour = now ? Number(new Intl.DateTimeFormat('en-US', { timeZone: myTz, hour: 'numeric', hourCycle: 'h23' }).format(now)) : 12;
  const online = myHour >= 9 && myHour < 22;

  return (
    <div className="relative overflow-hidden rounded-[26px] border border-line bg-surface p-6">
      <div aria-hidden className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-accent/20 blur-3xl" />
      <p className="relative flex items-center gap-2 text-sm font-semibold text-muted">
        <MapPin className="h-4 w-4 text-accent-fg" /> {geo?.city || geo?.country ? t.time.visiting : t.time.yourTz}
      </p>
      <p className="relative mt-2 min-h-[2rem] text-2xl font-extrabold tracking-[-0.03em] text-heading">
        {geo ? place : <span className="inline-block h-6 w-40 animate-pulse rounded-md bg-surface-2 align-middle" />}
      </p>
      <p className="relative mt-1 text-[clamp(2rem,4vw,2.8rem)] font-extrabold leading-none tracking-[-0.04em] text-accent-fg">
        {now ? <RollingTime date={now} tz={tz} locale={timeLocale} /> : '\u00A0'}
      </p>

      <div className="relative mt-6 border-t border-line pt-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-muted">
          <Clock className="h-4 w-4" /> {myPlace ? fmt(t.time.myTimeIn, { place: myPlace.split(',')[0]! }) : t.time.myTime}
        </p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-xl font-bold tabular-nums text-heading">
            {now ? new Intl.DateTimeFormat(timeLocale, { timeZone: myTz, hour: 'numeric', minute: '2-digit' }).format(now) : '\u00A0'}
          </p>
          <p className="flex items-center gap-2 text-xs font-semibold text-muted">
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-accent' : 'bg-subtle'}`} />
            {online ? t.time.online : t.time.away}
          </p>
        </div>
      </div>
    </div>
  );
}
