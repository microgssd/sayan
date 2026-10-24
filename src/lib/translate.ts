// Machine translation for text you write in the admin. Runs when you save, results are stored,
// so visitors never wait for it. DeepL is preferred (free tier: 500k characters/month); Claude works too.
export type Target = 'fr' | 'de' | 'es';
export const TARGETS: Target[] = ['fr', 'de', 'es'];
const NAMES: Record<Target, string> = { fr: 'French', de: 'German', es: 'Spanish' };

export function translationProvider(): 'deepl' | 'claude' | null {
  if (process.env.DEEPL_API_KEY) return 'deepl';
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  return null;
}

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unescapeXml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

async function deepl(texts: string[], target: Target) {
  const key = process.env.DEEPL_API_KEY!;
  const base = process.env.DEEPL_API_URL || (key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com');
  // [1] [2] [3] mark where project pills go in the hero sentence; wrap them as tags so they survive untouched.
  const input = texts.map((t) => escapeXml(t).replace(/\[(\d)\]/g, '<x n="$1"/>'));
  const res = await fetch(`${base}/v2/translate`, {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: input, source_lang: 'EN', target_lang: target.toUpperCase(), formality: 'prefer_more', tag_handling: 'xml' }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`DeepL ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const data = (await res.json()) as { translations: { text: string }[] };
  return data.translations.map((t) => unescapeXml(t.text.replace(/<x n="(\d)"\s*\/>/g, '[$1]')));
}

async function claude(texts: string[], target: Target) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
      max_tokens: 4000,
      system:
        `You translate website copy for a freelance developer's portfolio from English into ${NAMES[target]}. ` +
        'Use a natural, professional, formal register (vous / Sie / usted). Keep markers like [1], [2], [3] exactly where they belong in the sentence. ' +
        'Keep brand, product and technology names unchanged. Reply with ONLY a JSON array of strings, the same length and order as the input.',
      messages: [{ role: 'user', content: JSON.stringify(texts) }],
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  const raw = data.content.map((c) => c.text ?? '').join('').replace(/```json|```/g, '').trim();
  const out = JSON.parse(raw) as string[];
  if (!Array.isArray(out) || out.length !== texts.length) throw new Error('Claude returned an unexpected format');
  return out.map(String);
}

/** Translates a batch of English strings into one language. Empty strings stay empty. */
export async function translateTexts(texts: string[], target: Target): Promise<string[]> {
  const provider = translationProvider();
  if (!provider) throw new Error('No translation key configured');
  const idx = texts.map((t, i) => (t.trim() ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return texts.map(() => '');
  const done = await (provider === 'deepl' ? deepl : claude)(idx.map((i) => texts[i]!), target);
  const out = texts.map(() => '');
  idx.forEach((i, k) => (out[i] = done[k] ?? ''));
  return out;
}

/**
 * Brings translations up to date for a set of fields.
 * - A field is (re)translated when its English text differs from the English it was last translated from.
 * - A translation you typed by hand is kept until you change the English again.
 */
export async function syncTranslations<F extends string>(opts: {
  english: Record<F, string>;
  previousSource: Partial<Record<F, string>>;
  current: Partial<Record<Target, Partial<Record<F, string>>>>;
  manual?: Partial<Record<Target, Partial<Record<F, string>>>>;
}) {
  const fields = Object.keys(opts.english) as F[];
  const translations: Partial<Record<Target, Partial<Record<F, string>>>> = {};
  const changed = fields.filter((f) => (opts.english[f] ?? '').trim() !== (opts.previousSource[f] ?? '').trim());
  let error = '';
  for (const l of TARGETS) {
    const merged: Partial<Record<F, string>> = { ...(opts.current[l] ?? {}) };
    // Hand-edited values in this save win.
    for (const f of fields) {
      const m = opts.manual?.[l]?.[f];
      if (m !== undefined && m.trim() !== (opts.current[l]?.[f] ?? '').trim()) merged[f] = m.trim();
    }
    const todo = fields.filter((f) => {
      if (!(opts.english[f] ?? '').trim()) return false;
      const m = opts.manual?.[l]?.[f];
      if (m !== undefined && m.trim() && m.trim() !== (opts.current[l]?.[f] ?? '').trim()) return false; // typed by hand
      return changed.includes(f) || !(merged[f] ?? '').trim(); // English changed, or never translated
    });
    // Clear translations whose English was emptied.
    for (const f of fields) if (!(opts.english[f] ?? '').trim()) delete merged[f];
    if (todo.length && translationProvider()) {
      try {
        const res = await translateTexts(todo.map((f) => opts.english[f] ?? ''), l);
        todo.forEach((f, i) => (merged[f] = res[i] ?? ''));
      } catch (err) {
        error = (err as Error).message;
      }
    } else {
      // No translator: an outdated translation would be wrong, so fall back to English for changed fields.
      todo.filter((f) => changed.includes(f)).forEach((f) => delete merged[f]);
    }
    translations[l] = merged;
  }
  const source = error ? opts.previousSource : (Object.fromEntries(fields.map((f) => [f, opts.english[f] ?? ''])) as Record<F, string>);
  return { translations, source, error };
}
