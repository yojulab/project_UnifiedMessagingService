import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { UNSUB_CHANNELS, UNSUB_REASONS } from '@/types';

/**
 * 테넌트 단위 수신거부(억제) 목록 — 번호/이메일 단위 거부의 단일 기준.
 * 연락처 문서와 독립이므로 연락처 삭제·재업로드·중복 생성과 무관하게 유지된다 (정보통신망법 §50).
 */
const SuppressionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    channel: { type: String, enum: UNSUB_CHANNELS, required: true },
    /** 정규화된 전화번호(숫자열) 또는 소문자 이메일 */
    value: { type: String, required: true },
    reason: { type: String, enum: UNSUB_REASONS, required: true },
    /** 거부 시점에 연결된 연락처 (감사용, 없을 수 있음) */
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact', default: null },
    at: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

SuppressionSchema.index({ userId: 1 });
SuppressionSchema.index({ userId: 1, channel: 1, value: 1 }, { unique: true });
SuppressionSchema.index({ userId: 1, at: -1 });

export type SuppressionType = InferSchemaType<typeof SuppressionSchema>;
export const Suppression: Model<SuppressionType> =
  (models.Suppression as Model<SuppressionType>) ?? model('Suppression', SuppressionSchema);
