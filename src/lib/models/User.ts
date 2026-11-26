import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { CURRENCIES } from '../currency';

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'client'], default: 'client', index: true },
    company: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    language: { type: String, enum: ['en', 'fr', 'de', 'es'], default: 'en' }, // for emails
    preferredCurrency: { type: String, enum: [...CURRENCIES], default: 'USD' },
    active: { type: Boolean, default: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof UserSchema>;
export const User: Model<UserDoc> = (models.User as Model<UserDoc>) || model<UserDoc>('User', UserSchema);
