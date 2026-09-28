'use client';

import { useCallback, useState, type ReactElement } from 'react';
import { useApiData } from '@/lib/client/useApiData';
import { Dropzone } from '@/components/contacts/Dropzone';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Field';
import { Alert, EmptyState, PageHeader, Skeleton } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { api, errMsg, qs } from '@/lib/client/api';
import { CHANNEL_LABEL, REASON_LABEL, fmtDate, fmtNum } from '@/lib/client/format';

interface Row { kind: 'VALUE' | 'CONTACT'; contactId: string | null; name: string; value: string; display: string; channel: string; reason: string; at: string | null }

export default function UnsubscribesPage(): ReactElement {
  const toast = useToast();
  const [channel, setChannel] = useState('');
  const [reason, setReason] = useState('');
  const [importing, setImporting] = useState(false);
  const rowsLoader = useCallback(() => api<Row[]>(`/api/unsubscribes${qs({ channel, reason })}`), [channel, reason]);
  const webhookLoader = useCallback(() => api<Record<string, string>>('/api/me/webhook'), []);
  const { data: rows, error, reload } = useApiData(rowsLoader);
  const webhooks = useApiData(webhookLoader).data ?? {};
  const load = async (): Promise<void> => reload();

  async function importCsv(f: File): Promise<void> {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await api<{ numbers: number; matchedContacts: number; newlyBlocked: number }>('/api/unsubscribe/sms/import', { method: 'POST', body: fd });
      toast(`080 수신거부 반영: 번호 ${r.numbers}개 · 일치 연락처 ${r.matchedContacts}명 · 신규 거부 ${r.newlyBlocked}건`, 'success');
      await load();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setImporting(false);
    }
  }

  async function release(r: Row): Promise<void> {
    if (!window.confirm(`${r.name} (${r.display}) 의 수신거부를 해제하시겠습니까?`)) return;
    try {
      if (r.kind === 'CONTACT') await api(`/api/contacts/${r.contactId}`, { method: 'PATCH', json: { unsubscribeAll: false } });
      else await api('/api/unsubscribes', { method: 'DELETE', json: { channel: r.channel, value: r.value } });
      toast('수신거부를 해제했습니다.', 'success');
      await load();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="수신거부 관리"
        description="080 무료수신거부 · 이메일 원클릭 수신거부 · 관리자 수동 등록 내역"
        actions={<a href={`/api/unsubscribes${qs({ channel, reason, format: 'csv' })}`} className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted">CSV 내보내기</a>}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="font-semibold">080 수신거부 목록 가져오기</h2>
          <Dropzone accept=".csv,.txt,.xlsx,.xls,.tsv" label="080 수신거부 파일 업로드" hint="전화번호가 들어 있는 CSV/엑셀 — 해당 번호만 문자 발송에서 제외됩니다." onFile={(f) => void importCsv(f)} disabled={importing} />
        </section>
        <section className="card space-y-2 text-sm">
          <h2 className="font-semibold">080 자동 동기화 웹훅</h2>
          <p className="text-xs text-muted-foreground">공급사 콘솔의 080 수신거부 알림(웹훅) URL 에 아래 주소를 등록하면 거부 번호가 자동 반영됩니다. 서명(sig)이 포함되어 있으니 외부에 공유하지 마세요.</p>
          {Object.entries(webhooks).map(([p, url]) => (
            <div key={p}>
              <p className="text-xs font-medium">{p}</p>
              <code className="block break-all rounded bg-muted p-2 text-xs">{url}</code>
            </div>
          ))}
        </section>
      </div>
      <div className="card grid gap-3 sm:grid-cols-2">
        <SelectField label="채널" value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="">전체</option>
          <option value="SMS">문자</option>
          <option value="EMAIL">이메일</option>
          <option value="KAKAO">카카오</option>
        </SelectField>
        <SelectField label="사유" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">전체</option>
          {Object.entries(REASON_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </SelectField>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {!rows && !error && <Skeleton rows={4} />}
      {rows && rows.length === 0 && <EmptyState title="수신거부 내역이 없습니다." />}
      {rows && rows.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <p className="px-4 pt-3 text-xs text-muted-foreground">{fmtNum(rows.length)}건</p>
          <table className="table-base" aria-label="수신거부 목록">
            <thead><tr><th>이름</th><th>번호/이메일</th><th>채널</th><th>사유</th><th>일시</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.kind}-${r.contactId ?? ''}-${r.channel}-${r.value}`}>
                  <td>{r.name}</td>
                  <td className="font-mono text-xs">{r.display}</td>
                  <td>{CHANNEL_LABEL[r.channel] ?? r.channel}</td>
                  <td><Badge tone={r.reason === 'MANUAL' ? 'neutral' : 'danger'}>{REASON_LABEL[r.reason] ?? r.reason}</Badge></td>
                  <td className="whitespace-nowrap text-xs">{fmtDate(r.at)}</td>
                  <td className="text-right"><Button size="sm" variant="ghost" onClick={() => void release(r)}>해제</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
