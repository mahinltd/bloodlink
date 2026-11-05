import { model, Schema } from 'mongoose';

const localizedSchema = new Schema({ bn: String, en: String }, { _id: false });
const appReleaseSchema = new Schema(
  {
    versionCode: { type: Number, unique: true, required: true },
    versionName: { type: String, required: true },
    channel: { type: String, enum: ['stable', 'beta'], required: true },
    status: { type: String, enum: ['draft', 'verified', 'published', 'revoked'], required: true },
    apkUrl: { type: String, required: true },
    apkSha256: String,
    apkSizeBytes: Number,
    signerCertSha256: String,
    mandatory: Boolean,
    minSupportedVersionCode: Number,
    rolloutPercent: { type: Number, min: 0, max: 100 },
    notes: localizedSchema,
    publishedBy: String,
    publishedAt: Date,
    downloads: { type: Number, default: 0 },
    installs: { type: Number, default: 0 },
    failures: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const AppRelease = model('AppRelease', appReleaseSchema);
