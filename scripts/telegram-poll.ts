/**
 * Local development only: Telegram can't reach localhost, so this pulls updates from Telegram
 * and processes them exactly like the production webhook does.
 *
 *   npm run telegram:poll
 *
 * Note: it removes the bot's webhook while running. Use a separate test bot locally, or press
 * "Connect webhook" in Admin → Live chat on your live site afterwards.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { tg } from '../src/lib/telegram';
import { handleTelegramUpdate } from '../src/lib/chat-core';

async function main() {
  await tg('deleteWebhook', { drop_pending_updates: false });
  const me = await tg<{ username: string }>('getMe');
  console.log(`Listening for Telegram messages to @${me.username}. Press Ctrl+C to stop.`);
  let offset = 0;
  for (;;) {
    try {
      const updates = await tg<{ update_id: number }[]>('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
      for (const u of updates) {
        offset = u.update_id + 1;
        await handleTelegramUpdate(u).catch((e) => console.error('update failed:', e.message));
      }
    } catch (err) {
      console.error((err as Error).message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

main();
