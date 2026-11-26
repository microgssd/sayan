import { connectDB } from './db';
import { ClientEvent } from './models/ClientEvent';
import type { ClientEventRow } from './types';

const row = (e: any): ClientEventRow => ({
  id: String(e._id),
  type: e.type,
  severity: e.severity ?? 'info',
  data: e.data ?? {},
  title: e.title ?? '',
  body: e.body ?? '',
  translations: e.translations ?? {},
  by: e.by ?? 'system',
  read: !!e.readAt,
  createdAt: new Date(e.createdAt).toISOString(),
});

/** A client's feed, newest first. */
export async function loadClientEvents(clientId: string, limit = 40): Promise<ClientEventRow[]> {
  await connectDB();
  const docs = await ClientEvent.find({ client: clientId }).sort({ createdAt: -1 }).limit(limit).lean();
  return docs.map(row);
}
