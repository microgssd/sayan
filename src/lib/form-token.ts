import 'server-only';
import crypto from 'node:crypto';

// A signed timestamp issued with each page. A submission must carry a valid one, at least a few seconds old,
// so scripts can't post directly or fill the form instantly. Bots can't forge it without AUTH_SECRET.
const key = () => process.env.AUTH_SECRET || 'dev-only-secret';
const sign = (ts: string) => crypto.createHmac('sha256', key()).update(`contact:${ts}`).digest('base64url').slice(0, 32);

export const createFormToken = () => {
  const ts = String(Date.now());
  return `${ts}.${sign(ts)}`;
};

export type TokenCheck = 'ok' | 'invalid' | 'too-fast' | 'expired';
export function checkFormToken(token: unknown, minMs = 3000, maxMs = 24 * 3600_000): TokenCheck {
  if (typeof token !== 'string' || !token.includes('.')) return 'invalid';
  const [ts, sig] = token.split('.');
  if (!ts || !sig || sig.length !== 32) return 'invalid';
  const expected = sign(ts);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return 'invalid';
  const age = Date.now() - Number(ts);
  if (!Number.isFinite(age) || age < 0) return 'invalid';
  if (age < minMs) return 'too-fast';
  if (age > maxMs) return 'expired';
  return 'ok';
}
