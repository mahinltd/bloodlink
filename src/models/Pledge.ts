import { model, Schema } from 'mongoose';

const pledgeSchema = new Schema(
  {
    requestId: { type: Schema.Types.ObjectId, ref: 'BloodRequest', required: true },
    donorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['offered', 'accepted', 'declined', 'donated', 'cancelled'],
      default: 'offered',
    },
    note: { type: String, maxlength: 300 },
  },
  { timestamps: true },
);
pledgeSchema.index({ requestId: 1, donorId: 1 }, { unique: true });
export const Pledge = model('Pledge', pledgeSchema);
