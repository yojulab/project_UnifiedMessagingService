import { describe, expect, it } from 'vitest';
import { formatPhone, normalizeEmail, normalizeMany, normalizeOptOutNumber, normalizePhone } from './contactNormalizer';

describe('normalizePhone', () => {
  it.each([
    ['010-1234-5678', '01012345678'],
    ['010 1234 5678', '01012345678'],
    ['+82 10-1234-5678', '01012345678'],
    ['821012345678', '01012345678'],
    ['1012345678', '01012345678'],
    ['02-123-4567', '021234567'],
    ['031-123-4567', '0311234567'],
    ['1588-1234', '15881234'],
    ['070-1234-5678', '07012345678'],
  ])('%s → %s', (input, expected) => expect(normalizePhone(input)).toBe(expected));

  it.each(['abc', '123', '010-12', '0000000000'])('유효하지 않음: %s', (input) => expect(normalizePhone(input)).toBeNull());
});

describe('formatPhone', () => {
  it('하이픈 포맷', () => {
    expect(formatPhone('01012345678')).toBe('010-1234-5678');
    expect(formatPhone('021234567')).toBe('02-123-4567');
    expect(formatPhone('15881234')).toBe('1588-1234');
  });
});

describe('normalizeEmail', () => {
  it('소문자화·trim 및 검증', () => {
    expect(normalizeEmail('  KyLee@Lemonit.co.kr ')).toBe('kylee@lemonit.co.kr');
    expect(normalizeEmail('mailto:a@b.com')).toBe('a@b.com');
    expect(normalizeEmail('not-an-email')).toBeNull();
  });
});

describe('normalizeMany', () => {
  it('셀 내 다중 값 분리, 중복 제거, 무효값 수집', () => {
    const r = normalizeMany(['010-1111-2222, 010-3333-4444', '01011112222', 'xx'], normalizePhone);
    expect(r.valid).toEqual(['01011112222', '01033334444']);
    expect(r.invalid).toEqual(['xx']);
  });
});

describe('normalizeOptOutNumber', () => {
  it('080 번호만 허용', () => {
    expect(normalizeOptOutNumber('0801234567')).toBe('080-123-4567');
    expect(normalizeOptOutNumber('080-1234-5678')).toBe('080-1234-5678');
    expect(normalizeOptOutNumber('010-1234-5678')).toBeNull();
  });
});
