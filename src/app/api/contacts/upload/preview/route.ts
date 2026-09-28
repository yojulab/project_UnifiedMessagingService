import { ok, withAuth } from '@/lib/api';
import { readUpload } from '@/lib/contacts/upload';
import { suggestMapping } from '@/lib/parsers/fileParser';

/** 1단계: 파일 파싱 → 헤더 + 상위 3행 미리보기 + 매핑 추천 (저장하지 않음) */
export const POST = withAuth(async (req) => {
  const { fileName, parsed } = await readUpload(req);
  return ok({
    fileName,
    fileType: parsed.fileType,
    headers: parsed.headers,
    sampleRows: parsed.rows.slice(0, 3),
    totalRows: parsed.rows.length,
    suggestion: suggestMapping(parsed.headers),
  });
});
