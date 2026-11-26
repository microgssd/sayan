import { TRANSLATABLE_FIELDS, type PublicProject, type SiteSettings, type TranslatableField } from './types';

export const DEFAULT_SETTINGS: SiteSettings = {
  name: 'Sayan Dhar',
  headline: 'One developer from architecture to launch, so nothing gets lost in handoffs. Based in Kolkata, working with clients worldwide.',
  heroTitle: 'I build [1] SaaS platforms, [2] marketplaces and [3] ML products that clients pay for.',
  yearsExperience: 0,
  bio: 'I work with founders and teams who need a product built properly the first time. Clear scope, honest timelines, clean code you own, and a client portal where you can see exactly what you have paid and what is left.',
  photoUrl: '',
  location: 'Kolkata, India',
  timezone: 'Asia/Kolkata',
  email: 'hello@example.com',
  availability: 'Taking on new projects',
  resumeUrl: '',
  socials: { github: '', linkedin: '', x: '', website: '' },
  translations: {},
  galleryImages: [],
  numbers: {
    heroClients: { value: null, label: '', suffix: '' },
    heroProjects: { value: null, label: '', suffix: '' },
    years: { value: null, label: '', suffix: '+' },
    projects: { value: null, label: '', suffix: '+' },
    clients: { value: null, label: '', suffix: '+' },
  },
  heroPills: ['rocket', 'bag', 'robot'],
  stacks: [
    { category: 'Frontend', items: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'Framer Motion'] },
    { category: 'Backend', items: ['Node.js', 'Express', 'NestJS', 'GraphQL', 'REST APIs'] },
    { category: 'Databases', items: ['MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Prisma'] },
    { category: 'Cloud & DevOps', items: ['AWS', 'Vercel', 'Netlify', 'Docker', 'GitHub Actions'] },
    { category: 'Web3', items: ['Solidity', 'Ethers.js', 'Wagmi', 'Hardhat', 'IPFS'] },
    { category: 'Machine & deep learning', items: ['Python', 'PyTorch', 'TensorFlow', 'scikit-learn', 'XGBoost'] },
    { category: 'Mobile', items: ['React Native', 'Expo', 'Flutter'] },
  ],
};

/** Ready-made translations of the default texts above. Used only while your English text is still the default. */
export const DEFAULT_TRANSLATIONS: Record<'fr' | 'de' | 'es', Record<TranslatableField, string>> = {
  fr: {
    heroTitle: 'Je conçois des [1] plateformes SaaS, des [2] marketplaces et des [3] produits ML qui rapportent.',
    headline: 'Un seul développeur de l’architecture au lancement, pour que rien ne se perde entre deux équipes. Basé à Calcutta, je travaille avec des clients du monde entier.',
    bio: 'Je travaille avec des fondateurs et des équipes qui veulent un produit bien construit dès le départ. Un périmètre clair, des délais honnêtes, un code propre qui vous appartient, et un espace client où vous voyez exactement ce que vous avez payé et ce qu’il reste.',
    availability: 'Disponible pour de nouveaux projets',
    location: 'Calcutta, Inde',
  },
  de: {
    heroTitle: 'Ich baue [1] SaaS-Plattformen, [2] Marktplätze und [3] ML-Produkte, für die Kunden gern bezahlen.',
    headline: 'Ein Entwickler von der Architektur bis zum Launch, damit bei Übergaben nichts verloren geht. Mit Sitz in Kolkata, für Kunden weltweit.',
    bio: 'Ich arbeite mit Gründern und Teams, die ihr Produkt gleich beim ersten Mal richtig gebaut haben wollen. Klarer Umfang, ehrliche Zeitpläne, sauberer Code, der Ihnen gehört, und ein Kundenportal, in dem Sie genau sehen, was bezahlt ist und was noch offen ist.',
    availability: 'Offen für neue Projekte',
    location: 'Kolkata, Indien',
  },
  es: {
    heroTitle: 'Creo [1] plataformas SaaS, [2] marketplaces y [3] productos de ML por los que los clientes pagan.',
    headline: 'Un solo desarrollador de la arquitectura al lanzamiento, para que nada se pierda en los traspasos. Con base en Calcuta, trabajo con clientes de todo el mundo.',
    bio: 'Trabajo con fundadores y equipos que necesitan un producto bien hecho desde el principio. Alcance claro, plazos honestos, código limpio que es suyo y un portal de clientes donde ve exactamente lo que ha pagado y lo que queda.',
    availability: 'Disponible para nuevos proyectos',
    location: 'Calcuta, India',
  },
};

const DEFAULT_CATEGORY_NAMES: Record<string, Record<'fr' | 'de' | 'es', string>> = {
  Frontend: { fr: 'Frontend', de: 'Frontend', es: 'Frontend' },
  Backend: { fr: 'Backend', de: 'Backend', es: 'Backend' },
  Databases: { fr: 'Bases de données', de: 'Datenbanken', es: 'Bases de datos' },
  'Cloud & DevOps': { fr: 'Cloud et DevOps', de: 'Cloud & DevOps', es: 'Nube y DevOps' },
  Web3: { fr: 'Web3', de: 'Web3', es: 'Web3' },
  'Machine & deep learning': { fr: 'Machine et deep learning', de: 'Machine & Deep Learning', es: 'Machine y deep learning' },
  Mobile: { fr: 'Mobile', de: 'Mobile', es: 'Móvil' },
};

/** Settings as a visitor in `lang` should see them: your translation, else the ready-made one for default text, else English. */
export function localizeSettings(s: SiteSettings, lang: 'en' | 'fr' | 'de' | 'es'): SiteSettings {
  if (lang === 'en') return s;
  const mine = s.translations?.[lang] ?? {};
  const out = { ...s };
  for (const f of TRANSLATABLE_FIELDS) {
    const own = mine[f]?.trim();
    out[f] = own || (s[f] === DEFAULT_SETTINGS[f] ? DEFAULT_TRANSLATIONS[lang][f] : s[f]);
  }
  out.numbers = Object.fromEntries(
    Object.entries(s.numbers).map(([k, v]) => [k, { ...v, label: v.label ? mine[`stat:${k}`]?.trim() || v.label : '' }]),
  ) as SiteSettings['numbers'];
  out.stacks = s.stacks.map((g) => ({ ...g, category: mine[`cat:${g.category}`]?.trim() || DEFAULT_CATEGORY_NAMES[g.category]?.[lang] || g.category }));
  return out;
}

/** A project as a visitor in `lang` should see it (falls back to English per field). */
export function localizeProject<T extends PublicProject>(p: T, lang: 'en' | 'fr' | 'de' | 'es'): T {
  if (lang === 'en') return p;
  const tr = p.translations?.[lang] ?? {};
  return {
    ...p,
    summary: tr.summary?.trim() || p.summary,
    outcome: tr.outcome?.trim() || p.outcome,
    testimonial: { ...p.testimonial, quote: tr.quote?.trim() || p.testimonial.quote, role: tr.role?.trim() || p.testimonial.role },
  };
}
