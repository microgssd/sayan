// Generated from waas-guard/middleware.ts: the file you drop into a client's Next.js project.
export const GUARD_MIDDLEWARE = `/**
 * Website-as-a-service guard. Put this file in a client's Next.js project (project root, or \`src/\` if you use it),
 * set the two environment variables below on Vercel, and redeploy.
 *
 *   WAAS_PORTAL_URL   the address of your portal, e.g. https://sayandhar.com
 *   WAAS_SITE_KEY     this website's key: Admin → Subscriptions → "Site guard"
 *
 * While the plan is paid (or in its grace period) the site works normally. If the payment stays overdue past the grace
 * period, every page shows a "temporarily unavailable" notice (HTTP 503, so Google keeps the pages indexed) with a
 * button to pay. As soon as the payment is recorded, the site is back within about a minute.
 *
 * It fails open: if your portal can't be reached, the site stays up. Already have a middleware.ts? Keep your own and
 * call \`waasGuard(req)\` at the top of it: \`const blocked = await waasGuard(req); if (blocked) return blocked;\`
 */
import { NextResponse, type NextRequest } from 'next/server';

type Answer = { status: string; payUrl: string; at: number };
let cached: Answer | null = null; // remembered for a minute per server instance

async function lookup(): Promise<Answer | null> {
  const portal = process.env.WAAS_PORTAL_URL?.replace(/\\/$/, '');
  const key = process.env.WAAS_SITE_KEY;
  if (!portal || !key) return null;
  if (cached && Date.now() - cached.at < 60_000) return cached;
  try {
    const res = await fetch(\`\${portal}/api/waas/status/\${key}\`, { signal: AbortSignal.timeout(1500), cache: 'no-store' });
    if (res.ok) {
      const j = (await res.json()) as { status: string; payUrl: string };
      cached = { status: j.status, payUrl: j.payUrl, at: Date.now() };
      return cached;
    }
  } catch {
    /* portal unreachable: fall through */
  }
  // Keep the last answer for up to 10 minutes; after that, fail open so a portal outage never takes sites down.
  return cached && Date.now() - cached.at < 10 * 60_000 ? cached : null;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const page = (payUrl: string) => \`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Temporarily unavailable</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b14;color:#f1f5f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;text-align:center">
<main style="max-width:440px"><div style="font-size:40px">🔒</div>
<h1 style="font-size:26px;margin:16px 0 10px">This website is temporarily unavailable</h1>
<p style="color:#acafba;line-height:1.6;margin:0 0 26px">The hosting plan for this website has an overdue payment. If you own this website, you can pay securely below and it comes back online within minutes.</p>
<a href="\${esc(payUrl)}" style="display:inline-block;background:#a855f7;color:#0b0b14;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:999px">Pay to restore the website</a>
<p style="color:#6e6c8c;font-size:13px;margin:26px 0 0">Visiting this website? Please check back soon.</p></main></body></html>\`;

/** Returns a 503 response when the site is suspended, otherwise null. */
export async function waasGuard(req: NextRequest): Promise<NextResponse | null> {
  const a = await lookup();
  if (!a || a.status !== 'suspended') return null;
  const headers = { 'retry-after': '3600', 'cache-control': 'no-store' };
  if (req.nextUrl.pathname.startsWith('/api/')) return NextResponse.json({ error: 'This service is temporarily unavailable.' }, { status: 503, headers });
  return new NextResponse(page(a.payUrl), { status: 503, headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } });
}

export async function middleware(req: NextRequest) {
  return (await waasGuard(req)) ?? NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
`;
