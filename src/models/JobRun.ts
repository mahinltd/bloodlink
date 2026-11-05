import { model, Schema } from 'mongoose';

const jobRunSchema = new Schema(
  {
    name: { type: String, required: true },
    runKey: { type: String, required: true, unique: true },
    status: { type: String, enum: ['running', 'completed', 'failed'], required: true },
    startedAt: { type: Date, required: true },
    finishedAt: Date,
    error: String,
  },
  { timestamps: true },
);

jobRunSchema.index({ name: 1, startedAt: -1 });
export const JobRun = model('JobRun', jobRunSchema);
