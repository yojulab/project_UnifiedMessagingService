export function fmtDate(v: string | Date | null | undefined): string {
  if (!v) return '-';
  const d = typeof v === 'string' ? new Date(v) : v;
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function fmtNum(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('ko-KR');
}

export function fmtWon(n: number | null | undefined): string {
  return `₩${Math.round(n ?? 0).toLocaleString('ko-KR')}`;
}

export const CHANNEL_LABEL: Record<string, string> = { EMAIL: '이메일', SMS: 'SMS', LMS: 'LMS', KAKAO: '카카오 알림톡', ALL: '전체' };

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: '작성중', PENDING: '대기', SENDING: '발송중', COMPLETED: '완료', PARTIAL: '부분성공', FAILED: '실패', CANCELLED: '취소',
  ACTIVE: '정상', ERROR: '오류',
};

export const RESULT_LABEL: Record<string, string> = { SUCCESS: '성공', FAILED: '실패', BOUNCED: '반송', PENDING: '대기', SKIPPED: '제외' };

export const REASON_LABEL: Record<string, string> = { OPT_OUT_080: '080 수신거부', OPT_OUT_EMAIL: '이메일 수신거부', MANUAL: '관리자 수동' };
