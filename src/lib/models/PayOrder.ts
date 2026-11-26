import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

/** A one-off online payment (a "Pay now" for overdue months). Settled when Cashfree confirms it. */
const PayOrderSchema = new Schema(
  {
    orderId: { type: String, required: true, unique: true },
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true, index: true },
    client: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    currency: { type: String, required: true },
    amount: { type: Number, required: true },
    periods: { type: [{ _id: false, period: String, amount: Number }], default: [] },
    status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created', index: true },
    cfPaymentId: { type: String, default: '' },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type PayOrderDoc = InferSchemaType<typeof PayOrderSchema>;
export const PayOrder: Model<PayOrderDoc> = (models.PayOrder as Model<PayOrderDoc>) || model<PayOrderDoc>('PayOrder', PayOrderSchema);
