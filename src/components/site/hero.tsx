'use client';

import Image from 'next/image';
import { AnimatePresence, motion, useMotionValue, useScroll, useSpring, useTransform } from 'framer-motion';
import { useLenis } from 'lenis/react';
import { ArrowDownRight, MapPin } from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import type { PortfolioStats, PublicProject, SiteSettings } from '@/lib/types';
import type { TechIcon } from '@/lib/tech-icons';
import { initials } from '@/lib/utils';
import { useIntroDone } from './intro';
import { resolveNumbers } from '@/lib/numbers';
import { BrandMark } from '../brand-mark';
import { Kawaii, isKawaii, type KawaiiName } from '../kawaii';
import { useI18n } from '../i18n';
import { useLocalizedProjects, useLocalizedSettings } from '../use-localized';
import { CountUp, Magnetic, VelocityMarquee } from './motion-kit';
import { SignalField } from './signal-field';

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero({
  settings: rawSettings,
  stats,
  tech,
  projects: rawProjects,
}: {
  settings: SiteSettings;
  stats: PortfolioStats;
  tech: TechIcon[];
  projects: PublicProject[];
}) {
  const done = useIntroDone();
  const lenis = useLenis();
  const { t, fmt } = useI18n();
  const settings = useLocalizedSettings(rawSettings);
  const projects = useLocalizedProjects(rawProjects);
  // The word-by-word entrance plays once. After that, a language switch just shows the new words.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setEntered(true), 2600);
    return () => clearTimeout(t);
  }, [done]);
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '-18%']);
  const cardY = useTransform(scrollYProgress, [0, 1], ['0%', '-32%']);
  const fade = useTransform(scrollYProgress, [0, 0.65], [1, 0]);

  // Pointer position (−0.5 … 0.5) drives the portrait tilt and chip parallax.
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const tokens = settings.heroTitle.replace(/\r?\n/g, ' ').split(/(\[\d\])/).filter(Boolean);
  let wordIndex = 0;

  return (
    <section
      ref={ref}
      className="relative isolate flex min-h-[100svh] flex-col overflow-hidden"
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width - 0.5);
        py.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
      }}
    >
      <SignalField className="absolute inset-0 -z-10 h-full w-full [mask-image:radial-gradient(ellipse_80%_70%_at_50%_40%,black,transparent)]" />
      <div aria-hidden className="pointer-events-none absolute -top-[25%] right-[-10%] -z-10 h-[75vh] w-[60vw] rounded-full bg-accent/[0.18] blur-[140px]" />
      <div aria-hidden className="noise pointer-events-none absolute inset-0 -z-10 opacity-[0.05] mix-blend-overlay" />

      <div className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-14 px-5 pb-14 pt-32 sm:px-8 lg:grid-cols-[1.3fr_0.7fr] lg:gap-16 lg:pt-36">
        <motion.div style={{ y: textY, opacity: fade }}>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={done ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease, delay: 0.1 }}
            className="inline-flex items-center gap-2.5 rounded-full border border-line bg-surface/70 py-1.5 pl-1.5 pr-4 text-sm font-semibold text-heading backdrop-blur"
          >
            <BrandMark className="h-7 w-7" />
            {settings.name}, {t.meta.role}
          </motion.p>

          <h1 className="mt-8 text-[clamp(2.1rem,4.9vw,4.6rem)] font-bold leading-[1.12] tracking-[-0.035em]">
            {tokens.map((tok, ti) => {
              const slot = tok.match(/^\[(\d)\]$/);
              if (slot) {
                const n = Number(slot[1]);
                return (
                  <Fragment key={ti}>
                    <ProjectPill art={(isKawaii(settings.heroPills?.[n - 1]) ? settings.heroPills[n - 1] : (['rocket', 'bag', 'robot'] as const)[(n - 1) % 3]) as KawaiiName} entered={entered} label={projects[n - 1] ? fmt(t.hero.seeProject, { name: projects[n - 1]!.name }) : ''} project={projects[n - 1]} n={n} done={done} delay={0.5 + n * 0.12} onJump={(id) => lenis?.scrollTo(`#case-${id}`, { offset: -24, duration: 1.4 })} />{' '}
                  </Fragment>
                );
              }
              return tok
                .split(/\s+/)
                .filter(Boolean)
                .map((word) => {
                  const i = wordIndex++;
                  return (
                    <Fragment key={`${ti}-${i}`}>
                      <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                        <motion.span
                          className="inline-block"
                          initial={entered ? false : { y: '110%' }}
                          animate={done ? { y: '0%' } : {}}
                          transition={{ duration: 0.9, ease, delay: 0.15 + i * 0.045 }}
                        >
                          {word}
                        </motion.span>
                      </span>{' '}
                    </Fragment>
                  );
                });
            })}
          </h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={done ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.9, ease, delay: 0.85 }}
          >
            {settings.headline && <p className="mt-7 max-w-[50ch] text-lg leading-relaxed text-muted">{settings.headline}</p>}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Magnetic>
                <a
                  href="#contact"
                  onClick={(e) => {
                    if (!lenis) return;
                    e.preventDefault();
                    lenis.scrollTo('#contact', { offset: -24, duration: 1.6 });
                  }}
                  className="group relative inline-flex h-14 items-center gap-3 overflow-hidden rounded-full bg-accent pl-7 pr-2 text-base font-bold text-accent-ink"
                >
                  <span className="relative z-10">{t.hero.start}</span>
                  <span className="relative z-10 grid h-10 w-10 place-items-center rounded-full bg-accent-ink text-accent transition-transform duration-500 group-hover:rotate-[-45deg]">
                    <ArrowDownRight className="h-5 w-5 -rotate-90" />
                  </span>
                </a>
              </Magnetic>
              <a
                href="#work"
                onClick={(e) => {
                  if (!lenis) return;
                  e.preventDefault();
                  lenis.scrollTo('#work', { offset: -24, duration: 1.4 });
                }}
                className="inline-flex h-14 items-center rounded-full border border-line px-7 text-base font-bold text-heading transition-colors hover:border-heading"
              >
                {t.hero.viewWork}
              </a>
            </div>
          </motion.div>
        </motion.div>

        <motion.div style={{ y: cardY }}>
          <Portrait settings={settings} stats={stats} done={done} px={px} py={py} />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={done ? { opacity: 1 } : {}}
        transition={{ duration: 1, delay: 1.1 }}
        className="border-y border-line bg-surface/30 backdrop-blur-sm"
      >
        <VelocityMarquee items={tech} />
      </motion.div>
    </section>
  );
}

