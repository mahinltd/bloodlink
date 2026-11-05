import { model, Schema } from 'mongoose';

const counterSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export const Counter = model('Counter', counterSchema);
