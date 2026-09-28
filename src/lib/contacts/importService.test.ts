import { describe, expect, it } from 'vitest';
import { rowToCandidate } from './importService';

const headers = ['이름', '전화1', '전화2', '메일', '회사', '등급', '태그'];
const m = { name: '이름', phones: ['전화1', '전화2'], emails: ['메일'], company: '회사', labelsColumn: '태그', custom: { grade: '등급' } };

describe('rowToCandidate', () => {
  it('다중 전화/이메일을 정규화하여 배열로', () => {
    const c = rowToCandidate(headers, ['홍길동', '010-1111-2222', '02-123-4567', 'Hong@Test.com', 'ACME', 'VIP', 'A, B'], 2, m, ['업로드']);
    expect(c).toEqual({
      row: 2, name: '홍길동', phones: ['01011112222', '021234567'], emails: ['hong@test.com'],
      company: 'ACME', department: '', notes: '', labels: ['업로드', 'A', 'B'], customFields: { grade: 'VIP' },
    });
  });

  it('이름 없음 / 연락처 없음은 사유 문자열', () => {
    expect(rowToCandidate(headers, ['', '01011112222', '', '', '', '', ''], 3, m, [])).toContain('이름');
    expect(rowToCandidate(headers, ['김', 'xx', '', 'bad', '', '', ''], 4, m, [])).toContain('유효한 연락처 없음');
  });
});
