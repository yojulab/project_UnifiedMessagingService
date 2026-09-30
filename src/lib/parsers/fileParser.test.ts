import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { FileParseError, parseFile, suggestMapping } from './fileParser';

const EUC_KR_CSV = Buffer.from([
  0xc0, 0xcc, 0xb8, 0xa7, 0x2c, 0xc0, 0xfc, 0xc8, 0xad, 0x0a, // 이름,전화\n
  0xc8, 0xab, 0xb1, 0xe6, 0xb5, 0xbf, 0x2c, 0x30, 0x31, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, // 홍길동,01012345678
]);

function makeXlsx(bookType: 'xlsx' | 'biff8'): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([
    ['이름', '연락처 1', '연락처 2', '이메일'],
    ['홍길동', '010-1111-2222', '', 'hong@test.com'],
    ['김철수', '01033334444', '02-123-4567', ''],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType }) as Buffer;
}

describe('parseFile', () => {
  it('UTF-8 BOM CSV', () => {
    const r = parseFile(Buffer.from('﻿이름,전화\n홍길동,010-1234-5678\n\n'), 'a.csv');
    expect(r.headers).toEqual(['이름', '전화']);
    expect(r.rows).toEqual([['홍길동', '010-1234-5678']]);
  });

  it('CP949 CSV 자동 재디코딩', () => {
    const r = parseFile(EUC_KR_CSV, 'a.csv');
    expect(r.headers).toEqual(['이름', '전화']);
    expect(r.rows[0][0]).toBe('홍길동');
  });

  it('TSV / TXT(파이프 구분 자동 감지)', () => {
    expect(parseFile(Buffer.from('이름\t전화\n가\t010'), 'a.tsv').rows).toEqual([['가', '010']]);
    expect(parseFile(Buffer.from('이름|전화\n가|010\n나|011'), 'a.txt').rows).toEqual([['가', '010'], ['나', '011']]);
  });

  it('xlsx / xls', () => {
    for (const [bt, name] of [['xlsx', 'a.xlsx'], ['biff8', 'a.xls']] as const) {
      const r = parseFile(makeXlsx(bt), name);
      expect(r.headers).toEqual(['이름', '연락처 1', '연락처 2', '이메일']);
      expect(r.rows).toHaveLength(2);
      expect(r.rows[1]).toEqual(['김철수', '01033334444', '02-123-4567', '']);
    }
  });

  it('빈/중복 헤더 이름 보정', () => {
    expect(parseFile(Buffer.from('이름,,전화,전화\n가,x,1,2'), 'a.csv').headers).toEqual(['이름', '컬럼 2', '전화', '전화 (2)']);
  });

  it('지원하지 않는 확장자 / 빈 파일', () => {
    expect(() => parseFile(Buffer.from('x'), 'a.pdf')).toThrow(FileParseError);
    expect(() => parseFile(Buffer.from(''), 'a.csv')).toThrow('빈 파일');
  });
});

describe('suggestMapping', () => {
  it('헤더명으로 추천', () => {
    expect(suggestMapping(['성명', '휴대폰', '회사 전화', 'E-mail', '회사명', '직책', '메모', '기타'])).toEqual({
      name: '성명',
      phones: ['휴대폰', '회사 전화'],
      emails: ['E-mail'],
      company: '회사명',
      department: '직책',
      notes: '메모',
    });
  });

  it('실제 교육과정 수강생 명단 헤더를 정확히 자동 추천한다', () => {
    const headers = ['과정명(폴더명)', '수강생명', '연락처(전화번호)', '이메일 1', '이메일 2', '출처 파일명'];
    expect(suggestMapping(headers)).toEqual({
      name: '수강생명',
      phones: ['연락처(전화번호)'],
      emails: ['이메일 1', '이메일 2'],
      notes: '출처 파일명',
    });
  });
});
