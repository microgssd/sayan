import { connectDB } from '@/lib/db';
import { parseWebhook, verifyWebhook, type GatewayEvent } from '@/lib/cashfree';
import { WebhookLog } from '@/lib/models/WebhookLog';
import { applyMandateStatus, onChargeFailed, onChargeSucceeded, settleOrder } from '@/lib/waas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function handle(ev: GatewayEvent): Promise<string> {
  switch (ev.kind) {
    case 'mandate_status':
      return (await applyMandateStatus(ev.subscriptionId, ev.status, { cfRef: ev.cfSubscriptionId })) ? `autopay ${ev.status}` : 'ignored: not one of our current mandates';
    case 'charge_success':
      return onChargeSucceeded(ev);
    case 'charge_failed':
      return onChargeFailed(ev);
    case 'order_paid':
      return (await settleOrder(ev.orderId, ev.cfPaymentId, ev.amount)) ? 'order settled' : 'order already settled or unknown';
    case 'order_failed':
      return 'a payment attempt failed (the client can try again)';
    default:
      return 'ignored';
  }
}

/**
 * Cashfree reports every payment and mandate change here. Each notification is signature-checked,
 * processed once (retries are recognised), and logged so you can see it in Admin → Plans & autopay.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get('x-webhook-signature'), req.headers.get('x-webhook-timestamp'))) {
    return new Response('Invalid signature', { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const ev = parseWebhook(body);
  try {
    await connectDB();
    const now = new Date();
    const prev: any = await WebhookLog.findOneAndUpdate(
      { dedupeKey: ev.dedupe },
      { $setOnInsert: { dedupeKey: ev.dedupe, type: ev.type, ok: false, error: 'processing', summary: '', createdAt: now } },
      { upsert: true, new: false },
    ).lean();
    const stuck = prev && prev.error === 'processing' && now.getTime() - new Date(prev.createdAt).getTime() > 5 * 60_000;
    if (prev && (prev.ok || (prev.error === 'processing' && !stuck))) return Response.json({ ok: true, duplicate: true });
    try {
      const summary = await handle(ev);
      await WebhookLog.updateOne({ dedupeKey: ev.dedupe }, { ok: true, error: '', summary, type: ev.type });
      return Response.json({ ok: true });
    } catch (err) {
      const message = (err as Error).message.slice(0, 300);
      await WebhookLog.updateOne({ dedupeKey: ev.dedupe }, { ok: false, error: message, type: ev.type });
      console.error('[cashfree webhook]', ev.type, message);
      return Response.json({ ok: false }, { status: 500 }); // Cashfree will try again
    }
  } catch (err) {
    console.error('[cashfree webhook] database error', (err as Error).message);
    return Response.json({ ok: false }, { status: 500 });
  }
}
