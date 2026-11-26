import { connectDB } from '@/lib/db';
import { WebhookLog } from '@/lib/models/WebhookLog';
import { runDailyJob } from '@/lib/waas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** Vercel Cron calls this once a day with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  const out = await runDailyJob();
  await connectDB();
  const day = new Date().toISOString().slice(0, 10);
  await WebhookLog.updateOne(
    { dedupeKey: `cron:${day}` },
    { dedupeKey: `cron:${day}`, type: 'daily job', ok: out.errors.length === 0, error: out.errors.slice(0, 3).join('; '), summary: `${out.checked} checked, ${out.suspended} suspended, ${out.retries} retries, ${out.reminders} reminders`, createdAt: new Date() },
    { upsert: true },
  );
  return Response.json(out);
}
