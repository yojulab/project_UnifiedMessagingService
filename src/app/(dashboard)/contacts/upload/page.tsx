'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { Dropzone } from '@/components/contacts/Dropzone';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox, Radio, SelectField, TextField } from '@/components/ui/Field';
import { Alert, PageHeader, Spinner } from '@/components/ui/Feedback';
import { api, errMsg } from '@/lib/client/api';
import { fmtDate, fmtNum } from '@/lib/client/format';

interface Preview {
  fileName: string;
  fileType: string;
  headers: string[];
  sampleRows: string[][];
  totalRows: number;
  suggestion: { name?: string; phones: string[]; emails: string[]; company?: string; department?: string; notes?: string };
}
interface ImportResult { totalRows: number; importedRows: number; updatedRows: number; skippedRows: number; warnings: string[] }
interface UploadRow { id: string; originalFileName: string; totalRows: number; importedRows: number; updatedRows: number; skippedRows: number; status: string; duplicateHandling: string; createdAt: string }

interface Mapping {
  name: string;
  phones: string[];
  emails: string[];
  company: string;
  department: string;
  notes: string;
  labelsColumn: string;
  custom: string[];
}

const DUP_OPTIONS = [
  { value: 'skip', label: '건너뛰기', desc: '기존 연락처 유지' },
  { value: 'overwrite', label: '덮어쓰기', desc: '정보 갱신, 번호·이메일·라벨은 병합 (수신거부 상태는 유지)' },
  { value: 'create_new', label: '신규 추가', desc: '중복이어도 새 연락처로 생성' },
] as const;

