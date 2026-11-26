import 'server-only';
import * as icons from 'simple-icons';

export type TechIcon = { name: string; path: string | null; hex: string | null; mono: string };

type SimpleIcon = { slug: string; path: string; hex: string; title: string };
const bySlug = new Map<string, SimpleIcon>();
for (const value of Object.values(icons) as unknown[]) {
  const i = value as SimpleIcon;
  if (i && typeof i === 'object' && 'slug' in i && 'path' in i) bySlug.set(i.slug, i);
}

// Names people type → Simple Icons slug. Anything not listed is tried as a normalised slug.
const ALIASES: Record<string, string> = {
  'next.js': 'nextdotjs', nextjs: 'nextdotjs', next: 'nextdotjs',
  'node.js': 'nodedotjs', nodejs: 'nodedotjs', node: 'nodedotjs',
  'express.js': 'express', expressjs: 'express',
  'tailwind css': 'tailwindcss', tailwind: 'tailwindcss',
  'framer motion': 'framer', 'react native': 'react',
  postgres: 'postgresql', 'ethers.js': 'ethers', ethersjs: 'ethers',
  'web3.js': 'web3dotjs', 'three.js': 'threedotjs', 'socket.io': 'socketdotio',
  'scikit-learn': 'scikitlearn', sklearn: 'scikitlearn',
  'github actions': 'githubactions', gcp: 'googlecloud', 'google cloud': 'googlecloud',
  'rest apis': 'openapiinitiative', 'rest api': 'openapiinitiative', rest: 'openapiinitiative',
  'hugging face': 'huggingface', 'vue.js': 'vuedotjs', vue: 'vuedotjs',
};

const normalise = (s: string) => s.toLowerCase().replace(/\+/g, 'plus').replace(/\./g, 'dot').replace(/[^a-z0-9]/g, '');

const lettermark = (name: string) =>
  name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || name.slice(0, 2).toUpperCase();

/** Resolves stack names to brand icon paths on the server, so the browser only receives the icons in use. */
export function resolveTechIcons(names: string[]): TechIcon[] {
  return names.map((name) => {
    const key = name.trim().toLowerCase();
    const icon = bySlug.get(ALIASES[key] ?? normalise(key));
    return { name, path: icon?.path ?? null, hex: icon ? `#${icon.hex}` : null, mono: name === 'AWS' ? 'aws' : lettermark(name) };
  });
}
