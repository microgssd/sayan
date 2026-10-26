'use client';

import Image from 'next/image';
import { motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { ArrowUpRight, ChevronUp, Github, Quote } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLenis } from 'lenis/react';
import type { PublicProject } from '@/lib/types';
import { useI18n } from '../i18n';
import { useLocalizedProjects } from '../use-localized';
import { cn, initials } from '@/lib/utils';

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Anchor for a project, wherever it's showing: the full-screen reel on phones, the stacking card elsewhere.
 * Used by the hero pills and the gallery so a tap always lands on the visible one.
 */
export function caseTarget(id: string): { selector: string; offset: number } {
  const reel = typeof document !== 'undefined' ? document.getElementById(`reel-${id}`) : null;
  return reel && reel.offsetParent !== null ? { selector: `#reel-${id}`, offset: 0 } : { selector: `#case-${id}`, offset: -24 };
}

export function Work({ projects: raw }: { projects: PublicProject[] }) {
  const projects = useLocalizedProjects(raw);
  const stackRef = useRef<HTMLDivElement>(null);
  const { t, fmt } = useI18n();
  const { scrollYProgress } = useScroll({ target: stackRef, offset: ['start start', 'end end'] });

  return (
    <section id="work" className="relative px-3 pb-24 sm:px-5">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-6 px-2 pb-12 pt-10 sm:px-3">
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 0.9, ease }}
          className="text-[clamp(2.6rem,7vw,6.5rem)] font-extrabold leading-[0.92] tracking-[-0.05em]"
        >
          {t.work.title}
        </motion.h2>
        <p className="max-w-sm text-muted">
          {projects.length === 0 ? t.work.none : projects.length === 1 ? t.work.countOne : fmt(t.work.countMany, { n: projects.length })}
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="mx-auto max-w-7xl rounded-[28px] border border-dashed border-line p-14 text-center text-muted">
          {t.work.empty}
        </div>
      ) : (
        <>
        {/* Phones: full-screen reels */}
        <Reels projects={projects} />
        {/* Tablets and computers: stacking cards */}
        <div ref={stackRef} className="relative mx-auto hidden max-w-7xl md:block">
          {projects.map((p, i) => (
            <CaseCard
              key={p.id}
              project={p}
              index={i}
              total={projects.length}
              progress={scrollYProgress}
              range={[i / projects.length, 1]}
              targetScale={1 - (projects.length - 1 - i) * 0.04}
            />
          ))}
        </div>
        </>
      )}
    </section>
  );
}

/* ---------------- Phones: full-screen reels ---------------- */

/**
 * Snap assist. CSS snapping is kept gentle so the rest of the page scrolls freely, which means a swipe can stop
 * halfway between two reels. When scrolling settles inside the reels, glide to whichever reel fills more of the screen.
 */
function useReelSnap(wrap: React.RefObject<HTMLDivElement>, lenis: ReturnType<typeof useLenis>) {
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let touching = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      if (touching || el.offsetParent === null) return;
      const vh = window.innerHeight;
      const box = el.getBoundingClientRect();
      if (box.top > 1 || box.bottom < vh - 1) return; // not inside the reels: leave the page alone
      const reels = [...el.children] as HTMLElement[];
      const nearest = reels.reduce((best, r) => (Math.abs(r.getBoundingClientRect().top) < Math.abs(best.getBoundingClientRect().top) ? r : best));
      const off = nearest.getBoundingClientRect().top;
      if (Math.abs(off) < 2) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (lenis) lenis.scrollTo(nearest, { duration: reduce ? 0 : 0.6, immediate: reduce });
      else window.scrollBy({ top: off, behavior: reduce ? 'auto' : 'smooth' });
    };
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(settle, 140);
    };
    const down = () => (touching = true);
    const up = () => {
      touching = false;
      onScroll();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchend', up, { passive: true });
    window.addEventListener('touchcancel', up, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchend', up);
      window.removeEventListener('touchcancel', up);
    };
  }, [wrap, lenis]);
}

