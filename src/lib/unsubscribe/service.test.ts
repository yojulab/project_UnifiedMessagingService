import { describe, expect, it } from 'vitest';
import { extractPhones } from './service';

describe('extractPhones', () => {
  it('다양한 웹훅 페이로드에서 번호 추출', () => {
    expect(extractPhones({ phone: '010-1111-2222' })).toEqual(['010-1111-2222']);
    expect(extractPhones({ numbers: ['01011112222', '01033334444'] })).toEqual(['01011112222', '01033334444']);
    expect(extractPhones({ data: [{ rejectNumber: '01055556666' }] })).toEqual(['01055556666']);
    expect(extractPhones({ other: '01000000000' })).toEqual([]);
  });
});
