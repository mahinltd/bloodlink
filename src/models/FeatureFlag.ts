import { model, Schema } from 'mongoose';

const featureFlagSchema = new Schema(
  {
    key: { type: String, required: true },
    titleBn: { type: String, required: true },
    titleEn: { type: String, required: true },
    description: { type: String, required: true },
    environment: { type: String, enum: ['demo', 'staging', 'production'], required: true },
    enabled: { type: Boolean, required: true },
    rolloutPercent: { type: Number, min: 0, max: 100, required: true },
    updatedBy: String,
    lastReason: String,
  },
  { timestamps: true },
);

featureFlagSchema.index({ key: 1, environment: 1 }, { unique: true });
export const FeatureFlag = model('FeatureFlag', featureFlagSchema);
