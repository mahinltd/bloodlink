import { model, Schema } from 'mongoose';

const sessionSchema = new Schema(
  {
    code: { type: String, unique: true, required: true },
    subjectType: { type: String, enum: ['user', 'admin'], required: true },
    subjectId: { type: Schema.Types.ObjectId, required: true },
    refreshHash: { type: String, required: true },
    device: Schema.Types.Mixed,
    ip: String,
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
  },
  { timestamps: true },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Session = model('Session', sessionSchema);
