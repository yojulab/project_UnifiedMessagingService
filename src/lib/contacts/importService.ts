import { Types, type AnyBulkWriteOperation } from 'mongoose';
import { Contact, type ContactType } from '@/lib/db/models/Contact';
import { UploadHistory } from '@/lib/db/models/UploadHistory';
import type { ParsedFile } from '@/lib/parsers/fileParser';
import { normalizeEmail, normalizeMany, normalizePhone } from '@/lib/validators/contactNormalizer';
import type { MappedColumns } from '@/lib/validators/schemas';
import type { DuplicateHandling } from '@/types';

const BATCH = 1000;
const MAX_WARNINGS = 100;

interface Candidate {
  row: number;
  name: string;
  phones: string[];
  emails: string[];
  company: string;
  department: string;
  notes: string;
  labels: string[];
  customFields: Record<string, string>;
}

export interface ImportResult {
  uploadId: string;
  totalRows: number;
  importedRows: number;
  updatedRows: number;
  skippedRows: number;
  warnings: string[];
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

/** 매핑 정보로 한 행을 연락처 후보로 변환. 유효하지 않으면 사유 문자열 반환. */
export function rowToCandidate(
  headers: string[],
  row: string[],
  rowNo: number,
  m: MappedColumns,
  baseLabels: string[],
): Candidate | string {
  const col = (h?: string): string => (h ? (row[headers.indexOf(h)] ?? '').trim() : '');
  const name = col(m.name);
  const phones = normalizeMany(m.phones.map(col), normalizePhone);
  const emails = normalizeMany(m.emails.map(col), normalizeEmail);
  if (!name) return `${rowNo}행: 이름이 비어 있어 건너뜀`;
  if (phones.valid.length + emails.valid.length === 0) {
    const bad = [...phones.invalid, ...emails.invalid];
    return `${rowNo}행(${name}): 유효한 연락처 없음${bad.length ? ` — ${bad.slice(0, 3).join(', ')}` : ''}`;
  }
  const extraLabels = m.labelsColumn ? col(m.labelsColumn).split(/[,;|]/).map((s) => s.trim()) : [];
  const customFields: Record<string, string> = {};
  for (const [field, header] of Object.entries(m.custom ?? {})) {
    const v = col(header);
    if (v) customFields[field] = v;
  }
  return {
    row: rowNo,
    name,
    phones: phones.valid,
    emails: emails.valid,
    company: col(m.company),
    department: col(m.department),
    notes: col(m.notes),
    labels: uniq([...baseLabels, ...extraLabels]),
    customFields,
  };
}

function keysOf(c: { phones: string[]; emails: string[] }): string[] {
  return [...c.phones.map((p) => `p:${p}`), ...c.emails.map((e) => `e:${e}`)];
}

export async function importContacts(params: {
  userId: Types.ObjectId;
  fileName: string;
  parsed: ParsedFile;
  mappedColumns: MappedColumns;
  duplicateHandling: DuplicateHandling;
  labels: string[];
}): Promise<ImportResult> {
  const { userId, fileName, parsed, mappedColumns: m, duplicateHandling } = params;
  for (const h of [m.name, ...m.phones, ...m.emails, m.company, m.department, m.notes, m.labelsColumn, ...Object.values(m.custom ?? {})]) {
    if (h && !parsed.headers.includes(h)) throw new Error(`파일에 없는 컬럼입니다: ${h}`);
  }

  const history = await UploadHistory.create({
    userId,
    originalFileName: fileName,
    fileType: parsed.fileType,
    totalRows: parsed.rows.length,
    mappedColumns: m,
    labels: params.labels,
    duplicateHandling,
    status: 'PROCESSING',
  });

  const warnings: string[] = [];
  const warn = (w: string): void => {
    if (warnings.length < MAX_WARNINGS) warnings.push(w);
  };
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  try {
    for (let start = 0; start < parsed.rows.length; start += BATCH) {
      const candidates: Candidate[] = [];
      parsed.rows.slice(start, start + BATCH).forEach((row, i) => {
        const c = rowToCandidate(parsed.headers, row, start + i + 2, m, params.labels);
        if (typeof c === 'string') {
          skipped++;
          warn(c);
        } else candidates.push(c);
      });
      if (candidates.length === 0) continue;

      // 기존 DB 연락처 조회 (같은 userId 내 전화/이메일 일치)
      const existingByKey = new Map<string, Types.ObjectId>();
      if (duplicateHandling !== 'create_new') {
        const phones = uniq(candidates.flatMap((c) => c.phones));
        const emails = uniq(candidates.flatMap((c) => c.emails));
        const existing = await Contact.find(
          { userId, $or: [{ phones: { $in: phones } }, { emails: { $in: emails } }] },
          { phones: 1, emails: 1 },
        ).lean();
        for (const e of existing) {
          for (const k of keysOf({ phones: e.phones ?? [], emails: e.emails ?? [] })) existingByKey.set(k, e._id);
        }
      }

      const ops: AnyBulkWriteOperation<ContactType>[] = [];
      const pendingByKey = new Map<string, Candidate>();
      for (const c of candidates) {
        if (duplicateHandling === 'create_new') {
          ops.push({ insertOne: { document: newDoc(c) } });
          imported++;
          continue;
        }
        const keys = keysOf(c);
        const dbId = keys.map((k) => existingByKey.get(k)).find(Boolean);
        const pending = keys.map((k) => pendingByKey.get(k)).find(Boolean);
        if (dbId) {
          if (duplicateHandling === 'skip') {
            skipped++;
            warn(`${c.row}행(${c.name}): 기존 연락처와 중복되어 건너뜀`);
          } else {
            ops.push({ updateOne: { filter: { _id: dbId, userId }, update: overwriteUpdate(c) } });
            updated++;
          }
        } else if (pending) {
          // 같은 파일 안에서 중복 → 먼저 나온 행에 병합(overwrite) 또는 건너뜀(skip)
          if (duplicateHandling === 'overwrite') mergeInto(pending, c);
          else warn(`${c.row}행(${c.name}): 파일 내 중복으로 건너뜀`);
          skipped++;
        } else {
          for (const k of keys) pendingByKey.set(k, c);
        }
      }
      const inserts = uniqCandidates([...pendingByKey.values()]);
      for (const c of inserts) ops.push({ insertOne: { document: newDoc(c) } });
      imported += inserts.length;
      if (ops.length) await Contact.bulkWrite(ops, { ordered: false });
    }

    await UploadHistory.updateOne(
      { _id: history._id, userId },
      { $set: { importedRows: imported, updatedRows: updated, skippedRows: skipped, warnings, status: 'COMPLETED' } },
    );
  } catch (err) {
    await UploadHistory.updateOne(
      { _id: history._id, userId },
      { $set: { status: 'FAILED', errorMessage: err instanceof Error ? err.message : '처리 실패' } },
    );
    throw err;
  }

  return { uploadId: String(history._id), totalRows: parsed.rows.length, importedRows: imported, updatedRows: updated, skippedRows: skipped, warnings };

  function newDoc(c: Candidate): ContactType {
    return {
      userId,
      uploadBatchId: history._id,
      sourceName: fileName,
      name: c.name,
      phones: c.phones,
      emails: c.emails,
      company: c.company,
      department: c.department,
      labels: c.labels,
      notes: c.notes,
      customFields: c.customFields,
    } as unknown as ContactType;
  }

  function overwriteUpdate(c: Candidate): Record<string, unknown> {
    // 수신거부 필드는 절대 건드리지 않는다
    const set: Record<string, unknown> = { name: c.name, sourceName: fileName, uploadBatchId: history._id };
    if (c.company) set.company = c.company;
    if (c.department) set.department = c.department;
    if (c.notes) set.notes = c.notes;
    for (const [k, v] of Object.entries(c.customFields)) set[`customFields.${k}`] = v;
    return {
      $set: set,
      $addToSet: { phones: { $each: c.phones }, emails: { $each: c.emails }, labels: { $each: c.labels } },
    };
  }
}

function mergeInto(target: Candidate, src: Candidate): void {
  target.phones = uniq([...target.phones, ...src.phones]);
  target.emails = uniq([...target.emails, ...src.emails]);
  target.labels = uniq([...target.labels, ...src.labels]);
  target.name = src.name || target.name;
  target.company = src.company || target.company;
  target.department = src.department || target.department;
  target.notes = src.notes || target.notes;
  target.customFields = { ...target.customFields, ...src.customFields };
}

function uniqCandidates(list: Candidate[]): Candidate[] {
  return [...new Set(list)];
}
