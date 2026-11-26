'use client';

import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { flagEmoji, greetingFor } from '@/lib/greetings';
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

/** ISO country code for the visitor: from the host's location headers, else the region in their browser language (e.g. en-IN). */
function visitorCountry(geoCountry: string) {
  if (/^[A-Za-z]{2}$/.test(geoCountry)) return geoCountry.toLowerCase();
  for (const l of navigator.languages ?? [navigator.language]) {
    const region = l.split('-')[1];
    if (region && /^[A-Za-z]{2}$/.test(region)) return region.toLowerCase();
  }
  return '';
}

/** Can this device draw flag emojis? (Windows can't; it shows two letters instead.) */
let flagSupport: boolean | null = null;
function supportsFlagEmoji() {
  if (flagSupport !== null) return flagSupport;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 24;
    const x = c.getContext('2d', { willReadFrequently: true })!;
    x.font = '20px sans-serif';
    x.textBaseline = 'top';
    x.fillText('\u{1F1EB}\u{1F1F7}', 0, 0); // 🇫🇷: blue and red pixels only if drawn as a real flag
    const d = x.getImageData(0, 0, 24, 24).data;
    flagSupport = false;
    for (let i = 0; i < d.length; i += 4) {
      const [r, g, b, a] = [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!];
      if (a > 50 && Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b)) > 60) return (flagSupport = true);
    }
  } catch {
    flagSupport = false;
  }
  return flagSupport;
}

/** Emoji flag, or a country-code badge where the device can't draw flags. No image files either way. */
function CountryMark({ code }: { code: string }) {
  const [emoji, setEmoji] = useState<boolean | null>(null);
  useEffect(() => setEmoji(supportsFlagEmoji()), []);
  if (!code || emoji === null) return <span className="inline-block h-5 w-7" aria-hidden />;
  return (
    <motion.span
      aria-hidden
      initial={{ opacity: 0, scale: 0.4, rotate: -25 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 14 }}
      className="inline-grid shrink-0 place-items-center"
    >
      {emoji ? (
        <span className="text-[1.35rem] leading-none">{flagEmoji(code)}</span>
      ) : (
        <span className="rounded-md border border-accent/50 bg-accent/10 px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-accent-fg">{code.toUpperCase()}</span>
      )}
    </motion.span>
  );
}

/** A greeting typed in letter by letter, ending with a waving hand. */
function TypedGreeting({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return void setN(text.length);
    setN(0);
    const t = setInterval(() => setN((v) => (v >= text.length ? (clearInterval(t), v) : v + 1)), 45);
    return () => clearInterval(t);
  }, [text]);
  const done = n >= text.length;
  // The last word, the caret and the waving hand stay together, so the hand never wraps onto a line alone.
  const cut = text.lastIndexOf(' ') + 1;
  return (
    <span aria-label={`${text} 👋`}>
      <span aria-hidden>{text.slice(0, Math.min(n, cut))}</span>
      <span aria-hidden className="whitespace-nowrap">
      {text.slice(cut, Math.max(n, cut))}
      {!done && <span aria-hidden className="ml-0.5 inline-block h-[0.9em] w-[2px] translate-y-[0.1em] animate-pulse bg-accent-fg" />}
      {done && (
        <motion.span
          aria-hidden
          className="ml-1.5 inline-block origin-[70%_80%]"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1, rotate: [0, 18, -8, 18, -4, 12, 0] }}
          transition={{ duration: 1.4, ease: 'easeInOut' }}
        >
          👋
        </motion.span>
      )}
      </span>
    </span>
  );
}

