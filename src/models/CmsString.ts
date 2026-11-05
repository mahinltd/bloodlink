import { model, Schema } from 'mongoose';

const cmsStringSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    bn: { type: String, required: true },
    en: { type: String, required: true },
    screen: { type: String, required: true },
    status: { type: String, enum: ['draft', 'in_review', 'published'], required: true },
    translatorNote: String,
    origin: { type: String, enum: ['design', 'en_written', 'bn_written', 'new_text'] },
    needsReview: { type: Boolean, default: false },
    latinAllowed: { type: Boolean, default: false },
    version: { type: Number, required: true, default: 1 },
    updatedBy: String,
  },
  { timestamps: true },
);

export const CmsString = model('CmsString', cmsStringSchema);
