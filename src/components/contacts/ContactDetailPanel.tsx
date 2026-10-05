'use client';

import Link from 'next/link';
import { useCallback, useState, type ReactElement } from 'react';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { api, errMsg } from '@/lib/client/api';
import { useApiData } from '@/lib/client/useApiData';
import { CHANNEL_LABEL, REASON_LABEL, RESULT_LABEL, fmtDate } from '@/lib/client/format';
import type { ContactDetail, ContactLog } from './types';

interface Props {
  id: string;
  onChanged: () => void;
  onClose: () => void;
}

export function ContactDetailPanel({ id, onChanged, onClose }: Props): ReactElement {
  const toast = useToast();
  const [override, setOverride] = useState<ContactDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ labels: '', notes: '' });
  const loader = useCallback(
    () => Promise.all([api<ContactDetail>(`/api/contacts/${id}`), api<ContactLog[]>(`/api/contacts/${id}/logs`)]),
    [id],
  );
  const { data, error } = useApiData(loader);
  const c = override ?? data?.[0] ?? null;
  const logs = data?.[1] ?? [];
  const setC = setOverride;

  async function patch(body: Record<string, unknown>, msg: string): Promise<void> {
    try {
      const d = await api<ContactDetail>(`/api/contacts/${id}`, { method: 'PATCH', json: body });
      setC(d);
      toast(msg, 'success');
      onChanged();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }


  return (
    <aside className="card sticky top-4 space-y-5" aria-label="연락처 상세" data-ui-id="CNT-SEC-DETAIL">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold" data-ui-id="CNT-TIT-DETAIL">{c?.name ?? '연락처'}</h2>
          {c && <p className="text-xs text-muted-foreground">{[c.company, c.department].filter(Boolean).join(' · ') || '소속 정보 없음'}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="상세 닫기" data-ui-id="CNT-BTN-DETAIL-CLOSE" className="rounded px-2 text-muted-foreground hover:bg-muted">✕</button>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {!c && !error && <Spinner />}
      {c && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {c.isUnsubscribed ? <Badge tone="danger">전체 수신거부</Badge> : c.unsubscribe === 'PARTIAL' ? <Badge tone="warning">일부 수신거부</Badge> : <Badge tone="success">수신 동의</Badge>}
            <Button data-ui-id="CNT-BTN-DETAIL-UNSUB-ALL" size="sm" variant={c.isUnsubscribed ? 'secondary' : 'danger'} onClick={() => void patch({ unsubscribeAll: !c.isUnsubscribed }, c.isUnsubscribed ? '전체 수신거부를 해제했습니다.' : '전체 수신거부로 등록했습니다.')}>
              {c.isUnsubscribed ? '전체 수신거부 해제' : '전체 수신거부 등록'}
            </Button>
          </div>

          <section data-ui-id="CNT-SEC-DETAIL-PHONES">
            <h3 className="mb-2 text-sm font-semibold">전화번호 ({c.phones.length})</h3>
            <ul className="space-y-1.5" aria-label="전화번호 목록">
              {c.phones.length === 0 && <li className="text-sm text-muted-foreground">없음</li>}
              {c.phones.map((p) => (
                <li key={p.value} className="flex items-center justify-between gap-2 rounded border border-border px-3 py-1.5 text-sm">
                  <span className="font-mono">{p.display}</span>
                  <span className="flex items-center gap-2">
                    {p.smsBlocked && <Badge tone="danger">{REASON_LABEL[p.reason ?? ''] ?? '수신거부'}</Badge>}
                    <Button data-ui-id="CNT-BTN-DETAIL-PHONE-BLOCK" size="sm" variant="ghost" aria-label={`${p.display} ${p.smsBlocked ? '수신거부 해제' : '수신거부 등록'}`} onClick={() => void patch({ recipient: { action: p.smsBlocked ? 'unblock' : 'block', channel: 'SMS', value: p.value } }, p.smsBlocked ? '수신거부를 해제했습니다.' : '수신거부로 등록했습니다.')}>
                      {p.smsBlocked ? '해제' : '거부'}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section data-ui-id="CNT-SEC-DETAIL-EMAILS">
            <h3 className="mb-2 text-sm font-semibold">이메일 ({c.emails.length})</h3>
            <ul className="space-y-1.5" aria-label="이메일 목록">
              {c.emails.length === 0 && <li className="text-sm text-muted-foreground">없음</li>}
              {c.emails.map((e) => (
                <li key={e.value} className="flex items-center justify-between gap-2 rounded border border-border px-3 py-1.5 text-sm">
                  <span className="truncate">{e.display}</span>
                  <span className="flex items-center gap-2">
                    {e.emailBlocked && <Badge tone="danger">{REASON_LABEL[e.reason ?? ''] ?? '수신거부'}</Badge>}
                    <Button data-ui-id="CNT-BTN-DETAIL-EMAIL-BLOCK" size="sm" variant="ghost" aria-label={`${e.display} ${e.emailBlocked ? '수신거부 해제' : '수신거부 등록'}`} onClick={() => void patch({ recipient: { action: e.emailBlocked ? 'unblock' : 'block', channel: 'EMAIL', value: e.value } }, e.emailBlocked ? '수신거부를 해제했습니다.' : '수신거부로 등록했습니다.')}>
                      {e.emailBlocked ? '해제' : '거부'}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2" data-ui-id="CNT-SEC-DETAIL-NOTES">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">라벨 · 메모</h3>
              {!editing && <Button data-ui-id="CNT-BTN-DETAIL-EDIT" size="sm" variant="ghost" onClick={() => { setForm({ labels: c.labels.join(', '), notes: c.notes }); setEditing(true); }}>편집</Button>}
            </div>
            {editing ? (
              <div className="space-y-2">
                <TextField data-ui-id="CNT-INP-DETAIL-LABELS" label="라벨 (쉼표 구분)" value={form.labels} onChange={(e) => setForm((f) => ({ ...f, labels: e.target.value }))} />
                <TextAreaField data-ui-id="CNT-INP-DETAIL-NOTES" label="메모" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                <div className="flex gap-2">
                  <Button data-ui-id="CNT-BTN-DETAIL-SAVE" size="sm" onClick={() => { void patch({ labels: form.labels.split(',').map((s) => s.trim()).filter(Boolean), notes: form.notes }, '저장했습니다.'); setEditing(false); }}>저장</Button>
                  <Button data-ui-id="CNT-BTN-DETAIL-CANCEL" size="sm" variant="ghost" onClick={() => setEditing(false)}>취소</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-1">{c.labels.length ? c.labels.map((l) => <Badge key={l}>{l}</Badge>) : <span className="text-sm text-muted-foreground">라벨 없음</span>}</div>
                {c.notes && <p className="whitespace-pre-wrap text-sm">{c.notes}</p>}
              </>
            )}
          </section>

          <section data-ui-id="CNT-SEC-DETAIL-META">
            <h3 className="mb-2 text-sm font-semibold">원본 메타데이터</h3>
            <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">출처 파일</dt><dd className="truncate">{c.sourceName || '-'}</dd>
              <dt className="text-muted-foreground">등록일</dt><dd>{fmtDate(c.createdAt)}</dd>
              {Object.entries(c.customFields).map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="truncate">{String(v)}</dd></div>
              ))}
            </dl>
          </section>

          <section data-ui-id="CNT-SEC-DETAIL-LOGS">
            <h3 className="mb-2 text-sm font-semibold">발송 이력</h3>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">발송 이력이 없습니다.</p>
            ) : (
              <ol className="relative space-y-3 border-l border-border pl-4" aria-label="발송 이력 타임라인">
                {logs.map((l) => (
                  <li key={l.id} className="text-sm">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" aria-hidden />
                    <p className="flex flex-wrap items-center gap-2">
                      <Badge tone={statusTone(l.resultCode)}>{RESULT_LABEL[l.resultCode] ?? l.resultCode}</Badge>
                      <span>{CHANNEL_LABEL[l.channel]}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(l.sentAt)}</span>
                    </p>
                    <p className="mt-0.5 text-xs">
                      <Link href={`/analytics/campaigns/${l.campaignId}`} className="text-primary hover:underline">{l.campaignName}</Link> → {l.recipient}
                    </p>
                    {l.errorMessage && <p className="text-xs text-danger">{l.errorMessage}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <Button data-ui-id="CNT-BTN-DETAIL-DEL" size="sm" variant="ghost" className="text-danger" onClick={() => { if (window.confirm('이 연락처를 삭제하시겠습니까?')) void api(`/api/contacts/${id}`, { method: 'DELETE' }).then(() => { toast('삭제했습니다.', 'success'); onChanged(); onClose(); }); }}>
            연락처 삭제
          </Button>
        </>
      )}
    </aside>
  );
}
