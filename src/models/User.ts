import { model, Schema } from 'mongoose';

const userSchema = new Schema(
  {
    code: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true, lowercase: true },
    emailVerified: { type: Boolean, default: false },
    phone: { type: String, unique: true, sparse: true },
    phoneVerified: { type: Boolean, default: false },
    phoneVerifiedBy: String,
    passwordHash: { type: String, select: false },
    googleId: { type: String, sparse: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    language: { type: String, enum: ['bn', 'en'], default: 'bn' },
    status: {
      type: String,
      enum: ['unverified', 'active', 'under_review', 'suspended', 'deleted'],
      default: 'unverified',
    },
    suspendedUntil: Date,
    preferences: {
      appearance: {
        theme: { type: String, enum: ['light', 'dark'], default: 'light' },
        followSystem: Boolean,
        textScale: Number,
        highContrast: Boolean,
      },
      notifications: {
        urgentRequests: Boolean,
        messagesCalls: Boolean,
        donationReminders: Boolean,
        appNews: Boolean,
      },
      safety: {
        shareApproxAreaOnly: { type: Boolean, default: true },
        allowCalls: { type: Boolean, default: true },
      },
    },
    lastLoginAt: Date,
    deletedAt: Date,
  },
  { timestamps: true },
);

export const User = model('User', userSchema);
