// Minimal Telegram Bot API client. No 'server-only' import so the local polling script can use it too.

export const telegramReady = () => Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_OWNER_CHAT_ID);

/** Escape text for Telegram's HTML parse mode. */
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function tg<T = any>(method: string, body: Record<string, unknown> = {}): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  const base = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org'; // override only for local testing
  const res = await fetch(`${base}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description ?? 'request failed'}`);
  return data.result as T;
}
