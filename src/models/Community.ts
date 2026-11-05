import { model, Schema } from 'mongoose';

const donationSchema = new Schema(
  {
    donorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requestId: { type: Schema.Types.ObjectId, ref: 'BloodRequest' },
    date: { type: Date, required: true },
    hospitalName: { type: String, required: true },
    bloodGroup: { type: String, required: true },
    units: { type: Number, required: true },
    recipientName: String,
    source: { type: String, enum: ['confirmed', 'self_reported'], required: true },
  },
  { timestamps: true },
);
const reviewSchema = new Schema(
  {
    donationId: { type: Schema.Types.ObjectId, ref: 'Donation', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    text: { type: String, maxlength: 300, required: true },
    anonymous: { type: Boolean, required: true },
  },
  { timestamps: true },
);
reviewSchema.index({ donationId: 1, authorId: 1 }, { unique: true });
const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: String,
    title: { bn: String, en: String },
    body: { bn: String, en: String },
    data: Schema.Types.Mixed,
    readAt: Date,
    expireAt: Date,
  },
  { timestamps: true },
);
notificationSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
const reportSchema = new Schema(
  {
    code: { type: String, unique: true, required: true },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requestId: Schema.Types.ObjectId,
    reason: {
      type: String,
      enum: ['money_demand', 'fake_or_misleading', 'harassment', 'spam_other'],
      required: true,
    },
    description: { type: String, maxlength: 2000, required: true },
    evidence: [Schema.Types.Mixed],
    anonymous: Boolean,
    priority: { type: String, enum: ['high', 'normal', 'low'], required: true },
    status: {
      type: String,
      enum: ['open', 'in_review', 'needs_info', 'restricted', 'resolved', 'dismissed'],
      default: 'open',
    },
    assignedTo: Schema.Types.ObjectId,
    notes: [Schema.Types.Mixed],
    decision: Schema.Types.Mixed,
  },
  { timestamps: true },
);
export const Donation = model('Donation', donationSchema);
export const Review = model('Review', reviewSchema);
export const Notification = model('Notification', notificationSchema);
export const Report = model('Report', reportSchema);
