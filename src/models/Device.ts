import { model, Schema } from 'mongoose';

const deviceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fcmToken: { type: String, unique: true, required: true },
    platform: String,
    appVersion: String,
    locale: String,
    lastSeenAt: Date,
  },
  { timestamps: true },
);
export const Device = model('Device', deviceSchema);
