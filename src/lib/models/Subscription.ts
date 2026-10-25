import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { CURRENCIES } from '../currency';

/** A recurring monthly service, e.g. social media management. Each calendar month is one billing period. */
const SubscriptionSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, enum: [...CURRENCIES], default: 'USD' },
    startMonth: { type: String, required: true }, // 'YYYY-MM'
    endMonth: { type: String, default: null }, // last billed month once ended
    dueDay: { type: Number, default: 5, min: 1, max: 28 },
    status: { type: String, enum: ['active', 'ended'], default: 'active', index: true },
    // Price changes apply from a given month onward, so months already billed keep their original price.
    translations: { type: Schema.Types.Mixed, default: {} }, // { fr: { description }, … }
    trSource: { type: Schema.Types.Mixed, default: {} },
    priceHistory: { type: [{ _id: false, from: String, amount: Number }], default: [] },
  },
  { timestamps: true },
);

export type SubscriptionDoc = InferSchemaType<typeof SubscriptionSchema>;
export const Subscription: Model<SubscriptionDoc> =
  (models.Subscription as Model<SubscriptionDoc>) || model<SubscriptionDoc>('Subscription', SubscriptionSchema);
