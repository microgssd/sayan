import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { CURRENCIES } from '../currency';
import { PAYMENT_METHODS } from '../types';

/**
 * A payment is for either a project or one month of a subscription.
 * It's stored in the currency it was received in, plus the exchange rate into the item's own currency
 * AT THE TIME it was recorded (amountInProjectCurrency holds that converted amount for either kind),
 * so "paid / pending" never drifts when FX rates move later.
 */
const PaymentSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription', default: null, index: true },
    period: { type: String, default: null }, // 'YYYY-MM' for subscription payments
    client: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, enum: [...CURRENCIES], required: true },
    fxRate: { type: Number, required: true, default: 1 },
    amountInProjectCurrency: { type: Number, required: true },
    paidAt: { type: Date, required: true, index: true },
    method: { type: String, enum: [...PAYMENT_METHODS], default: 'bank' },
    reference: { type: String, default: '' },
    note: { type: String, default: '' },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null },
    invoiceNumber: { type: String, default: '', index: true },
  },
  { timestamps: true },
);
PaymentSchema.index({ subscription: 1, period: 1 });

export type PaymentDoc = InferSchemaType<typeof PaymentSchema>;
export const Payment: Model<PaymentDoc> =
  (models.Payment as Model<PaymentDoc>) || model<PaymentDoc>('Payment', PaymentSchema);