/** A project screenshot set inside the sentence. Hover previews it, click jumps to its case card. */
function ProjectPill({
  art,
  entered,
  label,
  project,
  n,
  done,
  delay,
  onJump,
}: {
  art: KawaiiName;
  entered: boolean;
  label: string;
  project?: PublicProject;
  n: number;
  done: boolean;
  delay: number;
  onJump: (id: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const img = imgFailed ? '' : project?.coverImage || project?.gallery[0];
  const pill = (
    <motion.span
      initial={entered ? false : { width: 0, opacity: 0 }}
      animate={done ? { width: '1.9em', opacity: 1 } : {}}
      transition={{ duration: 1, ease, delay }}
      className="relative inline-block h-[0.86em] overflow-hidden rounded-full align-[-0.1em] ring-1 ring-[#C084FC]/40 transition-shadow duration-300 group-hover/pill:ring-2 group-hover/pill:ring-accent"
    >
      {/* A little animated character; the project's screenshot shows in the hover preview */}
      <span className="absolute inset-0 bg-[linear-gradient(135deg,#2B1B4F,#4C1D95)]" />
      <Kawaii name={art} className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover/pill:scale-110" />
    </motion.span>
  );

  if (!project) return <span aria-hidden>{pill}</span>;
  return (
    <a
      href={`#case-${project.id}`}
      onClick={(e) => {
        e.preventDefault();
        onJump(project.id);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      aria-label={label}
      className="group/pill relative inline-block"
    >
      {pill}
      <AnimatePresence>
        {hover && (
          <motion.span
            initial={{ opacity: 0, y: 10, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.25, ease }}
            className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 hidden w-60 -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-2xl md:block"
          >
            <span className="relative block aspect-[16/10] bg-surface-2">
              {!img && (
                <span className="absolute inset-0 bg-[linear-gradient(135deg,#2B1B4F,#4C1D95)]">
                  <Kawaii name={art} className="absolute inset-0 h-full w-full" />
                </span>
              )}
              {img &&
                (img.startsWith('https://') ? (
                  <Image src={img} alt="" fill sizes="240px" className="object-cover" onError={() => setImgFailed(true)} />
                ) : (
                  <img src={img} alt="" className="h-full w-full object-cover" onError={() => setImgFailed(true)} />
                ))}
            </span>
            <span className="block p-3">
              <span className="block text-sm font-bold tracking-normal text-heading">{project.name}</span>
              {project.outcome && <span className="mt-1 block text-xs font-medium leading-snug tracking-normal text-muted">{project.outcome}</span>}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </a>
  );
}

function Portrait({
  settings,
  stats,
  done,
  px,
  py,
}: {
  settings: SiteSettings;
  stats: PortfolioStats;
  done: boolean;
  px: ReturnType<typeof useMotionValue<number>>;
  py: ReturnType<typeof useMotionValue<number>>;
}) {
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-10, 10]), { stiffness: 120, damping: 18 });
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [8, -8]), { stiffness: 120, damping: 18 });
  const chipX = useSpring(useTransform(px, [-0.5, 0.5], [-18, 18]), { stiffness: 90, damping: 18 });
  const chipY = useSpring(useTransform(py, [-0.5, 0.5], [-12, 12]), { stiffness: 90, damping: 18 });

  const { t } = useI18n();
  const nums = resolveNumbers(settings.numbers, stats);
  // Two chips on the photo: active clients and active projects (your numbers, or counted automatically).
  const chips = [
    { id: 'heroClients', value: nums.heroClients.value, suffix: nums.heroClients.suffix, label: nums.heroClients.label || t.hero.activeClients, pos: 'left-[-6%] top-[14%] sm:left-[-14%]' },
    { id: 'heroProjects', value: nums.heroProjects.value, suffix: nums.heroProjects.suffix, label: nums.heroProjects.label || t.hero.activeProjects, pos: 'right-[-6%] bottom-[16%] sm:right-[-12%]' },
  ].filter((c) => c.value > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, rotate: -4 }}
      animate={done ? { opacity: 1, y: 0, rotate: 0 } : {}}
      transition={{ duration: 1.3, ease, delay: 0.35 }}
      className="relative mx-auto w-[74%] max-w-[400px] [perspective:1200px] sm:w-[70%] lg:w-full"
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className="relative aspect-[4/5] overflow-hidden rounded-[34px] border border-line bg-surface shadow-[0_60px_120px_-40px_rgb(var(--accent)/0.45)]"
      >
        {settings.photoUrl ? (
          settings.photoUrl.startsWith('https://') ? (
            <Image src={settings.photoUrl} alt={settings.name} fill priority sizes="(min-width: 1024px) 400px, 70vw" className="object-cover" />
          ) : (
            <img src={settings.photoUrl} alt={settings.name} className="h-full w-full object-cover" />
          )
        ) : (
          <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_30%_20%,rgb(var(--accent)/0.55),transparent_60%)]">
            <span className="text-[7rem] font-extrabold tracking-[-0.06em] text-heading/90">{initials(settings.name)}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
        {settings.location && (
          <p className="absolute bottom-5 left-5 flex items-center gap-1.5 text-sm font-semibold text-white">
            <MapPin className="h-4 w-4" /> {settings.location}
          </p>
        )}
      </motion.div>

      {settings.availability && (
        <motion.p
          style={{ x: chipX, y: chipY }}
          className="absolute -top-4 right-[6%] flex items-center gap-2 rounded-full border border-line bg-surface/90 px-3.5 py-2 text-xs font-bold text-heading shadow-xl backdrop-blur"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70 motion-reduce:hidden" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          {settings.availability}
        </motion.p>
      )}

      {chips.map((c, i) => (
        <motion.div key={c.id} style={{ x: chipX, y: chipY }} className={`absolute ${c.pos}`}>
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.6 }}
            className="rounded-2xl border border-line bg-surface/85 px-4 py-3 shadow-xl backdrop-blur-md"
          >
            <p className="text-2xl font-extrabold leading-none tracking-[-0.03em] text-heading">
              <CountUp to={c.value} start={done} suffix={c.suffix} />
            </p>
            <p className="mt-1 text-xs font-medium text-muted">{c.label}</p>
          </motion.div>
        </motion.div>
      ))}
    </motion.div>
  );
}
