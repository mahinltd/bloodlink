import { model, Schema } from 'mongoose';

const conversationSchema = new Schema(
  {
    pairKey: { type: String, unique: true, required: true },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    requestId: { type: Schema.Types.ObjectId, ref: 'BloodRequest' },
    lastMessage: { type: Schema.Types.Mixed },
    lastMessageAt: Date,
    unread: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);
export const Conversation = model('Conversation', conversationSchema);
