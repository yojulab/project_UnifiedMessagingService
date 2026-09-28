import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

export const COMMON_CODE_CATEGORIES = ['MSG_CHANNEL', 'PROVIDER', 'DISPATCH_STATUS', 'UNSUB_REASON'] as const;

const CommonCodeSchema = new Schema(
  {
    category: { type: String, required: true, enum: COMMON_CODE_CATEGORIES },
    code: { type: String, required: true },
    name: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    /** PROVIDER: 지원 채널 목록 (예: ['SMS','LMS']) */
    channels: [{ type: String }],
    /** JSON string — 플랫폼별 필요 파라미터 정의 */
    configTemplate: { type: String, default: null },
  },
  { timestamps: true },
);

CommonCodeSchema.index({ category: 1, code: 1 }, { unique: true });

type CommonCodeType = InferSchemaType<typeof CommonCodeSchema>;
export const CommonCode: Model<CommonCodeType> =
  (models.CommonCode as Model<CommonCodeType>) ?? model('CommonCode', CommonCodeSchema);
