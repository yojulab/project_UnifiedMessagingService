import { z } from 'zod';

const emailSchema = z.email();
const SPLIT_RE = /[,;/\n\r|]+/;

/** 한국 전화번호를 하이픈 없는 숫자열로 정규화한다. 유효하지 않으면 null. */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+82')) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith('82') && digits.length >= 11) digits = `0${digits.slice(2)}`;
  digits = digits.replace(/\D/g, '');
  if (digits.startsWith('00')) return null;
  // 010 없이 10자리로 들어온 휴대폰(엑셀 앞자리 0 손실) 보정: 10xxxxxxxx
  if (/^1[016789]\d{7,8}$/.test(digits)) digits = `0${digits}`;
  const valid =
    /^01[016789]\d{7,8}$/.test(digits) || // 휴대폰
    /^02\d{7,8}$/.test(digits) || // 서울
    /^0[3-6]\d\d{7,8}$/.test(digits) || // 지역
    /^0(70|50\d?|80)\d{7,8}$/.test(digits) || // 인터넷/평생/080
    /^1[5-9]\d{6}$/.test(digits); // 대표번호 15xx 등
  return valid ? digits : null;
}

/** 표시용 하이픈 포맷 */
export function formatPhone(digits: string): string {
  if (/^02\d{7,8}$/.test(digits)) return digits.replace(/^(02)(\d{3,4})(\d{4})$/, '$1-$2-$3');
  if (/^1[5-9]\d{6}$/.test(digits)) return digits.replace(/^(\d{4})(\d{4})$/, '$1-$2');
  return digits.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');
}

export function normalizeEmail(raw: string): string | null {
  const v = raw.trim().toLowerCase().replace(/^mailto:/, '');
  return emailSchema.safeParse(v).success ? v : null;
}

export interface NormalizeResult {
  valid: string[];
  invalid: string[];
}

/** 여러 셀 값(각 셀에 구분자로 여러 값 포함 가능)을 정규화·중복 제거한다. */
export function normalizeMany(cells: string[], fn: (v: string) => string | null): NormalizeResult {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const cell of cells) {
    for (const part of String(cell ?? '').split(SPLIT_RE)) {
      const t = part.trim();
      if (!t) continue;
      const n = fn(t);
      if (n) {
        if (!valid.includes(n)) valid.push(n);
      } else invalid.push(t);
    }
  }
  return { valid, invalid };
}

/** 080 수신거부 번호 등 표시 포맷 검증 */
export function normalizeOptOutNumber(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  if (!/^080\d{7,8}$/.test(d)) return null;
  return d.replace(/^(080)(\d{3,4})(\d{4})$/, '$1-$2-$3');
}
