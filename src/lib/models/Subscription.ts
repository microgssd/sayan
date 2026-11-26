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

    // ---- Website as a service ----
    plan: { type: Schema.Types.ObjectId, ref: 'Plan', default: null },
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null }, // the website this pays for
    waas: { type: Boolean, default: false, index: true }, // enforce grace and suspension for this client's site
    siteUrl: { type: String, default: '' },
    siteKey: { type: String, default: '', index: true }, // read by the client site's guard
    payKey: { type: String, default: '', index: true }, // public pay-to-restore link
    graceDays: { type: Number, default: 7, min: 0, max: 60 },
    graceUntil: { type: Date, default: null }, // you can extend grace beyond the normal period
    siteOverride: { type: String, enum: ['none', 'suspend'], default: 'none' },
    siteStatus: { type: String, enum: ['active', 'grace', 'suspended'], default: 'active' }, // last state we acted on
    siteStatusAt: { type: Date, default: null },
    reminders: { type: [String], default: [] }, // '2026-11:late3', so each reminder goes out once
    autopay: {
      status: { type: String, enum: ['none', 'pending', 'active', 'paused', 'cancelled', 'failed'], default: 'none' },
      attempt: { type: Number, default: 0 },
      cfId: { type: String, default: '', index: true }, // subscription_id we gave Cashfree
      cfRef: { type: String, default: '' },
      replaces: { type: String, default: '' }, // an older mandate to cancel once this one is active
      method: { type: String, default: '' }, // upi, card, enach
      methodNote: { type: String, default: '' }, // e.g. VISA •••• 4242
      nextChargeAt: { type: Date, default: null },
      activatedAt: { type: Date, default: null },
      lastFailureAt: { type: Date, default: null },
      lastFailure: { type: String, default: '' },
      lastChargeId: { type: String, default: '' }, // for retries
      retryCount: { type: Number, default: 0 },
      lastRetryAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

export type SubscriptionDoc = InferSchemaType<typeof SubscriptionSchema>;
export const Subscription: Model<SubscriptionDoc> =
  (models.Subscription as Model<SubscriptionDoc>) || model<SubscriptionDoc>('Subscription', SubscriptionSchema);
