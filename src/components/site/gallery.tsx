'use client';

import { useLenis } from 'lenis/react';
import { ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import type { PublicProject } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useI18n } from '../i18n';

type Shot = { src: string; title: string; projectId: string | null };

/** Two rows of project screenshots drifting slowly in opposite directions. Hover pauses a row. */
export function Gallery({ projects, extra }: { projects: PublicProject[]; extra: string[] }) {
  const { t, fmt } = useI18n();
  const shots: Shot[] = [
    ...projects.flatMap((p) => [p.coverImage, ...p.gallery].filter(Boolean).map((src) => ({ src, title: p.name, projectId: p.id }))),
    ...extra.map((src) => ({ src, title: '', projectId: null })),
  ];
  // de-duplicate the same link used twice
  const unique = shots.filter((s, i) => shots.findIndex((o) => o.src === s.src) === i);
  if (unique.length === 0) return null;

  // Split into two rows; with only a few images, both rows show all of them, offset so they don't line up.
  const rowA = unique.length >= 8 ? unique.filter((_, i) => i % 2 === 0) : unique;
  const rowB = unique.length >= 8 ? unique.filter((_, i) => i % 2 === 1) : [...unique.slice(Math.ceil(unique.length / 2)), ...unique.slice(0, Math.ceil(unique.length / 2))];

  return (
    <section id="gallery" aria-label={t.gallery.label} className="overflow-hidden py-24">
      <div className="mx-auto mb-10 flex max-w-7xl flex-wrap items-end justify-between gap-4 px-5 sm:px-8">
        <h2 className="text-[clamp(2.2rem,5vw,4.2rem)] font-extrabold leading-[0.95] tracking-[-0.045em]">{t.gallery.title}</h2>
        <p className="max-w-sm text-muted">{t.gallery.subtitle}</p>
      </div>
      <div className="grid gap-4 sm:gap-5">
        <Row shots={rowA} direction="left" label={(n) => fmt(t.gallery.view, { name: n })} />
        <Row shots={rowB} direction="right" label={(n) => fmt(t.gallery.view, { name: n })} />
      </div>
    </section>
  );
}

function Row({ shots, direction, label }: { shots: Shot[]; direction: 'left' | 'right'; label: (name: string) => string }) {
  // Repeat short rows so one copy is always wider than the screen, then render it twice for a seamless loop.
  const minTiles = 8;
  const filled = Array.from({ length: Math.max(1, Math.ceil(minTiles / shots.length)) }, () => shots).flat();
  const seconds = filled.length * 7; // about 7 s per image: a calm, steady drift

  return (
    <div className="group/row mask-fade-x motion-reduce:overflow-x-auto">
      <ul
        className={cn(
          'flex w-max gap-4 group-hover/row:[animation-play-state:paused] motion-reduce:animate-none sm:gap-5',
          direction === 'left' ? 'animate-[gallery-left_var(--d)_linear_infinite]' : 'animate-[gallery-right_var(--d)_linear_infinite]',
        )}
        style={{ '--d': `${seconds}s` } as React.CSSProperties}
      >
        {[0, 1].map((copy) =>
          filled.map((s, i) => <Tile key={`${copy}-${i}`} shot={s} hidden={copy === 1} label={label} />),
        )}
      </ul>
    </div>
  );
}

function Tile({ shot, hidden, label }: { shot: Shot; hidden: boolean; label: (name: string) => string }) {
  const [failed, setFailed] = useState(false);
  const lenis = useLenis();
  const body = (
    <>
      {failed ? (
        <span className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,rgb(var(--accent)/0.35),transparent_60%)] p-6 text-center text-lg font-bold text-heading">
          {shot.title}
        </span>
      ) : (
        <img
          src={shot.src}
          alt={hidden ? '' : shot.title}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover/tile:scale-[1.06]"
        />
      )}
      {shot.title && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover/tile:opacity-100">
          <span className="truncate text-sm font-bold text-white">{shot.title}</span>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-white" />
        </span>
      )}
    </>
  );
  const cls =
    'group/tile relative block aspect-[16/10] w-[clamp(220px,30vw,400px)] shrink-0 overflow-hidden rounded-2xl border border-line bg-surface-2 transition-[border-color,box-shadow] duration-300 hover:border-accent/60 hover:shadow-[0_24px_60px_-28px_rgb(var(--accent))]';
  return (
    <li aria-hidden={hidden || undefined}>
      {shot.projectId ? (
        <a
          href={`#case-${shot.projectId}`}
          tabIndex={hidden ? -1 : undefined}
          aria-label={label(shot.title)}
          data-cursor={shot.title ? label(shot.title) : undefined}
          onClick={(e) => {
            if (!lenis) return;
            e.preventDefault();
            lenis.scrollTo(`#case-${shot.projectId}`, { offset: -24, duration: 1.4 });
          }}
          className={cls}
        >
          {body}
        </a>
      ) : (
        <span className={cls}>{body}</span>
      )}
    </li>
  );
}
