import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

/** One entry in a client's "Updates" feed. System events store a type plus data and are worded at display time, in the viewer's language. */
const ClientEventSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    severity: { type: String, enum: ['info', 'success', 'warning', 'danger'], default: 'info' },
    data: { type: Schema.Types.Mixed, default: {} }, // { name, amount, currency, period, plan, site, date, reason }
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription', default: null },
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    // Notes you write yourself (type "note"): English text plus automatic translations.
    title: { type: String, default: '' },
    body: { type: String, default: '' },
    translations: { type: Schema.Types.Mixed, default: {} }, // { fr: { title, body }, … }
    by: { type: String, enum: ['system', 'admin'], default: 'system' },
    readAt: { type: Date, default: null },
    emailedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
ClientEventSchema.index({ client: 1, createdAt: -1 });

export type ClientEventDoc = InferSchemaType<typeof ClientEventSchema>;
export const ClientEvent: Model<ClientEventDoc> =
  (models.ClientEvent as Model<ClientEventDoc>) || model<ClientEventDoc>('ClientEvent', ClientEventSchema);
