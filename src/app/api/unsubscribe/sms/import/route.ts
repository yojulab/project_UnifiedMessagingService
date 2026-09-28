import { AppError, ok, withAuth } from '@/lib/api';
import { readUpload } from '@/lib/contacts/upload';
import { blockRecipients } from '@/lib/unsubscribe/service';
import { normalizePhone } from '@/lib/validators/contactNormalizer';

/** 080 수신거부 목록 CSV 업로드 → 해당 번호만 SMS 수신거부 (OPT_OUT_080) */
export const POST = withAuth(async (req, _ctx, user) => {
  const { parsed } = await readUpload(req);
  // 헤더 행도 번호일 수 있으므로 포함하여 모든 셀에서 번호 추출
  const cells = [parsed.headers, ...parsed.rows].flat();
  const numbers = [...new Set(cells.map((c) => normalizePhone(c)).filter((v): v is string => Boolean(v)))];
  if (numbers.length === 0) throw new AppError(400, 'NO_NUMBERS', '파일에서 유효한 전화번호를 찾지 못했습니다.');
  const result = await blockRecipients(user.oid, 'SMS', numbers, 'OPT_OUT_080');
  return ok({ numbers: numbers.length, ...result });
});
