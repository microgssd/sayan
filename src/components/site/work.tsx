'use client';

import Image from 'next/image';
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { ArrowUpRight, Github, Quote } from 'lucide-react';
import { useRef } from 'react';
import type { PublicProject } from '@/lib/types';
import { useI18n } from '../i18n';
import { useLocalizedProjects } from '../use-localized';
import { cn, initials } from '@/lib/utils';

const ease = [0.22, 1, 0.36, 1] as const;

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
        <div ref={stackRef} className="relative mx-auto max-w-7xl">
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
      )}
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
  const dim = useTransform(progress, range, [0, total > 1 ? 0.35 : 0]);
  const imageScale = useTransform(enter, [0, 1], [1.3, 1]);
  const href = p.liveUrl || p.previewUrl;

  return (
    <div ref={wrapRef} id={`case-${p.id}`} className="scroll-mt-6 py-3 md:sticky md:top-0 md:flex md:h-[100svh] md:items-center md:py-0">
      <motion.article
        style={{ scale, top: `calc(${index * 22}px - 2vh)` }}
        className="relative grid w-full origin-top overflow-hidden rounded-[30px] border border-line bg-surface shadow-[0_50px_100px_-50px_rgb(0_0_0/0.55)] md:h-[min(82svh,740px)] md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]"
      >
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />

        {/* Story */}
        <div className="relative flex flex-col justify-between gap-10 p-7 sm:p-10">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 font-semibold text-heading">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {t.status[p.status]}, {new Date(p.startDate).getUTCFullYear()}
            </span>
            <span className="font-semibold tabular-nums text-subtle">
              {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
          </div>

          <div>
            <h3 className="text-[clamp(2.1rem,4.4vw,4rem)] font-extrabold leading-[0.96] tracking-[-0.045em]">{p.name}</h3>
            {p.outcome && <p className="mt-5 text-[clamp(1.15rem,1.8vw,1.55rem)] font-bold leading-snug tracking-[-0.01em] text-accent-fg">{p.outcome}</p>}
            {p.summary && <p className="mt-4 max-w-[52ch] leading-relaxed text-muted">{p.summary}</p>}
            {p.stack.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-2">
                {p.stack.map((s) => (
                  <li key={s} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-heading">
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-6">
            {p.testimonial.quote && (
              <figure className="rounded-2xl border border-line bg-bg/40 p-5">
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
          className="group relative block min-h-[340px] overflow-hidden bg-surface-2 md:m-3 md:ml-0 md:rounded-[24px]"
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
