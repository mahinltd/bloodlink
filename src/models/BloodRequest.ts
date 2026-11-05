import { model, Schema } from 'mongoose';

const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
);
const requestSchema = new Schema(
  {
    code: { type: String, unique: true, required: true },
    requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    patientName: { type: String, required: true, maxlength: 120 },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'],
      required: true,
    },
    units: { type: Number, min: 1, max: 10, required: true },
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital' },
    hospitalNameText: { type: String, required: true, maxlength: 200 },
    hospitalVerified: { type: Boolean, default: false },
    division: String,
    district: String,
    area: String,
    location: pointSchema,
    neededBy: { type: Date, required: true },
    priority: { type: String, enum: ['urgent', 'routine'], required: true },
    contactPhone: { type: String, required: true, select: false },
    notes: { type: String, maxlength: 500 },
    status: {
      type: String,
      enum: [
        'pending_review',
        'needs_info',
        'approved',
        'rejected',
        'fulfilled',
        'cancelled',
        'expired',
      ],
      default: 'pending_review',
    },
    moderation: {
      flags: [String],
      noMoneyKeywords: Boolean,
      reviewedBy: String,
      reviewedAt: Date,
      reason: String,
      checklist: Schema.Types.Mixed,
    },
    pledgeCount: { type: Number, default: 0 },
    fulfilledAt: Date,
  },
  { timestamps: true },
);
requestSchema.index({ status: 1, priority: 1, neededBy: 1 });
requestSchema.index({ location: '2dsphere' });
requestSchema.index({ requesterId: 1 });
requestSchema.index({ patientName: 'text', hospitalNameText: 'text' });
export const BloodRequest = model('BloodRequest', requestSchema);
