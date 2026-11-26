import { connectDB } from '@/lib/db';
import { Subscription } from '@/lib/models/Subscription';
import { payLinkFor, syncSite } from '@/lib/waas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HEADERS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' };

/**
 * What a client's website asks before serving a page: "is my plan paid up?"
 * Answers only `active`, `grace` or `suspended` plus the pay link, nothing about money or the client.
 * The key in the URL is private to that one website.
 */
export async function GET(_req: Request, { params }: { params: { key: string } }) {
  if (!/^[\w-]{20,40}$/.test(params.key)) return Response.json({ status: 'unknown' }, { status: 404, headers: HEADERS });
  await connectDB();
  const sub: any = await Subscription.findOne({ siteKey: params.key }).select('_id payKey waas').lean();
  if (!sub) return Response.json({ status: 'unknown' }, { status: 404, headers: HEADERS });
  const state = sub.waas ? await syncSite(sub._id) : null;
  return Response.json({ status: state?.status ?? 'active', payUrl: payLinkFor(sub.payKey) }, { headers: HEADERS });
}
