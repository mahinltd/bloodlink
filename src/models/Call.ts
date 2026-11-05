import { model, Schema } from 'mongoose';

const callSchema = new Schema(
  {
    code: { type: String, unique: true, required: true },
    callerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    calleeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    requestId: { type: Schema.Types.ObjectId, ref: 'BloodRequest' },
    channel: { type: String, required: true },
    state: {
      type: String,
      enum: ['ringing', 'accepted', 'declined', 'missed', 'cancelled', 'ended', 'failed'],
      default: 'ringing',
    },
    answeredAt: Date,
    endedAt: Date,
    durationSec: Number,
    endReason: String,
  },
  { timestamps: true },
);
callSchema.index({ callerId: 1, state: 1 });
callSchema.index({ calleeId: 1, state: 1 });
export const Call = model('Call', callSchema);
