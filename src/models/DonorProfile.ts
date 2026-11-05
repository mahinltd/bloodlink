import { model, Schema } from 'mongoose';

const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
);
const donorProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
    dob: { type: Date, select: false },
    gender: String,
    division: String,
    district: String,
    area: String,
    location: pointSchema,
    locationPrecise: { type: pointSchema, select: false },
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] },
    weightKg: Number,
    lastDonationDate: Date,
    nextEligibleDate: Date,
    available: { type: Boolean, default: false },
    bio: { type: String, maxlength: 240 },
    languages: [String],
    consents: [
      { type: { type: String }, version: String, acceptedAt: Date, ip: String, userAgent: String },
    ],
    healthDeclaredAt: Date,
    registrationStep: { type: Number, min: 1, max: 4, default: 1 },
    registrationCompletedAt: Date,
    donationsCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

donorProfileSchema.index({ location: '2dsphere' });
donorProfileSchema.index({ division: 1, district: 1, bloodGroup: 1, available: 1 });
export const DonorProfile = model('DonorProfile', donorProfileSchema);
