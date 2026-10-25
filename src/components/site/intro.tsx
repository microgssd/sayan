'use client';

import { animate, motion } from 'framer-motion';
import { useLenis } from 'lenis/react';
import { createContext, useContext, useEffect, useState } from 'react';
import { useI18n } from '../i18n';

const IntroCtx = createContext(true);
/** True once the opening curtain starts lifting (or immediately when it is skipped). */
export const useIntroDone = () => useContext(IntroCtx);

const KEY = 'intro-v2';
const COLUMNS = 5;
const ease = [0.76, 0, 0.24, 1] as const;

// Runs before first paint, so returning visitors never see the overlay flash.
const skipScript = `try{if(sessionStorage.getItem('${KEY}')||matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('intro-seen')}catch(e){}`;

export function Intro({ name, children }: { name: string; children: React.ReactNode }) {
  const [phase, setPhase] = useState<'idle' | 'counting' | 'lifting' | 'done'>('idle');
  const [count, setCount] = useState(0);
  const lenis = useLenis();
  const { t } = useI18n();

  useEffect(() => {
    if (document.documentElement.classList.contains('intro-seen')) {
      setPhase('done');
      return;
    }
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {}
    // Start only once the browser has finished setting up the page and can draw smoothly.
    // Otherwise the clock runs while the screen is frozen and the count appears to jump from 0 to 99.
    let controls: ReturnType<typeof animate> | undefined;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const begin = () => {
      setPhase('counting');
      controls = animate(0, 100, {
        duration: 1.8,
        ease: [0.65, 0, 0.35, 1],
        onUpdate: (v) => setCount(Math.round(v)),
        onComplete: () => setPhase('lifting'),
      });
    };
    const whenIdle = () => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      if (ric) ric(begin, { timeout: 700 });
      else timer = setTimeout(begin, 120);
    };
    raf = requestAnimationFrame(() => (raf = requestAnimationFrame(whenIdle)));
    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      controls?.stop();
    };
  }, []);

  useEffect(() => {
    if (phase === 'counting') lenis?.stop();
    else lenis?.start();
  }, [phase, lenis]);

  const done = phase === 'lifting' || phase === 'done';
  const [first, ...others] = name.trim().split(/\s+/);
  const rest = others.join(' ');

  return (
    <IntroCtx.Provider value={done}>
      <script dangerouslySetInnerHTML={{ __html: skipScript }} />
      {phase !== 'done' && (
        <div data-intro aria-hidden className="fixed inset-0 z-[100] overflow-hidden">
          <div className="absolute inset-0 flex">
            {Array.from({ length: COLUMNS }).map((_, i) => (
              <motion.div
                key={i}
                className="-mr-px h-full flex-1 bg-heading"
                animate={phase === 'lifting' ? { y: '-100%' } : { y: '0%' }}
                transition={{ duration: 0.95, ease, delay: (COLUMNS - 1 - i) * 0.07 }}
                onAnimationComplete={() => i === 0 && phase === 'lifting' && setPhase('done')}
              />
            ))}
          </div>

          <motion.div
            className="absolute inset-0 flex flex-col justify-between p-6 text-bg sm:p-10"
            animate={phase === 'lifting' ? { opacity: 0, y: -60 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease }}
          >
            <div className="h-px w-full bg-bg/15">
              <div className="h-full origin-left bg-accent" style={{ transform: `scaleX(${count / 100})` }} />
            </div>

            {/* Your name: the two halves glide in from opposite sides and meet at the purple spark.
                Sized to the name's real width (5.26em), so it fits any screen on one line, nothing clipped. */}
            <p
              className="flex items-center justify-center whitespace-nowrap py-[0.12em] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ fontFamily: 'var(--font-name), var(--font-jakarta), sans-serif', fontSize: 'clamp(2.4rem, 16vw, 11rem)' }}
            >
              <motion.span
                className="inline-block"
                initial={{ opacity: 0, x: '-0.28em' }} // a short glide, so the name never reaches the screen edge
                animate={phase === 'idle' ? {} : { opacity: 1, x: '0em' }}
                transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              >
                {first}
              </motion.span>
              <motion.svg
                viewBox="0 0 24 24"
                className="mx-[0.12em] inline-block h-[0.5em] w-[0.5em] shrink-0"
                initial={{ opacity: 0, scale: 0, rotate: -180 }}
                animate={phase === 'idle' ? {} : { opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.8, ease: [0.3, 1.5, 0.5, 1], delay: 0.85 }}
              >
                <path d="M12 0c.6 6.6 5.4 11.4 12 12-6.6.6-11.4 5.4-12 12-.6-6.6-5.4-11.4-12-12C6.6 11.4 11.4 6.6 12 0Z" fill="#A855F7" />
              </motion.svg>
              <motion.span
                className="inline-block"
                initial={{ opacity: 0, x: '0.28em' }}
                animate={phase === 'idle' ? {} : { opacity: 1, x: '0em' }}
                transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              >
                {rest}
              </motion.span>
            </p>

            <div className="flex items-end justify-between gap-6">
              <p className="max-w-[16rem] text-sm opacity-60">{t.intro.tagline}</p>
              <p className="text-[clamp(3.5rem,9vw,8rem)] font-extrabold leading-none tracking-[-0.05em] tabular-nums">
                {String(count).padStart(3, '0')}
              </p>
            </div>
          </motion.div>
        </div>
      )}
      {children}
    </IntroCtx.Provider>
  );
}
