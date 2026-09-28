import { ok, withAuth } from '@/lib/api';
import { UploadHistory } from '@/lib/db/models/UploadHistory';

export const GET = withAuth(async (_req, _ctx, user) => {
  const docs = await UploadHistory.find({ userId: user.oid }).sort({ createdAt: -1 }).limit(50).lean();
  return ok(
    docs.map((d) => ({
      id: String(d._id),
      originalFileName: d.originalFileName,
      fileType: d.fileType,
      totalRows: d.totalRows,
      importedRows: d.importedRows,
      updatedRows: d.updatedRows,
      skippedRows: d.skippedRows,
      duplicateHandling: d.duplicateHandling,
      status: d.status,
      warnings: d.warnings ?? [],
      createdAt: d.createdAt,
    })),
  );
});
