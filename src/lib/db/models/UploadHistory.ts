import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { DUPLICATE_HANDLING } from '@/types';

const UploadHistorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    originalFileName: { type: String, required: true },
    fileType: { type: String, enum: ['xlsx', 'xls', 'csv', 'tsv', 'txt'] },
    totalRows: { type: Number, default: 0 },
    importedRows: { type: Number, default: 0 },
    updatedRows: { type: Number, default: 0 },
    skippedRows: { type: Number, default: 0 },
    mappedColumns: {
      name: { type: String },
      phones: [{ type: String }],
      emails: [{ type: String }],
      company: { type: String },
      department: { type: String },
      notes: { type: String },
      custom: { type: Schema.Types.Mixed },
    },
    labels: [{ type: String }],
    duplicateHandling: { type: String, enum: DUPLICATE_HANDLING, default: 'skip' },
    warnings: [{ type: String }],
    status: { type: String, enum: ['PROCESSING', 'COMPLETED', 'FAILED'], default: 'PROCESSING' },
    errorMessage: { type: String, default: '' },
  },
  { timestamps: true },
);

UploadHistorySchema.index({ userId: 1, createdAt: -1 });

type UploadHistoryType = InferSchemaType<typeof UploadHistorySchema>;
export const UploadHistory: Model<UploadHistoryType> =
  (models.UploadHistory as Model<UploadHistoryType>) ?? model('UploadHistory', UploadHistorySchema);
