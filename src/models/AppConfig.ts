import { model, Schema } from 'mongoose';

const localizedSchema = new Schema(
  { bn: { type: String, required: true }, en: { type: String, required: true } },
  { _id: false },
);

const appConfigSchema = new Schema(
  {
    version: { type: Number, required: true },
    status: { type: String, enum: ['draft', 'published'], required: true },
    brand: { ruby: String, rose: String, teal: String },
    theme: {
      allowDark: Boolean,
      followSystem: Boolean,
      bnFont: String,
      enFont: String,
      cardRadius: Number,
      controlRadius: Number,
    },
    safety: {
      supportEmail: String,
      donationIntervalDays: Number,
      searchRadiusKm: Number,
      urgentRadiusKm: Number,
      matchMode: { type: String, enum: ['exact', 'compatible'] },
      requestAutoPublish: Boolean,
      moneyKeywords: [String],
      disclaimers: localizedSchema,
    },
    limits: Schema.Types.Mixed,
    contact: { supportEmail: String, supportPhone: String },
    release: Schema.Types.Mixed,
    publishedBy: String,
    publishedAt: Date,
  },
  { timestamps: true, strict: true },
);

appConfigSchema.index({ status: 1, version: -1 });
export const AppConfig = model('AppConfig', appConfigSchema);
