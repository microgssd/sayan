// The six language-switch animations. Each one runs `swap()` at the right moment, which re-renders
// the page in the new language and resolves once the new text is on screen.
import type { Lang } from './i18n';

export type TransitionCtx = { to: Lang; native: string; x: number; y: number; swap: () => Promise<void> };
export type TransitionName = 'ribbons' | 'flap' | 'frost';

const UK =
  'url("data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice"><path d="M0,0v30h60V0z" fill="#012169"/><path d="M0,0L60,30M60,0L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0L60,30M60,0L0,30" stroke="#C8102E" stroke-width="2.5"/><path d="M30,0v30M0,15h60" stroke="#fff" stroke-width="10"/><path d="M30,0v30M0,15h60" stroke="#C8102E" stroke-width="6"/></svg>',
  ) +
  '")';
export const FLAG_CSS: Record<Lang, string> = {
  en: `${UK} center / cover`,
  fr: 'linear-gradient(90deg,#002654 0 33.4%,#fff 0 66.7%,#ED2939 0)',
  de: 'linear-gradient(#000 0 33.4%,#DD0000 0 66.7%,#FFCE00 0)',
  es: 'linear-gradient(#AA151B 0 25%,#F1BF00 0 75%,#AA151B 0)',
};
const EASE = 'cubic-bezier(.65,0,.35,1)';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function layer() {
  const d = document.createElement('div');
  d.setAttribute('aria-hidden', 'true');
  d.style.cssText = 'position:fixed;inset:0;z-index:200;pointer-events:none;overflow:hidden';
  document.body.appendChild(d);
  return d;
}
function box(parent: HTMLElement, css: Partial<CSSStyleDeclaration>) {
  const d = document.createElement('div');
  d.style.position = 'absolute';
  Object.assign(d.style, css);
  parent.appendChild(d);
  return d;
}
const play = (el: Element, kf: Keyframe[], o: KeyframeAnimationOptions) => el.animate(kf, { fill: 'forwards', ...o }).finished;

/** Text-bearing elements currently visible on screen, top to bottom. */
function visibleBlocks(limit = 16) {
  const sel = 'main h1, main h2, main h3, main p, main dt, main dd, main legend, header a, header p, main a.inline-flex, main button.inline-flex';
  return [...document.querySelectorAll<HTMLElement>(sel)]
    .filter((el) => {
      if (el.closest('[aria-hidden="true"], [role="dialog"]')) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && el.textContent!.trim().length > 1;
    })
    .filter((el, _, all) => !all.some((o) => o !== el && o.contains(el)))
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
    .slice(0, limit);
}

/* 2 — three angled ribbons sweep across, each a window onto the real full-screen flag;
   together they reveal the whole flag (Union Jack, Tricolore …), then sweep away */
async function ribbons({ to, swap }: TransitionCtx) {
  const L = layer();
  const W = innerWidth;
  const H = innerHeight;
  const s = Math.tan((16 * Math.PI) / 180) * H; // horizontal lean of each ribbon
  const w = (W + s) * 0.45;
  const band = (x: number) => `polygon(${x + s}px 0px, ${x + s + w}px 0px, ${x + w}px ${H}px, ${x}px ${H}px)`;
  const start = W + 40;
  const stops = [0, 1, 2].map((i) => -s - 10 + i * 0.9 * w); // overlapping, so together they cover the screen
  const end = -w - s - 40;
  const layers = stops.map(() => {
    const d = box(L, { inset: '0', background: FLAG_CSS[to], clipPath: band(start) });
    d.style.backgroundSize = 'cover';
    return d;
  });
  await Promise.all(layers.map((d, i) => play(d, [{ clipPath: band(start) }, { clipPath: band(stops[i]!) }], { duration: 560, delay: i * 90, easing: EASE })));
  const full = box(L, { inset: '0', background: FLAG_CSS[to] });
  full.style.backgroundSize = 'cover';
  L.prepend(full);
  layers.forEach((d) => (d.style.boxShadow = 'none'));
  await swap();
  await wait(120);
  full.remove(); // let the ribbons carry the flag away
  await Promise.all(layers.map((d, i) => play(d, [{ clipPath: band(stops[i]!) }, { clipPath: band(end) }], { duration: 580, delay: i * 80, easing: EASE })));
  L.remove();
}

