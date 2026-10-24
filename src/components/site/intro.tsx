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
    setPhase('counting');
    const controls = animate(0, 100, {
      duration: 1.8,
      ease: [0.65, 0, 0.35, 1],
      onUpdate: (v) => setCount(Math.round(v)),
      onComplete: () => setPhase('lifting'),
    });
    return () => controls.stop();
  }, []);

  useEffect(() => {
    if (phase === 'counting') lenis?.stop();
    else lenis?.start();
  }, [phase, lenis]);

  const done = phase === 'lifting' || phase === 'done';
  const letters = Array.from(name);

  return (
    <IntroCtx.Provider value={done}>
      <script dangerouslySetInnerHTML={{ __html: skipScript }} />
      {phase !== 'done' && (
        <div data-intro aria-hidden className="fixed inset-0 z-[100]">
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

            <div className="overflow-hidden">
              <p className="text-[clamp(3rem,12vw,11rem)] font-extrabold leading-[0.9] tracking-[-0.05em]">
                {letters.map((ch, i) => (
                  <motion.span
                    key={i}
                    className="inline-block"
                    initial={{ y: '110%' }}
                    animate={phase === 'idle' ? { y: '110%' } : { y: '0%' }}
                    transition={{ duration: 0.9, ease, delay: 0.1 + i * 0.045 }}
                  >
                    {ch === ' ' ? '\u00A0' : ch}
                  </motion.span>
                ))}
              </p>
            </div>

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