function Reels({ projects }: { projects: PublicProject[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const lenis = useLenis();
  useReelSnap(wrap, lenis);
  return (
    <div ref={wrap} className="-mx-3 sm:-mx-5 md:hidden">
      {projects.map((p, i) => (
        <Reel key={p.id} project={p} index={i} total={projects.length} />
      ))}
    </div>
  );
}

/** One project, full screen: image zooms in, story bars fill, text slides up. Snaps into place as you swipe. */
function Reel({ project: p, index, total }: { project: PublicProject; index: number; total: number }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.6 });
  const reduced = useReducedMotion();
  const { t, fmt } = useI18n();
  const [failed, setFailed] = useState(false);
  const img = failed ? '' : p.coverImage || p.gallery[0];
  const show = inView || !!reduced;
  const rise = (k: number) => ({
    initial: false as const,
    animate: show ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 },
    transition: { duration: reduced ? 0 : 0.7, ease, delay: show && !reduced ? 0.15 + k * 0.08 : 0 },
  });

  return (
    <section ref={ref} id={`reel-${p.id}`} aria-label={p.name} className="relative h-[100svh] snap-start snap-always overflow-hidden bg-surface">
      {/* Full-bleed image, zooming in as the reel arrives */}
      <motion.div className="absolute inset-0" initial={false} animate={{ scale: show ? 1 : 1.18 }} transition={{ duration: reduced ? 0 : 1.6, ease }}>
        {img ? (
          img.startsWith('https://') ? (
            <Image src={img} alt="" fill sizes="100vw" className="object-cover" priority={index === 0} onError={() => setFailed(true)} />
          ) : (
            <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setFailed(true)} />
          )
        ) : (
          <MockFrame project={p} />
        )}
      </motion.div>
      {/* Keeps text readable over any image, in light and dark mode */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 via-45% to-transparent" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-bg/70 to-transparent" />

      {/* Story progress bars */}
      <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top,0px)+14px)] flex items-center gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, k) => (
          <span key={k} className="h-[3px] flex-1 overflow-hidden rounded-full bg-heading/20">
            <motion.span
              className="block h-full origin-left rounded-full bg-heading"
              initial={false}
              animate={{ scaleX: k < index ? 1 : k === index && show ? 1 : 0 }}
              transition={{ duration: k === index && !reduced ? 0.9 : 0, ease: 'linear', delay: k === index ? 0.2 : 0 }}
            />
          </span>
        ))}
        <span className="ml-2 text-xs font-bold tabular-nums text-heading">
          {String(index + 1).padStart(2, '0')}/{String(total).padStart(2, '0')}
        </span>
      </div>

      {/* Story text */}
      <div className="absolute inset-x-0 bottom-0 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+28px)]">
        <motion.span {...rise(0)} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1 text-xs font-semibold text-heading backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          {t.status[p.status]}, {new Date(p.startDate).getUTCFullYear()}
        </motion.span>
        <motion.h3 {...rise(1)} className="mt-3 text-[clamp(2rem,9.5vw,2.9rem)] font-extrabold leading-[0.98] tracking-[-0.045em]">
          {p.name}
        </motion.h3>
        {p.outcome && (
          <motion.p {...rise(2)} className="mt-3 text-lg font-bold leading-snug text-accent-fg">
            {p.outcome}
          </motion.p>
        )}
        {p.summary && (
          <motion.p {...rise(3)} className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-muted">
            {p.summary}
          </motion.p>
        )}
        {p.stack.length > 0 && (
          <motion.ul {...rise(4)} className="mt-4 flex max-h-[3.6rem] flex-wrap gap-1.5 overflow-hidden">
            {p.stack.map((x) => (
              <li key={x} className="rounded-full bg-surface-2/80 px-2.5 py-1 text-[11px] font-semibold text-heading backdrop-blur">
                {x}
              </li>
            ))}
          </motion.ul>
        )}
        <motion.div {...rise(5)} className="mt-5 flex flex-wrap items-center gap-2">
          <CaseLink href={p.liveUrl} label={t.work.visit} primary />
          <CaseLink href={p.previewUrl} label={t.work.preview} />
          {p.repoUrl && (
            <a
              href={p.repoUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={fmt(t.work.source, { name: p.name })}
              className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface/60 text-heading backdrop-blur"
            >
              <Github className="h-4 w-4" />
            </a>
          )}
        </motion.div>
        {index === 0 && total > 1 && (
          <motion.p
            aria-hidden
            initial={false}
            animate={show ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: reduced ? 0 : 1.2, duration: 0.6 }}
            className="mt-5 flex items-center justify-center gap-1.5 text-xs font-semibold text-muted"
          >
            <ChevronUp className="h-4 w-4 animate-bounce" /> {t.work.swipe}
          </motion.p>
        )}
      </div>
    </section>
  );
}

