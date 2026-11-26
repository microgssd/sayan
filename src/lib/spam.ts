// Content heuristics for the contact form. Suspicious messages go to the Spam folder rather than being
// thrown away, so a real client caught by mistake is never lost.
const DISPOSABLE = [
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org',
  'yopmail.com', 'trashmail.com', 'getnada.com', 'dispostable.com', 'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com', 'mintemail.com',
  'mohmal.com', 'emailondeck.com', 'tempail.com', 'moakt.com', 'burnermail.io',
];
const PHRASES = [
  'backlink', 'seo service', 'rank your website', 'first page of google', 'guest post', 'casino', 'betting tips', 'viagra', 'cialis',
  'crypto investment', 'forex signal', 'loan offer', 'web traffic', 'buy followers', 'increase your sales by', 'whatsapp me on',
  'outsourcing company', 'we are a team of', 'dear website owner', 'dear sir/madam',
];
const URL_RE = /(https?:\/\/|www\.)\S+/gi;

export type SpamVerdict = { reject?: 'links' | 'email'; spam: boolean; reasons: string[] };

export function assessContact(d: { name: string; email: string; company: string; details: string }): SpamVerdict {
  const reasons: string[] = [];
  const links = d.details.match(URL_RE)?.length ?? 0;
  if (links > 2) return { reject: 'links', spam: true, reasons: ['too many links'] };
  const domain = d.email.split('@')[1]?.toLowerCase() ?? '';
  if (DISPOSABLE.some((x) => domain === x || domain.endsWith(`.${x}`))) return { reject: 'email', spam: true, reasons: ['disposable email'] };
  if (URL_RE.test(d.name) || URL_RE.test(d.company)) reasons.push('link in name or company');
  URL_RE.lastIndex = 0;
  if (/\d{5,}/.test(d.name)) reasons.push('numbers in name');
  const text = `${d.company} ${d.details}`.toLowerCase();
  const hits = PHRASES.filter((p) => text.includes(p));
  if (hits.length) reasons.push(`spam phrases: ${hits.slice(0, 3).join(', ')}`);
  if (links > 0 && d.details.length < 60) reasons.push('short message with a link');
  return { spam: reasons.length > 0, reasons };
}

/** Optional Cloudflare Turnstile check; skipped unless TURNSTILE_SECRET_KEY is set. */
export async function verifyTurnstile(token: string | undefined, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      cache: 'no-store',
    });
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch {
    return true; // Cloudflare unreachable: don't block real people; the other layers still apply
  }
}
