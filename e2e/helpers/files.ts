import * as XLSX from 'xlsx';

export interface FilePayload {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/** 고유 휴대폰 번호 생성 (01X-XXXX-XXXX). tail 로 끝자리 지정 가능 (9999=실패, 8888=반송 in DRY_RUN) */
let seq = Math.floor(Date.now() % 10_000_000);
export function uniquePhone(tail?: string): string {
  seq = (seq + 7) % 100_000_000;
  const body = String(seq).padStart(8, '0');
  // 끝자리 지정 시에도 가변 자릿수(뒤쪽)를 사용해 호출마다 다른 번호가 나오게 한다
  const digits = tail ? `${body.slice(tail.length)}${tail}` : body;
  return `010-${digits.slice(0, 4)}-${digits.slice(4)}`;
}

export function uniqueTag(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

export type Row = (string | number)[];

export function csv(name: string, rows: Row[], sep = ','): FilePayload {
  return { name, mimeType: 'text/csv', buffer: Buffer.from(`﻿${rows.map((r) => r.join(sep)).join('\n')}\n`) };
}

export function xlsx(name: string, rows: Row[], bookType: 'xlsx' | 'biff8' = 'xlsx'): FilePayload {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return {
    name,
    mimeType: bookType === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.ms-excel',
    buffer: XLSX.write(wb, { type: 'buffer', bookType }) as Buffer,
  };
}

/** CP949(EUC-KR) CSV — 헤더 "이름,전화", 이름은 "홍길동" 고정, 전화번호는 ASCII */
export function cp949Csv(name: string, phones: string[]): FilePayload {
  const header = [0xc0, 0xcc, 0xb8, 0xa7, 0x2c, 0xc0, 0xfc, 0xc8, 0xad, 0x0a]; // 이름,전화\n
  const hong = [0xc8, 0xab, 0xb1, 0xe6, 0xb5, 0xbf]; // 홍길동
  const bytes: number[] = [...header];
  for (const p of phones) bytes.push(...hong, 0x2c, ...Buffer.from(`${p}\n`));
  return { name, mimeType: 'text/csv', buffer: Buffer.from(bytes) };
}

/** 표준 연락처 테이블: 이름, 연락처 1, 연락처 2, 이메일 1, 이메일 2, 회사 */
export function contactRows(rows: { name: string; p1?: string; p2?: string; e1?: string; e2?: string; company?: string }[]): Row[] {
  return [
    ['이름', '연락처 1', '연락처 2', '이메일 1', '이메일 2', '회사'],
    ...rows.map((r) => [r.name, r.p1 ?? '', r.p2 ?? '', r.e1 ?? '', r.e2 ?? '', r.company ?? '']),
  ];
}
