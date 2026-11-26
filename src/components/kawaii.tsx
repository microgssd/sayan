// Tiny animated characters for the hero sentence pills. Pure SVG, no image files.
// Each draws in a 64×30 box; animations live in globals.css (kw-*) and pause for reduced motion.

export const KAWAII = ['rocket', 'bag', 'robot', 'bolt', 'laptop', 'phone', 'chart', 'globe'] as const;
export type KawaiiName = (typeof KAWAII)[number];
export const KAWAII_LABEL: Record<KawaiiName, string> = {
  rocket: 'Rocket', bag: 'Shopping bag', robot: 'Robot', bolt: 'Lightning bolt',
  laptop: 'Laptop', phone: 'Phone', chart: 'Growing chart', globe: 'Globe',
};
export const isKawaii = (v: unknown): v is KawaiiName => typeof v === 'string' && (KAWAII as readonly string[]).includes(v);

const Eyes = ({ x, y, gap = 4, fill = '#0B0B14' }: { x: number; y: number; gap?: number; fill?: string }) => (
  <g className="kw-o kw-blink">
    <circle cx={x} cy={y} r="1.4" fill={fill} />
    <circle cx={x + gap} cy={y} r="1.4" fill={fill} />
  </g>
);
const Smile = ({ x, y, w = 4 }: { x: number; y: number; w?: number }) => (
  <path d={`M${x} ${y} q${w / 2} ${w * 0.4} ${w} 0`} stroke="#0B0B14" strokeWidth="0.9" fill="none" strokeLinecap="round" />
);
const Cheeks = ({ x1, x2, y }: { x1: number; x2: number; y: number }) => (
  <>
    <circle cx={x1} cy={y} r="1.3" fill="#FDA4AF" opacity="0.9" />
    <circle cx={x2} cy={y} r="1.3" fill="#FDA4AF" opacity="0.9" />
  </>
);

const ART: Record<KawaiiName, JSX.Element> = {
  rocket: (
    <>
      <g className="kw-drift">
        {[6, 20, 34, 48, 62, 76, 90, 104, 118].map((x, i) => (
          <circle key={x} cx={x} cy={[7, 22, 12, 25, 6, 18, 9, 23, 14][i]} r={i % 3 ? 0.8 : 1.2} fill="#E9D5FF" opacity="0.7" />
        ))}
      </g>
      <g className="kw-bob">
        <path className="kw-o kw-flick" d="M17 15 l-6 -3 l1 3 l-1 3 z" fill="#FBBF24" />
        <path d="M18 9 h18 q10 6 0 12 h-18 z" fill="#F1F5F9" />
        <path d="M18 9 l-3 -3 h5 z M18 21 l-3 3 h5 z" fill="#C084FC" />
        <circle cx="34" cy="15" r="3" fill="#C084FC" />
        <Eyes x={24} y={14} />
        <Smile x={25} y={17.5} />
      </g>
    </>
  ),
  bag: (
    <g className="kw-o kw-bob">
      <path d="M26 9 q6 -7 12 0" stroke="#F1F5F9" strokeWidth="2" fill="none" />
      <rect x="22" y="9" width="20" height="16" rx="3" fill="#F472B6" />
      <Eyes x={28} y={15} gap={6} />
      <Smile x={29} y={19} w={6} />
      <Cheeks x1={26} x2={38} y={19} />
    </g>
  ),
  robot: (
    <g className="kw-o kw-tilt">
      <line x1="32" y1="5" x2="32" y2="9" stroke="#F1F5F9" strokeWidth="1.4" />
      <circle className="kw-glow" cx="32" cy="4.5" r="1.8" fill="#FBBF24" />
      <rect x="22" y="9" width="20" height="15" rx="4" fill="#E2E8F0" />
      <rect x="25" y="12" width="14" height="7" rx="3" fill="#0B0B14" />
      <Eyes x={29} y={15.5} gap={6} fill="#22D3EE" />
      <rect x="19" y="14" width="3" height="5" rx="1.5" fill="#C084FC" />
      <rect x="42" y="14" width="3" height="5" rx="1.5" fill="#C084FC" />
    </g>
  ),
  bolt: (
    <>
      <path className="kw-glow" d="M46 6 l1 -2 l1 2 l2 1 l-2 1 l-1 2 l-1 -2 l-2 -1 z" fill="#FDE68A" />
      <g className="kw-o kw-bob">
        <path d="M35 3 l-12 14 h8 l-3 10 l13 -15 h-8 z" fill="#FBBF24" stroke="#F59E0B" strokeWidth="0.8" strokeLinejoin="round" />
        <Eyes x={29.5} y={14} gap={4} />
        <Smile x={30} y={16.6} w={3} />
      </g>
    </>
  ),
  laptop: (
    <g className="kw-o kw-bob">
      <rect x="21" y="6" width="22" height="14" rx="2" fill="#E2E8F0" />
      <rect x="23" y="8" width="18" height="10" rx="1" fill="#1E1B4B" />
      <Eyes x={29} y={12} gap={6} fill="#F1F5F9" />
      <path d="M30 14.5 q2 1.6 4 0" stroke="#F1F5F9" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      <rect className="kw-caret" x="36.5" y="15" width="2.5" height="1" fill="#C084FC" />
      <path d="M18 21 h28 l-2 3 h-24 z" fill="#C084FC" />
    </g>
  ),
  phone: (
    <g className="kw-o kw-tilt">
      <rect x="25" y="4" width="14" height="23" rx="3" fill="#F1F5F9" />
      <rect x="27" y="7" width="10" height="16" rx="1.5" fill="#22D3EE" />
      <Eyes x={30} y={13} gap={4} />
      <Smile x={30.5} y={16} w={3} />
      <circle className="kw-ping" cx="38" cy="5" r="2.4" fill="#F472B6" />
    </g>
  ),
  chart: (
    <g>
      <line x1="19" y1="25" x2="45" y2="25" stroke="#C4B5FD" strokeWidth="1.2" strokeLinecap="round" />
      <rect className="kw-grow" style={{ animationDelay: '0s' }} x="21" y="16" width="5" height="9" rx="1.5" fill="#22D3EE" />
      <rect className="kw-grow" style={{ animationDelay: '.15s' }} x="29" y="11" width="5" height="14" rx="1.5" fill="#F472B6" />
      <g className="kw-grow" style={{ animationDelay: '.3s' }}>
        <rect x="37" y="5" width="6" height="20" rx="1.5" fill="#FBBF24" />
        <Eyes x={38.6} y={10} gap={2.8} />
        <Smile x={39} y={12.5} w={2} />
      </g>
    </g>
  ),
  globe: (
    <g className="kw-o kw-bob">
      <circle cx="32" cy="15" r="10" fill="#38BDF8" />
      <g className="kw-spin-x">
        <path d="M27 9 q3 3 0 6 q-2 3 2 5 M37 8 q-2 4 2 6 q3 2 1 6" stroke="#4ADE80" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      </g>
      <ellipse cx="32" cy="15" rx="15" ry="3.5" fill="none" stroke="#C084FC" strokeWidth="1" transform="rotate(-15 32 15)" />
      <Eyes x={29} y={14} gap={6} />
      <Smile x={30} y={17.5} w={4} />
    </g>
  ),
};

/** One kawaii character, filling its parent (the pill). */
export function Kawaii({ name, className }: { name: KawaiiName; className?: string }) {
  return (
    <svg viewBox="0 0 64 30" preserveAspectRatio="xMidYMid meet" className={className} aria-hidden>
      {ART[name]}
    </svg>
  );
}
