import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const MessageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    company: { type: String, default: '' },
    projectTypes: { type: [String], default: [] },
    budget: { type: String, default: '' },
    details: { type: String, default: '' },
    status: { type: String, enum: ['new', 'read', 'archived', 'spam'], default: 'new', index: true },
    spamReasons: { type: [String], default: [] },
    ipHash: { type: String, default: '', index: true }, // hashed, never the raw IP
    city: { type: String, default: '' },
    country: { type: String, default: '' },
  },
  { timestamps: true },
);
MessageSchema.index({ email: 1, createdAt: -1 });

export type MessageDoc = InferSchemaType<typeof MessageSchema>;
export const Message: Model<MessageDoc> = (models.Message as Model<MessageDoc>) || model<MessageDoc>('Message', MessageSchema);
