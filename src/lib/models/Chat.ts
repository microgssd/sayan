import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const ChatSessionSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true }, // the visitor keeps the raw token; only its hash is stored
    code: { type: String, required: true, index: true }, // short id shown in Telegram, e.g. #4F2A
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    city: { type: String, default: '' },
    country: { type: String, default: '' },
    page: { type: String, default: '' },
    status: { type: String, enum: ['open', 'closed', 'blocked'], default: 'open', index: true },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastVisitorAt: { type: Date, default: null },
    lastOwnerAt: { type: Date, default: null },
    ownerReadAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: null }, // last time the visitor's widget checked in
  },
  { timestamps: true },
);

const ChatMessageSchema = new Schema(
  {
    session: { type: Schema.Types.ObjectId, ref: 'ChatSession', required: true, index: true },
    from: { type: String, enum: ['visitor', 'owner', 'system'], required: true },
    text: { type: String, required: true, maxlength: 4000 },
    via: { type: String, enum: ['site', 'telegram', 'dashboard'], default: 'site' },
    tgMessageId: { type: Number, default: undefined }, // the Telegram message this maps to, so replies can be routed back
  },
  { timestamps: true },
);
ChatMessageSchema.index({ tgMessageId: 1 }, { unique: true, sparse: true });
ChatMessageSchema.index({ session: 1, createdAt: 1 });

export type ChatSessionDoc = InferSchemaType<typeof ChatSessionSchema>;
export type ChatMessageDoc = InferSchemaType<typeof ChatMessageSchema>;
export const ChatSession: Model<ChatSessionDoc> =
  (models.ChatSession as Model<ChatSessionDoc>) || model<ChatSessionDoc>('ChatSession', ChatSessionSchema);
export const ChatMessage: Model<ChatMessageDoc> =
  (models.ChatMessage as Model<ChatMessageDoc>) || model<ChatMessageDoc>('ChatMessage', ChatMessageSchema);
