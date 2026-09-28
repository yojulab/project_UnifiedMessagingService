import { Schema, model, models, type InferSchemaType, type Model, type Types } from 'mongoose';
import { CHANNELS, DISPATCH_STATUSES, TARGET_MODES, TOP_N_SORTS } from '@/types';

const DispatchJobSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    campaignName: { type: String, required: true, trim: true },
    channel: { type: String, required: true, enum: CHANNELS },
    provider: { type: String, required: true },
    platformConfigId: { type: Schema.Types.ObjectId, ref: 'PlatformConfig', required: true },
    fallbackToLms: { type: Boolean, default: false },
    fallbackConfigId: { type: Schema.Types.ObjectId, ref: 'PlatformConfig', default: null },
    targetFilter: {
      mode: { type: String, enum: TARGET_MODES, default: 'ALL' },
      limit: { type: Number, default: null },
      sort: { type: String, enum: TOP_N_SORTS, default: 'createdAt_desc' },
      labels: [{ type: String }],
      sourceNames: [{ type: String }],
      keywords: { type: String, default: '' },
    },
    messageTemplate: {
      subject: { type: String, default: '' },
      body: { type: String, required: true },
      isHtml: { type: Boolean, default: false },
      isAd: { type: Boolean, default: true },
    },
    /** 발송 확정 시점의 대상 연락처 스냅샷 (RANDOM_N 재현성 보장) */
    targetContactIds: [{ type: Schema.Types.ObjectId, ref: 'Contact' }],
    scheduledAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    totalTargets: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
    estimatedCost: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
    status: { type: String, enum: DISPATCH_STATUSES, default: 'DRAFT' },
    errorMessage: { type: String, default: '' },
  },
  { timestamps: true },
);

DispatchJobSchema.index({ userId: 1 });
DispatchJobSchema.index({ userId: 1, status: 1 });
DispatchJobSchema.index({ userId: 1, createdAt: -1 });
DispatchJobSchema.index({ status: 1, scheduledAt: 1 });

export type DispatchJobType = InferSchemaType<typeof DispatchJobSchema>;
export type DispatchJobDoc = DispatchJobType & { _id: Types.ObjectId };
export const DispatchJob: Model<DispatchJobType> =
  (models.DispatchJob as Model<DispatchJobType>) ?? model('DispatchJob', DispatchJobSchema);
