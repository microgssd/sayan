import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const SettingsSchema = new Schema(
  {
    key: { type: String, unique: true, default: 'site' },
    name: String,
    headline: String,
    heroTitle: String,
    yearsExperience: Number,
    bio: String,
    photoUrl: String,
    location: String,
    timezone: String,
    email: String,
    availability: String,
    resumeUrl: String,
    socials: { github: String, linkedin: String, x: String, website: String },
    stacks: [{ _id: false, category: String, items: [String] }],
    galleryImages: { type: [String], default: [] }, // extra image links for the moving gallery
    translations: { type: Schema.Types.Mixed, default: {} },
    trSource: { type: Schema.Types.Mixed, default: {} }, // the English each translation was made from // { fr: { heroTitle, headline, bio, availability }, de: …, es: … }
  },
  { timestamps: true },
);

export type SettingsDoc = InferSchemaType<typeof SettingsSchema>;
export const Settings: Model<SettingsDoc> =
  (models.Settings as Model<SettingsDoc>) || model<SettingsDoc>('Settings', SettingsSchema);
