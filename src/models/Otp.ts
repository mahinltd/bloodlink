import { model, Schema } from 'mongoose';

const otpSchema = new Schema(
  {
    subject: { type: String, required: true },
    purpose: { type: String, enum: ['verify_email', 'admin_2fa', 'reset'], required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    sentAt: { type: Date, required: true },
  },
  { timestamps: true },
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ subject: 1, purpose: 1, sentAt: -1 });
export const Otp = model('Otp', otpSchema);
