'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Sizes one line of text to exactly fill its container's width, on every screen size. */
export function FitText({ text, className }: { text: string; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLSpanElement>(null); // hidden copy at 100px, measured instead of the visible text
  const [size, setSize] = useState<number | null>(null);

  useEffect(() => {
    const fit = () => {
      if (!wrap.current || !probe.current) return;
      const textWidth = probe.current.getBoundingClientRect().width;
      if (textWidth > 0) setSize(Math.floor((100 * wrap.current.clientWidth * 0.96) / textWidth));
    };
    fit();
    document.fonts?.ready.then(fit);
    const ro = new ResizeObserver(fit);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [text]);

  return (
    <div ref={wrap} className="relative w-full overflow-x-clip text-center" aria-hidden>
      <span ref={probe} className={cn('pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap', className)} style={{ fontSize: 100 }}>
        {text}
      </span>
      <span
        className={cn('inline-block whitespace-nowrap', className)}
        style={{ fontSize: size ? `${size}px` : `${Math.min(18, 160 / Math.max(text.length, 1))}vw`, visibility: size ? 'visible' : 'hidden' }}
      >
        {text}
      </span>
    </div>
  );
}