function CaseCard({
  project: p,
  index,
  total,
  progress,
  range,
  targetScale,
}: {
  project: PublicProject;
  index: number;
  total: number;
  progress: MotionValue<number>;
  range: [number, number];
  targetScale: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { t, fmt } = useI18n();
  const { scrollYProgress: enter } = useScroll({ target: wrapRef, offset: ['start end', 'start start'] });
  const scale = useTransform(progress, range, [1, targetScale]);
  // Cards dim as the next one covers them; the last card is never covered, so it stays bright.
  const dim = useTransform(progress, range, [0, index < total - 1 ? 0.35 : 0]);
  const imageScale = useTransform(enter, [0, 1], [1.3, 1]);
  const href = p.liveUrl || p.previewUrl;

  return (
    <div ref={wrapRef} id={`case-${p.id}`} className="sticky top-0 flex h-[100svh] scroll-mt-6 items-center [--stack-gap:12px] md:[--stack-gap:22px]">
      <motion.article
        style={{ scale, top: `calc(${index} * var(--stack-gap) - 2vh)` }}
        className="relative flex h-[min(84svh,680px)] w-full origin-top flex-col overflow-hidden rounded-[24px] border border-line bg-surface shadow-[0_50px_100px_-50px_rgb(0_0_0/0.55)] md:grid md:h-[min(82svh,740px)] md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] md:rounded-[30px]"
      >
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />

        {/* Story */}
        <div className="relative flex min-h-0 flex-1 flex-col justify-between gap-4 overflow-hidden p-5 sm:p-7 md:gap-10 md:p-10">
          <div className="flex items-center justify-between gap-4 text-xs sm:text-sm">
            <span className="inline-flex items-center gap-2 rounded-full border border-line px-2.5 py-1 font-semibold text-heading sm:px-3">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {t.status[p.status]}, {new Date(p.startDate).getUTCFullYear()}
            </span>
            <span className="font-semibold tabular-nums text-subtle">
              {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
          </div>

          <div>
            {/* Name and result glide in as the card arrives */}
            <motion.h3
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px 0px -15% 0px' }}
              transition={{ duration: 0.8, ease }}
              className="line-clamp-2 text-[clamp(1.7rem,7vw,4rem)] font-extrabold leading-[0.98] tracking-[-0.045em] md:line-clamp-none md:text-[clamp(2.1rem,4.4vw,4rem)]"
            >
              {p.name}
            </motion.h3>
            {p.outcome && (
              <motion.p
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '0px 0px -15% 0px' }}
                transition={{ duration: 0.8, ease, delay: 0.12 }}
                className="mt-3 line-clamp-3 text-base font-bold leading-snug tracking-[-0.01em] text-accent-fg sm:text-lg md:mt-5 md:line-clamp-none md:text-[clamp(1.15rem,1.8vw,1.55rem)]"
              >
                {p.outcome}
              </motion.p>
            )}
            {p.summary && <p className="mt-4 hidden max-w-[52ch] leading-relaxed text-muted sm:line-clamp-2 md:line-clamp-none md:block">{p.summary}</p>}
            {p.stack.length > 0 && (
              <ul className="mt-4 flex max-h-[3.75rem] flex-wrap gap-1.5 overflow-hidden md:mt-6 md:max-h-none md:gap-2">
                {p.stack.map((s) => (
                  <li key={s} className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-heading sm:px-3 sm:text-xs">
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-6">
            {p.testimonial.quote && (
              <figure className="hidden rounded-2xl border border-line bg-bg/40 p-5 md:block">
                <Quote className="h-5 w-5 text-accent-fg" aria-hidden />
                <blockquote className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink">{p.testimonial.quote}</blockquote>
                {p.testimonial.author && (
                  <figcaption className="mt-3 text-xs text-muted">
                    <span className="font-bold text-heading">{p.testimonial.author}</span>
                    {p.testimonial.role && `, ${p.testimonial.role}`}
                  </figcaption>
                )}
              </figure>
            )}
            <div className="flex flex-wrap gap-2">
              <CaseLink href={p.liveUrl} label={t.work.visit} primary />
              <CaseLink href={p.previewUrl} label={t.work.preview} />
              {p.repoUrl && (
                <a
                  href={p.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={fmt(t.work.source, { name: p.name })}
                  className="grid h-11 w-11 place-items-center rounded-full border border-line text-heading transition-colors hover:border-heading"
                >
                  <Github className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Visual */}
        <a
          href={href || undefined}
          target={href ? '_blank' : undefined}
          rel="noreferrer"
          data-cursor={href ? t.work.visitCursor : undefined}
          tabIndex={-1}
          aria-hidden
          className="group relative order-first block h-[36%] shrink-0 overflow-hidden bg-surface-2 md:order-none md:m-3 md:ml-0 md:h-auto md:min-h-[340px] md:rounded-[24px]"
        >
          <Collage project={p} imageScale={imageScale} />
        </a>

        <motion.div aria-hidden style={{ opacity: dim }} className="pointer-events-none absolute inset-0 bg-bg" />
      </motion.article>
    </div>
  );
}

function Collage({ project: p, imageScale }: { project: PublicProject; imageScale: MotionValue<number> }) {
  const images = [p.coverImage, ...p.gallery].filter(Boolean).slice(0, 3);
  if (!images.length) return <MockFrame project={p} />;

  const Img = ({ src, className, sizes }: { src: string; className?: string; sizes: string }) => (
    <div className={cn('relative overflow-hidden', className)}>
      <motion.div style={{ scale: imageScale }} className="absolute inset-0">
        {src.startsWith('https://') ? (
          <Image src={src} alt="" fill sizes={sizes} className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105" />
        ) : (
          <img src={src} alt="" className="h-full w-full object-cover" />
        )}
      </motion.div>
    </div>
  );

  if (images.length === 1) return <Img src={images[0]!} className="absolute inset-0" sizes="(min-width: 768px) 55vw, 100vw" />;
  return (
    <div className="absolute inset-0 grid grid-cols-[1.6fr_1fr] gap-2 p-2">
      <Img src={images[0]!} className="rounded-[18px]" sizes="(min-width: 768px) 34vw, 62vw" />
      <div className="grid gap-2" style={{ gridTemplateRows: `repeat(${images.length - 1}, 1fr)` }}>
        {images.slice(1).map((src) => (
          <Img key={src} src={src} className="rounded-[18px]" sizes="(min-width: 768px) 21vw, 38vw" />
        ))}
      </div>
    </div>
  );
}

/** Shown when a project has no images yet, so every card still looks finished. */
function MockFrame({ project: p }: { project: PublicProject }) {
  let host = '';
  try {
    host = p.liveUrl ? new URL(p.liveUrl).host : '';
  } catch {}
  return (
    <div className="absolute inset-0 flex flex-col p-5 sm:p-8">
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-bg shadow-2xl transition-transform duration-700 group-hover:-translate-y-1">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-subtle/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-subtle/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-subtle/50" />
          <span className="ml-3 truncate rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">{host || p.name.toLowerCase().replace(/\s+/g, '') + '.app'}</span>
        </div>
        <div className="relative flex-1 overflow-hidden">
          <div className="bg-dots absolute inset-0 opacity-70" />
          <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-accent/30 blur-3xl" />
          <div className="absolute bottom-6 left-6 right-6 grid gap-3">
            <div className="h-3 w-2/3 rounded-full bg-heading/15" />
            <div className="h-3 w-1/2 rounded-full bg-heading/10" />
            <div className="mt-2 grid grid-cols-3 gap-3">
              <div className="h-16 rounded-xl bg-accent/20" />
              <div className="h-16 rounded-xl bg-heading/10" />
              <div className="h-16 rounded-xl bg-heading/10" />
            </div>
          </div>
          <span className="absolute left-6 top-5 text-[clamp(3rem,7vw,6rem)] font-extrabold tracking-[-0.06em] text-heading/[0.08]">{initials(p.name)}</span>
        </div>
      </div>
    </div>
  );
}

function CaseLink({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'group/link inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-bold transition-all',
        primary ? 'bg-heading text-bg hover:bg-accent hover:text-accent-ink' : 'border border-line text-heading hover:border-heading',
      )}
    >
      {label}
      <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5" />
    </a>
  );
}
