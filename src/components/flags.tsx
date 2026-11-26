import { useId } from 'react';
import type { Lang } from '@/lib/i18n';

/** Flag artwork. "slice" fills any box (circles, full-screen sweeps) without distortion. */
export function Flag({ lang, className, stretch }: { lang: Lang; className?: string; stretch?: boolean }) {
  const id = useId().replace(/:/g, '');
  // "stretch" keeps every stripe visible on tall phone screens (cropping would show only the middle).
  const common = { className, preserveAspectRatio: stretch ? 'none' : 'xMidYMid slice', 'aria-hidden': true } as const;
  if (lang === 'fr')
    return (
      <svg viewBox="0 0 3 2" {...common}>
        <rect width="1" height="2" fill="#002654" />
        <rect x="1" width="1" height="2" fill="#FFFFFF" />
        <rect x="2" width="1" height="2" fill="#ED2939" />
      </svg>
    );
  if (lang === 'de')
    return (
      <svg viewBox="0 0 5 3" {...common}>
        <rect width="5" height="1" fill="#000000" />
        <rect y="1" width="5" height="1" fill="#DD0000" />
        <rect y="2" width="5" height="1" fill="#FFCE00" />
      </svg>
    );
  if (lang === 'es')
    return (
      <svg viewBox="0 0 750 500" {...common}>
        <rect width="750" height="500" fill="#AA151B" />
        <rect y="125" width="750" height="250" fill="#F1BF00" />
      </svg>
    );
  // English: Union Jack
  return (
    <svg viewBox="0 0 60 30" {...common}>
      <clipPath id={`s${id}`}>
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id={`t${id}`}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clipPath={`url(#s${id})`}>
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#t${id})`} stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}
