import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

/** A website-as-a-service plan. Prices are set per currency, so a Canadian client pays in CAD and a UK client in GBP. */
const PlanSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    features: { type: [String], default: [] },
    prices: { type: Schema.Types.Mixed, default: {} }, // { INR: 2999, CAD: 49, USD: 39, GBP: 31 } per month
    graceDays: { type: Number, default: 7, min: 0, max: 60 },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    translations: { type: Schema.Types.Mixed, default: {} }, // { fr: { description, features }, … }
    trSource: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export type PlanDoc = InferSchemaType<typeof PlanSchema>;
export const Plan: Model<PlanDoc> = (models.Plan as Model<PlanDoc>) || model<PlanDoc>('Plan', PlanSchema);