/* 4 — every visible line flips over like a departures board, one after another */
async function flap({ swap }: TransitionCtx) {
  const out = visibleBlocks();
  const outs = out.map((el, i) =>
    el.animate([{ transform: 'perspective(700px) rotateX(0deg)', opacity: 1 }, { transform: 'perspective(700px) rotateX(90deg)', opacity: 0 }], {
      duration: 220,
      delay: i * 30,
      easing: 'ease-in',
      fill: 'forwards',
    }),
  );
  await Promise.all(outs.map((a) => a.finished));
  await swap();
  outs.forEach((a) => a.cancel());
  const back = visibleBlocks();
  await Promise.all(
    back.map((el, i) =>
      el
        .animate([{ transform: 'perspective(700px) rotateX(-90deg)', opacity: 0 }, { transform: 'perspective(700px) rotateX(0deg)', opacity: 1 }], {
          duration: 440,
          delay: i * 55,
          easing: 'cubic-bezier(.2,.9,.3,1.25)',
          fill: 'backwards',
        })
        .finished.catch(() => {}),
    ),
  );
}

/* 5 — the flag glows softly behind frosted glass, the page changes under the blur, then the glass clears */
async function frost({ to, native, swap }: TransitionCtx) {
  const L = layer();
  const glow = box(L, { inset: '-60px', background: FLAG_CSS[to], filter: 'blur(26px) saturate(1.25)', opacity: '0' });
  const glass = box(L, { inset: '0', background: 'rgb(var(--bg) / 0.3)', opacity: '0', display: 'grid', placeItems: 'center' });
  glass.style.setProperty('backdrop-filter', 'blur(18px)');
  glass.style.setProperty('-webkit-backdrop-filter', 'blur(18px)');
  const label = document.createElement('div');
  label.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px';
  const badge = document.createElement('div');
  badge.style.cssText = `width:84px;height:56px;border-radius:10px;background:${FLAG_CSS[to]};background-size:cover;box-shadow:0 12px 40px rgba(0,0,0,.4),0 0 0 2px rgba(255,255,255,.6)`;
  const name = document.createElement('span');
  name.textContent = native;
  name.style.cssText = 'font-size:clamp(1.6rem,5vw,2.6rem);font-weight:800;letter-spacing:-.03em;color:#fff;text-shadow:0 4px 30px rgba(0,0,0,.45)';
  label.append(badge, name);
  glass.appendChild(label);
  await Promise.all([
    play(glow, [{ opacity: 0 }, { opacity: 0.85 }], { duration: 480, easing: 'ease-in-out' }),
    play(glass, [{ opacity: 0 }, { opacity: 1 }], { duration: 480, easing: 'ease-in-out' }),
    play(label, [{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 480, easing: EASE }),
  ]);
  await swap();
  await wait(250);
  await Promise.all([
    play(glow, [{ opacity: 0.85 }, { opacity: 0 }], { duration: 600, easing: 'ease-in-out' }),
    play(glass, [{ opacity: 1 }, { opacity: 0 }], { duration: 600, easing: 'ease-in-out' }),
  ]);
  L.remove();
}

export const TRANSITIONS: Record<TransitionName, (c: TransitionCtx) => Promise<void>> = { ribbons, flap, frost };

let last: TransitionName | null = null;

/** A random style, never the same as the previous switch. */
export function pickTransition(): TransitionName {
  // Preview a single style: run localStorage.setItem('lang-fx', 'ribbons') in the browser console (removeItem to go back to random).
  try {
    const forced = localStorage.getItem('lang-fx') as TransitionName | null;
    if (forced && forced in TRANSITIONS) return (last = forced);
  } catch {}
  const pool = (Object.keys(TRANSITIONS) as TransitionName[]).filter((n) => n !== last);
  last = pool[Math.floor(Math.random() * pool.length)]!;
  return last;
}