export default function UploadPage(): ReactElement {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [dup, setDup] = useState<'skip' | 'overwrite' | 'create_new'>('skip');
  const [labels, setLabels] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [history, setHistory] = useState<UploadRow[]>([]);
  const [busy, setBusy] = useState<'preview' | 'commit' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = (): void => void api<UploadRow[]>('/api/uploads').then(setHistory).catch(() => undefined);
  useEffect(loadHistory, []);

  async function onFile(f: File): Promise<void> {
    setFile(f);
    setPreview(null);
    setResult(null);
    setError(null);
    setBusy('preview');
    try {
      const fd = new FormData();
      fd.append('file', f);
      const p = await api<Preview>('/api/contacts/upload/preview', { method: 'POST', body: fd });
      setPreview(p);
      const s = p.suggestion;
      setMapping({ name: s.name ?? '', phones: s.phones, emails: s.emails, company: s.company ?? '', department: s.department ?? '', notes: s.notes ?? '', labelsColumn: '', custom: [] });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(null);
    }
  }

  async function commit(): Promise<void> {
    if (!file || !mapping) return;
    setBusy('commit');
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append(
        'options',
        JSON.stringify({
          duplicateHandling: dup,
          labels: labels.split(',').map((s) => s.trim()).filter(Boolean),
          mappedColumns: {
            name: mapping.name,
            phones: mapping.phones,
            emails: mapping.emails,
            company: mapping.company || undefined,
            department: mapping.department || undefined,
            notes: mapping.notes || undefined,
            labelsColumn: mapping.labelsColumn || undefined,
            custom: Object.fromEntries(mapping.custom.map((h) => [h, h])),
          },
        }),
      );
      const r = await api<ImportResult>('/api/contacts/upload/commit', { method: 'POST', body: fd });
      setResult(r);
      setPreview(null);
      loadHistory();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(null);
    }
  }

  const toggle = (key: 'phones' | 'emails' | 'custom', h: string): void =>
    setMapping((m) => (m ? { ...m, [key]: m[key].includes(h) ? m[key].filter((x) => x !== h) : [...m[key], h] } : m));

  const used = mapping ? new Set([mapping.name, ...mapping.phones, ...mapping.emails, mapping.company, mapping.department, mapping.notes, mapping.labelsColumn]) : new Set<string>();
  const valid = mapping && mapping.name && mapping.phones.length + mapping.emails.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="연락처 업로드"
        description="엑셀·CSV·TSV·TXT 파일의 컬럼을 직접 매핑하여 연락처를 가져옵니다."
        titleUiId="CNT-TIT-002"
        descUiId="CNT-TXT-002"
        actions={<Link href="/contacts" data-ui-id="CNT-LNK-001" className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted">연락처 목록</Link>}
      />

      <Dropzone
        data-ui-id="CNT-SEC-DROP"
        accept=".xlsx,.xls,.csv,.tsv,.txt"
        label="연락처 파일 업로드"
        hint="파일을 끌어다 놓거나 선택하세요 (최대 10MB · 50,000행)"
        onFile={(f) => void onFile(f)}
        disabled={busy !== null}
      />
      {busy === 'preview' && <Spinner label="파일 분석 중" />}
      {error && <Alert tone="error">{error}</Alert>}

      {result && (
        <Alert tone="success">
          <p className="font-medium" data-testid="import-result" data-ui-id="CNT-TXT-RESULT">
            가져오기 완료 — 전체 {fmtNum(result.totalRows)}행 · 신규 {fmtNum(result.importedRows)} · 갱신 {fmtNum(result.updatedRows)} · 건너뜀 {fmtNum(result.skippedRows)}
          </p>
          {result.warnings.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs">경고 {result.warnings.length}건 보기</summary>
              <ul className="mt-1 list-disc pl-5 text-xs">{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </details>
          )}
          <Link href="/contacts" data-ui-id="CNT-LNK-002" className="mt-2 inline-block text-sm text-primary hover:underline">연락처 목록으로 →</Link>
        </Alert>
      )}

      {preview && mapping && (
        <>
          <section className="card" aria-label="미리보기" data-ui-id="CNT-SEC-PREVIEW">
            <h2 className="mb-1 font-semibold" data-ui-id="CNT-TIT-PREVIEW">미리보기 — {preview.fileName}</h2>
            <p className="mb-3 text-xs text-muted-foreground" data-ui-id="CNT-TXT-PREVIEW">총 {fmtNum(preview.totalRows)}행 중 상위 3행</p>
            <div className="overflow-x-auto">
              <table className="table-base" aria-label="샘플 데이터" data-ui-id="CNT-TBL-PREVIEW">
                <thead><tr>{preview.headers.map((h) => <th key={h} className="whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>{preview.sampleRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="whitespace-nowrap">{c}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </section>

          <section className="card space-y-5" aria-label="컬럼 매핑" data-ui-id="CNT-SEC-MAPPING">
            <h2 className="font-semibold" data-ui-id="CNT-TIT-MAPPING">컬럼 매핑</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <SelectField label="이름 컬럼" required value={mapping.name} onChange={(e) => setMapping({ ...mapping, name: e.target.value })} data-ui-id="CNT-SEL-MAP-NAME">
                <option value="">선택하세요</option>
                {preview.headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </SelectField>
              {(['company', 'department', 'notes', 'labelsColumn'] as const).map((k) => (
                <SelectField key={k} data-ui-id={`CNT-SEL-MAP-${k.toUpperCase()}`} label={{ company: '회사 컬럼', department: '부서/직책 컬럼', notes: '메모 컬럼', labelsColumn: '라벨 컬럼' }[k]} value={mapping[k]} onChange={(e) => setMapping({ ...mapping, [k]: e.target.value })}>
                  <option value="">사용 안 함</option>
                  {preview.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </SelectField>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <fieldset className="rounded-md border border-border p-3" data-ui-id="CNT-SEC-MAP-PHONES">
                <legend className="px-1 text-sm font-medium">전화번호 컬럼 (복수 선택)</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {preview.headers.map((h) => <Checkbox key={h} label={h} aria-label={`전화번호: ${h}`} checked={mapping.phones.includes(h)} onChange={() => toggle('phones', h)} />)}
                </div>
              </fieldset>
              <fieldset className="rounded-md border border-border p-3" data-ui-id="CNT-SEC-MAP-EMAILS">
                <legend className="px-1 text-sm font-medium">이메일 컬럼 (복수 선택)</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {preview.headers.map((h) => <Checkbox key={h} label={h} aria-label={`이메일: ${h}`} checked={mapping.emails.includes(h)} onChange={() => toggle('emails', h)} />)}
                </div>
              </fieldset>
            </div>
            {preview.headers.some((h) => !used.has(h)) && (
              <fieldset className="rounded-md border border-border p-3" data-ui-id="CNT-SEC-MAP-CUSTOM">
                <legend className="px-1 text-sm font-medium">추가 보관할 컬럼 (커스텀 필드 · 치환태그 {'{컬럼명}'} 사용 가능)</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {preview.headers.filter((h) => !used.has(h)).map((h) => <Checkbox key={h} label={h} aria-label={`커스텀: ${h}`} checked={mapping.custom.includes(h)} onChange={() => toggle('custom', h)} />)}
                </div>
              </fieldset>
            )}

            <fieldset data-ui-id="CNT-SEC-MAP-DUP">
              <legend className="field-label">중복 처리 (같은 전화번호 또는 이메일이 이미 있는 경우)</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {DUP_OPTIONS.map((o) => (
                  <label key={o.value} className={`cursor-pointer rounded-md border p-3 text-sm ${dup === o.value ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <Radio name="dup" value={o.value} checked={dup === o.value} onChange={() => setDup(o.value)} label={o.label} />
                    <p className="mt-1 text-xs text-muted-foreground">{o.desc}</p>
                  </label>
                ))}
              </div>
            </fieldset>

            <TextField label="일괄 부여할 라벨 (쉼표 구분)" placeholder="예: VIP, 2026 세미나" value={labels} onChange={(e) => setLabels(e.target.value)} data-ui-id="CNT-INP-MAP-LABELS" />

            {!valid && <Alert tone="warning">이름 컬럼과 전화번호 또는 이메일 컬럼을 1개 이상 선택하세요.</Alert>}
            <Button data-ui-id="CNT-BTN-COMMIT" onClick={() => void commit()} loading={busy === 'commit'} disabled={!valid}>
              {fmtNum(preview.totalRows)}행 가져오기
            </Button>
          </section>
        </>
      )}

      <section className="card" aria-label="업로드 이력" data-ui-id="CNT-SEC-HISTORY">
        <h2 className="mb-3 font-semibold" data-ui-id="CNT-TIT-HISTORY">업로드 이력</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">업로드 이력이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base" data-ui-id="CNT-TBL-HISTORY">
              <thead><tr><th>파일</th><th>상태</th><th className="text-right">전체</th><th className="text-right">신규</th><th className="text-right">갱신</th><th className="text-right">건너뜀</th><th>일시</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="max-w-[240px] truncate">{h.originalFileName}</td>
                    <td><Badge tone={statusTone(h.status === 'COMPLETED' ? 'COMPLETED' : h.status === 'FAILED' ? 'FAILED' : 'PENDING')}>{h.status}</Badge></td>
                    <td className="text-right tabular-nums">{fmtNum(h.totalRows)}</td>
                    <td className="text-right tabular-nums">{fmtNum(h.importedRows)}</td>
                    <td className="text-right tabular-nums">{fmtNum(h.updatedRows)}</td>
                    <td className="text-right tabular-nums">{fmtNum(h.skippedRows)}</td>
                    <td className="whitespace-nowrap">{fmtDate(h.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
