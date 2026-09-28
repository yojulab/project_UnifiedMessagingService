import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { CHANNELS } from '@/types';

const PlatformConfigSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, default: '' },
    channel: { type: String, required: true, enum: CHANNELS },
    provider: { type: String, required: true },
    /** 비밀 필드는 AES-256-GCM 암호문(iv:tag:cipher), 그 외는 평문 */
    configData: { type: Schema.Types.Mixed, required: true },
    isDefault: { type: Boolean, default: false },
    status: { type: String, enum: ['ACTIVE', 'ERROR', 'PENDING'], default: 'PENDING' },
    lastTestMessage: { type: String, default: '' },
    lastTestedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);

PlatformConfigSchema.index({ userId: 1 });
PlatformConfigSchema.index({ userId: 1, channel: 1, provider: 1 }, { unique: true });

export type PlatformConfigType = InferSchemaType<typeof PlatformConfigSchema>;
export const PlatformConfig: Model<PlatformConfigType> =
  (models.PlatformConfig as Model<PlatformConfigType>) ?? model('PlatformConfig', PlatformConfigSchema);
