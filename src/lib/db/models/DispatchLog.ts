import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { RESULT_CODES } from '@/types';

const DispatchLogSchema = new Schema(
  {
    dispatchJobId: { type: Schema.Types.ObjectId, ref: 'DispatchJob', required: true },
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    channel: { type: String, required: true },
    provider: { type: String, default: '' },
    recipient: { type: String, required: true },
    contactName: { type: String, default: '' },
    subject: { type: String, default: '' },
    bodyPreview: { type: String, default: '' },
    resultCode: { type: String, enum: RESULT_CODES, default: 'PENDING' },
    messageId: { type: String, default: '' },
    providerResponse: { type: Schema.Types.Mixed, default: {} },
    errorMessage: { type: String, default: '' },
    isFallback: { type: Boolean, default: false },
    unitCost: { type: Number, default: 0 },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);

DispatchLogSchema.index({ userId: 1 });
DispatchLogSchema.index({ dispatchJobId: 1, resultCode: 1 });
DispatchLogSchema.index({ userId: 1, sentAt: -1 });
DispatchLogSchema.index({ userId: 1, contactId: 1, sentAt: -1 });
DispatchLogSchema.index({ dispatchJobId: 1, recipient: 1 }, { unique: true });

export type DispatchLogType = InferSchemaType<typeof DispatchLogSchema>;
export const DispatchLog: Model<DispatchLogType> =
  (models.DispatchLog as Model<DispatchLogType>) ?? model('DispatchLog', DispatchLogSchema);
