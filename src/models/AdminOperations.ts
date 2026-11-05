import { model, Schema } from 'mongoose';

const supportPaymentSchema = new Schema(
  {
    code: { type: String, unique: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, enum: ['bkash', 'nagad', 'rocket'], required: true },
    amount: { type: Number, min: 1, required: true },
    trxId: { type: String, required: true },
    senderLast4: String,
    status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    verifiedBy: Schema.Types.ObjectId,
    verifiedAt: Date,
  },
  { timestamps: true },
);
supportPaymentSchema.index({ provider: 1, trxId: 1 }, { unique: true });
const providerSettingSchema = new Schema(
  {
    provider: { type: String, enum: ['bkash', 'nagad', 'rocket'], unique: true },
    enabled: Boolean,
    receiverNumber: String,
  },
  { timestamps: true },
);
const auditSchema = new Schema(
  {
    sequence: { type: Number, unique: true, required: true },
    code: { type: String, unique: true, required: true },
    ts: { type: Date, required: true },
    actorId: String,
    actorName: String,
    actorRole: String,
    sessionCode: String,
    event: String,
    resourceType: String,
    resourceId: String,
    result: String,
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    ip: String,
    prevHash: String,
    hash: { type: String, required: true },
  },
  { timestamps: false },
);
auditSchema.pre(
  ['updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'findOneAndUpdate', 'findOneAndDelete'],
  function () {
    throw new Error('AUDIT_APPEND_ONLY');
  },
);
export const SupportPayment = model('SupportPayment', supportPaymentSchema);
export const ProviderSetting = model('ProviderSetting', providerSettingSchema);
export const AuditLog = model('AuditLog', auditSchema);
