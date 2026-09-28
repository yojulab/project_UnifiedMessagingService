import { describe, expect, it } from 'vitest';
import { csvCell, csvLine } from './csv';

describe('csv', () => {
  it('이스케이프 및 수식 인젝션 방지', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell(null)).toBe('');
    expect(csvLine(['홍길동', 1])).toBe('홍길동,1\r\n');
  });
});
