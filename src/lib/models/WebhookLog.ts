import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

/** Every gateway notification we received: used to ignore duplicates and to debug in the admin. Kept 30 days. */
const WebhookLogSchema = new Schema(
  {
    dedupeKey: { type: String, required: true, unique: true },
    type: { type: String, default: '' },
    summary: { type: String, default: '' },
    ok: { type: Boolean, default: true },
    error: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
  },
  { versionKey: false },
);

export type WebhookLogDoc = InferSchemaType<typeof WebhookLogSchema>;
export const WebhookLog: Model<WebhookLogDoc> = (models.WebhookLog as Model<WebhookLogDoc>) || model<WebhookLogDoc>('WebhookLog', WebhookLogSchema);
