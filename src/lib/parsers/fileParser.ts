import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export const SUPPORTED_EXTENSIONS = ['xlsx', 'xls', 'csv', 'tsv', 'txt'] as const;
export type FileType = (typeof SUPPORTED_EXTENSIONS)[number];

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 50_000;

export interface ParsedFile {
  fileType: FileType;
  headers: string[];
  rows: string[][];
}

export class FileParseError extends Error {}

export function detectFileType(fileName: string): FileType {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (!(SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new FileParseError(`지원하지 않는 파일 형식입니다: .${ext} (xlsx, xls, csv, tsv, txt 만 가능)`);
  }
  return ext as FileType;
}

/** UTF-8 로 디코딩하되 깨진 문자가 많으면 CP949(EUC-KR) 로 재디코딩한다. */
export function decodeText(buf: Buffer): string {
  let text = new TextDecoder('utf-8').decode(buf);
  const broken = (text.match(/�/g) ?? []).length;
  if (broken > 0 && broken / Math.max(text.length, 1) > 0.001) {
    text = new TextDecoder('euc-kr').decode(buf);
  }
  return text.replace(/^﻿/, '');
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function buildHeaders(raw: unknown[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((h, i) => {
    let name = cellToString(h) || `컬럼 ${i + 1}`;
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count > 0) name = `${name} (${count + 1})`;
    return name;
  });
}

function toTable(matrix: unknown[][]): { headers: string[]; rows: string[][] } {
  const nonEmpty = matrix.filter((r) => Array.isArray(r) && r.some((c) => cellToString(c) !== ''));
  if (nonEmpty.length === 0) throw new FileParseError('파일에 데이터가 없습니다.');
  const width = Math.max(...nonEmpty.map((r) => r.length));
  const headerRow = [...nonEmpty[0]];
  while (headerRow.length < width) headerRow.push('');
  const headers = buildHeaders(headerRow);
  const rows = nonEmpty.slice(1).map((r) => headers.map((_, i) => cellToString(r[i])));
  if (rows.length > MAX_ROWS) throw new FileParseError(`최대 ${MAX_ROWS.toLocaleString()}행까지 업로드할 수 있습니다.`);
  return { headers, rows };
}

export function parseFile(buf: Buffer, fileName: string): ParsedFile {
  if (buf.byteLength === 0) throw new FileParseError('빈 파일입니다.');
  if (buf.byteLength > MAX_FILE_BYTES) throw new FileParseError('파일 크기는 10MB 이하여야 합니다.');
  const fileType = detectFileType(fileName);

  if (fileType === 'xlsx' || fileType === 'xls') {
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
    } catch {
      throw new FileParseError('엑셀 파일을 읽을 수 없습니다.');
    }
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) throw new FileParseError('시트가 없습니다.');
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false, blankrows: false });
    return { fileType, ...toTable(matrix) };
  }

  const text = decodeText(buf);
  const result = Papa.parse<string[]>(text, {
    delimiter: fileType === 'tsv' ? '\t' : '',
    skipEmptyLines: 'greedy',
  });
  if (result.data.length === 0) throw new FileParseError('파일에 데이터가 없습니다.');
  return { fileType, ...toTable(result.data) };
}

const SUGGEST: { field: 'name' | 'phones' | 'emails' | 'company' | 'department' | 'notes'; re: RegExp }[] = [
  { field: 'emails', re: /메일|e-?mail/i },
  { field: 'phones', re: /전화|연락처|휴대|핸드폰|mobile|phone|tel|cell/i },
  { field: 'name', re: /^(이름|성명|성함|고객명|수강생명|학생명|회원명|사용자명|담당자명|name|full ?name)$|이름|성명|성함|수강생|학생|회원/i },
  { field: 'company', re: /회사|기업|소속|company|organization/i },
  { field: 'department', re: /부서|직책|직급|직위|department|title|position/i },
  { field: 'notes', re: /메모|비고|출처|note|memo|comment|source/i },
];

export interface MappingSuggestion {
  name?: string;
  phones: string[];
  emails: string[];
  company?: string;
  department?: string;
  notes?: string;
}

/** 헤더명 기반 컬럼 매핑 자동 추천 */
export function suggestMapping(headers: string[]): MappingSuggestion {
  const s: MappingSuggestion = { phones: [], emails: [] };
  for (const h of headers) {
    const hit = SUGGEST.find((x) => x.re.test(h));
    if (!hit) continue;
    if (hit.field === 'phones' || hit.field === 'emails') s[hit.field].push(h);
    else if (!s[hit.field]) s[hit.field] = h;
  }
  return s;
}
