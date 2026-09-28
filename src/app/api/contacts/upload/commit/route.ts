import { AppError, ok, withAuth } from '@/lib/api';
import { importContacts } from '@/lib/contacts/importService';
import { readUpload } from '@/lib/contacts/upload';
import { ImportOptionsSchema } from '@/lib/validators/schemas';

/** 2단계: 동일 파일 + 매핑 옵션으로 적재 (stateless — 서버 임시 저장 없음) */
export const POST = withAuth(async (req, _ctx, user) => {
  const { form, fileName, parsed } = await readUpload(req);
  const rawOptions = form.get('options');
  if (typeof rawOptions !== 'string') throw new AppError(400, 'OPTIONS_REQUIRED', '매핑 옵션이 필요합니다.');
  let json: unknown;
  try {
    json = JSON.parse(rawOptions);
  } catch {
    throw new AppError(400, 'INVALID_OPTIONS', '매핑 옵션 JSON 이 올바르지 않습니다.');
  }
  const options = ImportOptionsSchema.parse(json);
  try {
    const result = await importContacts({
      userId: user.oid,
      fileName,
      parsed,
      mappedColumns: options.mappedColumns,
      duplicateHandling: options.duplicateHandling,
      labels: options.labels,
    });
    return ok(result, 201);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('파일에 없는 컬럼')) throw new AppError(400, 'INVALID_MAPPING', err.message);
    throw err;
  }
});
