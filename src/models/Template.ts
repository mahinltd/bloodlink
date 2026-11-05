import { model, Schema } from 'mongoose';

const localizedSchema = new Schema(
  { bn: { type: String, required: true }, en: { type: String, required: true } },
  { _id: false },
);
const reportReasonSchema = new Schema(
  {
    key: { type: String, unique: true },
    label: localizedSchema,
    defaultPriority: { type: String, enum: ['high', 'normal', 'low'] },
    active: Boolean,
    order: Number,
  },
  { timestamps: true },
);
const notificationTemplateSchema = new Schema(
  {
    key: { type: String, unique: true },
    title: localizedSchema,
    body: localizedSchema,
    active: Boolean,
  },
  { timestamps: true },
);
const emailTemplateSchema = new Schema(
  { key: { type: String, unique: true }, subject: localizedSchema, html: localizedSchema },
  { timestamps: true },
);

export const ReportReason = model('ReportReason', reportReasonSchema);
export const NotificationTemplate = model('NotificationTemplate', notificationTemplateSchema);
export const EmailTemplate = model('EmailTemplate', emailTemplateSchema);
