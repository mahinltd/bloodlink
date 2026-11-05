import { model, Schema } from 'mongoose';

const cmsReleaseSchema = new Schema(
  {
    label: { type: String, required: true, unique: true },
    stringCount: { type: Number, required: true },
    publishedBy: String,
    publishedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const CmsRelease = model('CmsRelease', cmsReleaseSchema);