/** Sun (by day) or moon (by night) glides along an arc to the visitor's time of day. */
function DayArc({ hour }: { hour: number }) {
  // Sun from 5 AM to 7 PM, moon from 7 PM to 5 AM, matching the morning/afternoon/evening/night greetings.
  const day = hour >= 5 && hour < 19;
  const f = day ? (hour - 5) / 14 : ((hour - 19 + 24) % 24) / 10; // 0 at rise, 1 at set
  const progress = useMotionValue(0);
  useEffect(() => {
    const c = animate(progress, f, { duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.3 });
    return () => c.stop();
  }, [f, progress]);
  const point = (k: number) => {
    const a = Math.PI * (1 - k);
    return { x: 60 + 48 * Math.cos(a), y: 56 - 48 * Math.sin(a) };
  };
  const cx = useTransform(progress, (k) => point(k).x);
  const cy = useTransform(progress, (k) => point(k).y);
  const lit = useTransform(progress, (k) => k);
  const body = day ? 'rgb(var(--brass))' : '#C084FC';
  return (
    <svg viewBox="0 0 120 64" className="h-16 w-[7.5rem] shrink-0 overflow-visible" aria-hidden>
      <path d="M12 56 A48 48 0 0 1 108 56" fill="none" stroke="rgb(var(--line))" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round" />
      <motion.path d="M12 56 A48 48 0 0 1 108 56" fill="none" stroke={body} strokeWidth="2.5" strokeLinecap="round" style={{ pathLength: lit }} opacity={0.85} />
      <line x1="4" y1="56" x2="116" y2="56" stroke="rgb(var(--line))" strokeWidth="1.5" />
      <motion.circle cx={cx} cy={cy} r="12" fill={body} opacity={0.18} animate={{ r: [10, 14, 10] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />
      {day ? (
        <motion.circle cx={cx} cy={cy} r="6.5" fill={body} />
      ) : (
        <motion.g style={{ x: cx, y: cy }}>
          <circle r="6.5" fill={body} />
          <circle r="6" cx="3" cy="-2.5" fill="rgb(var(--surface))" />
        </motion.g>
      )}
    </svg>
  );
}

export function LocalTime(_: { myTz?: string; myPlace?: string }) {
  const { t, lang, locale, fmt } = useI18n();
  const timeLocale = lang === 'en' ? 'en-US' : locale;
  const dateLocale = lang === 'en' ? 'en-GB' : locale;
  const [now, setNow] = useState<Date | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [browserTz, setBrowserTz] = useState('UTC');
  const [code, setCode] = useState('');

  useEffect(() => {
    setBrowserTz(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    fetch('/api/geo')
      .then((r) => r.json())
      .then((g: Geo) => setGeo(g))
      .catch(() => setGeo({ city: '', region: '', country: '', timezone: '' }));
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (geo) setCode(visitorCountry(geo.country));
  }, [geo]);

  const tz = geo?.timezone || browserTz;
  const country = countryName(code.toUpperCase(), locale);
  const place = geo?.city || country;
  const hour = now ? Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(now).reduce((h, p) => (p.type === 'hour' ? h + Number(p.value) : p.type === 'minute' ? h + Number(p.value) / 60 : h), 0)) : 12;
  const dayPart = hour >= 5 && hour < 12 ? t.time.morning : hour >= 12 && hour < 17 ? t.time.afternoon : hour >= 17 && hour < 21 ? t.time.evening : t.time.night;
  const greeting = greetingFor(code);
  const line = place ? fmt(t.time.greetFrom, { greeting, place }) : greeting;
  const date = now ? new Intl.DateTimeFormat(dateLocale, { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(now) : '';

  return (
    <div className="relative overflow-hidden rounded-[26px] border border-line bg-surface p-5 sm:p-6">
      <div aria-hidden className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-accent/20 blur-3xl" />
      <p className="relative flex min-h-[1.5rem] items-center gap-2 text-sm font-semibold text-muted">
        {code ? <CountryMark code={code} /> : <MapPin className="h-4 w-4 text-accent-fg" />}
        <span className="truncate">{code ? country : t.time.yourTz}</span>
      </p>
      <p className="relative mt-2 min-h-[2.2rem] text-[clamp(1.25rem,5vw,1.55rem)] font-extrabold leading-snug tracking-[-0.03em] text-heading">
        {geo ? <TypedGreeting key={line} text={line} /> : <span className="inline-block h-6 w-48 animate-pulse rounded-md bg-surface-2 align-middle" />}
      </p>
      <p className="relative mt-1 text-[clamp(1.9rem,9vw,2.8rem)] font-extrabold leading-none tracking-[-0.04em] text-accent-fg">
        {now ? <RollingTime date={now} tz={tz} locale={timeLocale} /> : '\u00A0'}
      </p>

      {/* Time of day where they are: sun or moon on its arc, the greeting and the date */}
      <div className="relative mt-5 flex items-center gap-4 border-t border-line pt-4">
        {now && <DayArc hour={hour} />}
        {now && (
          <motion.div className="min-w-0" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}>
            <p className="truncate text-base font-bold text-heading">{dayPart}</p>
            <p className="truncate text-sm text-muted">{date}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
