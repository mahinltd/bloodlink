import { model, Schema } from 'mongoose';

const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    clientMessageId: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'image', 'audio', 'file', 'location', 'call_log', 'system'],
      required: true,
    },
    text: { type: String, maxlength: 5000 },
    media: Schema.Types.Mixed,
    location: Schema.Types.Mixed,
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
    deliveredAt: Date,
    readAt: Date,
    flags: [String],
  },
  { timestamps: true },
);
messageSchema.index({ conversationId: 1, _id: -1 });
messageSchema.index({ conversationId: 1, clientMessageId: 1 }, { unique: true });
export const Message = model('Message', messageSchema);
