import { Schema, model, models, type InferSchemaType, type Model, type Types } from 'mongoose';
import { UNSUB_CHANNELS } from '@/types';

const ContactSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadBatchId: { type: Schema.Types.ObjectId, ref: 'UploadHistory', default: null },
    sourceName: { type: String, default: '' },
    name: { type: String, required: true, trim: true },
    phones: [{ type: String }],
    emails: [{ type: String }],
    company: { type: String, default: '' },
    department: { type: String, default: '' },
    labels: [{ type: String }],
    notes: { type: String, default: '' },
    /** 관리자가 연락처 전체를 거부한 경우만 true — 번호/이메일 단위 거부는 Suppression 컬렉션 */
    isUnsubscribed: { type: Boolean, default: false },
    unsubscribedChannels: [{ type: String, enum: UNSUB_CHANNELS }],
    unsubscribedAt: { type: Date, default: null },
    customFields: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false },
);

ContactSchema.index({ userId: 1 });
ContactSchema.index({ userId: 1, isUnsubscribed: 1 });
ContactSchema.index({ userId: 1, labels: 1 });
ContactSchema.index({ userId: 1, sourceName: 1 });
ContactSchema.index({ userId: 1, phones: 1 });
ContactSchema.index({ userId: 1, emails: 1 });

export type ContactType = InferSchemaType<typeof ContactSchema>;
export type ContactDoc = ContactType & { _id: Types.ObjectId };
export const Contact: Model<ContactType> =
  (models.Contact as Model<ContactType>) ?? model('Contact', ContactSchema);
