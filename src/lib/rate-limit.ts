// In-memory sliding-window limiter. Per server instance; swap for Upstash/Redis when you scale out.
const buckets = new Map<string, number[]>();

export function allow(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  const ok = hits.length < max;
  if (ok) hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) buckets.clear();
  return ok;
}

export const clientIp = (h: Headers) => (h.get('x-forwarded-for') ?? '').split(',')[0]!.trim() || h.get('x-real-ip') || 'local';
