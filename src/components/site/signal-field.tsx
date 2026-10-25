'use client';

import { useEffect, useRef } from 'react';

/**
 * A grid of points that ripples away from the cursor and lights up in the accent
 * colour, with a slow ambient wave. Pauses off-screen and on hidden tabs.
 */
export function SignalField({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const GAP = 30;
    const RADIUS = 180;
    let w = 0;
    let h = 0;
    let raf = 0;
    let running = false;
    let points: { x: number; y: number }[] = [];
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
    let dot = [100, 116, 139];
    let accent = [20, 184, 166];

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const parse = (name: string) => cs.getPropertyValue(name).trim().split(/\s+/).map(Number);
      dot = parse('--subtle');
      accent = parse('--accent');
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      points = [];
      for (let y = GAP / 2; y < h; y += GAP) for (let x = GAP / 2; x < w; x += GAP) points.push({ x, y });
      if (!running) draw(performance.now());
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      pointer.x += (pointer.tx - pointer.x) * 0.12;
      pointer.y += (pointer.ty - pointer.y) * 0.12;
      for (const p of points) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d = Math.hypot(dx, dy) || 1;
        const k = d < RADIUS ? 1 - d / RADIUS : 0;
        const wave = reduced ? 0.5 : (Math.sin(t * 0.0011 + p.x * 0.011 + p.y * 0.007) + 1) / 2;
        const push = k * k * 16;
        const r = Math.round(dot[0]! + (accent[0]! - dot[0]!) * k);
        const g = Math.round(dot[1]! + (accent[1]! - dot[1]!) * k);
        const b = Math.round(dot[2]! + (accent[2]! - dot[2]!) * k);
        ctx.fillStyle = `rgba(${r},${g},${b},${0.16 + wave * 0.16 + k * 0.7})`;
        ctx.beginPath();
        ctx.arc(p.x + (dx / d) * push, p.y + (dy / d) * push, 1 + k * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      if (running) raf = requestAnimationFrame(draw);
    };

    const start = () => {
      if (running || reduced || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(draw);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.tx = e.clientX - rect.left;
      pointer.ty = e.clientY - rect.top;
      // First contact (or a jump): snap instead of easing in from off-screen.
      if (Math.abs(pointer.x - pointer.tx) > 600) {
        pointer.x = pointer.tx;
        pointer.y = pointer.ty;
      }
      if (reduced) {
        pointer.x = pointer.tx;
        pointer.y = pointer.ty;
        draw(0);
      }
    };
    const onLeave = () => {
      pointer.tx = -9999;
      pointer.ty = -9999;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    readColors();
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => (entry?.isIntersecting ? start() : stop()));
    io.observe(canvas);
    const mo = new MutationObserver(() => {
      readColors();
      if (!running) draw(0);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}
