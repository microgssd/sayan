import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { CURRENCIES } from '../currency';
import { PROJECT_STATUSES } from '../types';

const ProjectSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    name: { type: String, required: true, trim: true },
    summary: { type: String, default: '' },
    stack: { type: [String], default: [] },
    liveUrl: { type: String, default: '' },
    previewUrl: { type: String, default: '' },
    repoUrl: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    gallery: { type: [String], default: [] },
    outcome: { type: String, default: '' },
    testimonial: {
      quote: { type: String, default: '' },
      author: { type: String, default: '' },
      role: { type: String, default: '' },
    },
    status: { type: String, enum: [...PROJECT_STATUSES], default: 'in-progress' },
    totalCost: { type: Number, default: 0, min: 0 },
    currency: { type: String, enum: [...CURRENCIES], default: 'USD' },
    startDate: { type: Date, default: Date.now },
    deliveredAt: { type: Date, default: null },
    showInPortfolio: { type: Boolean, default: false, index: true },
    sortOrder: { type: Number, default: 0 },
    translations: { type: Schema.Types.Mixed, default: {} }, // { fr: { summary, outcome, quote, role }, de: …, es: … }
    trSource: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export type ProjectDoc = InferSchemaType<typeof ProjectSchema>;
export const Project: Model<ProjectDoc> =
  (models.Project as Model<ProjectDoc>) || model<ProjectDoc>('Project', ProjectSchema);
