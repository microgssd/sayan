import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { CURRENCIES } from '../currency';

/**
 * An invoice is stored as a small text/data record (~1 KB). The PDF is generated on demand
 * when you download or send it, so nothing large is ever saved. Figures are a snapshot taken
 * when the payment was recorded, so a sent invoice never changes.
 */
const InvoiceSchema = new Schema(
  {
    number: { type: String, required: true, unique: true }, // INV-2026-0001
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', required: true, index: true },
    client: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    clientName: { type: String, default: '' },
    clientCompany: { type: String, default: '' },
    clientEmail: { type: String, default: '' },
    kind: { type: String, enum: ['project', 'subscription'], required: true },
    itemName: { type: String, required: true },
    period: { type: String, default: '' },
    currency: { type: String, enum: [...CURRENCIES], required: true },
    totalCost: { type: Number, required: true }, // project total, or the monthly fee
    amountPaid: { type: Number, required: true }, // this payment, in the item's currency
    paidToDate: { type: Number, required: true },
    pending: { type: Number, required: true },
    receivedAmount: { type: Number, required: true }, // as received, if a different currency
    receivedCurrency: { type: String, enum: [...CURRENCIES], required: true },
    fxRate: { type: Number, default: 1 },
    paymentDate: { type: Date, required: true },
    method: { type: String, default: '' },
    reference: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'sent', 'void'], default: 'draft', index: true },
    sentAt: { type: Date, default: null },
    sentTo: { type: String, default: '' },
  },
  { timestamps: true },
);

export type InvoiceDoc = InferSchemaType<typeof InvoiceSchema>;
export const Invoice: Model<InvoiceDoc> = (models.Invoice as Model<InvoiceDoc>) || model<InvoiceDoc>('Invoice', InvoiceSchema);

/** Atomic counters, so two invoices can never get the same number. */
const CounterSchema = new Schema({ _id: { type: String, required: true }, seq: { type: Number, default: 0 } });
export const Counter: Model<{ _id: string; seq: number }> =
  (models.Counter as Model<{ _id: string; seq: number }>) || model<{ _id: string; seq: number }>('Counter', CounterSchema);
