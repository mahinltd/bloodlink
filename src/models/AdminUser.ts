import { model, Schema } from 'mongoose';

const adminUserSchema = new Schema(
  {
    email: { type: String, unique: true, required: true, lowercase: true },
    name: { type: String, required: true },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'moderator', 'content_editor', 'finance'],
      required: true,
    },
    passwordHash: { type: String, required: true, select: false },
    status: { type: String, enum: ['active', 'locked', 'disabled'], default: 'active' },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

export const AdminUser = model('AdminUser', adminUserSchema);
