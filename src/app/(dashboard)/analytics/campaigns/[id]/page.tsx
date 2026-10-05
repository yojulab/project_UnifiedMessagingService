'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useState, type ReactElement } from 'react';
import { useApiData } from '@/lib/client/useApiData';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/Field';
import { Alert, PageHeader, Skeleton, Stat } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { api, errMsg, qs } from '@/lib/client/api';
import { CHANNEL_LABEL, RESULT_LABEL, STATUS_LABEL, fmtDate, fmtNum, fmtWon } from '@/lib/client/format';

interface Detail {
  id: string; campaignName: string; channel: string; provider: string; platformName: string; status: string; errorMessage: string;
  scheduledAt: string | null; startedAt: string | null; completedAt: string | null; createdAt: string;
  totalTargets: number; totalMessages: number; estimatedCost: number; sentCount: number; failedCount: number; skippedCount: number; totalCost: number;
  fallbackToLms: boolean;
  targetFilter: { mode: string; limit: number | null; labels: string[]; sourceNames: string[]; keywords: string };
  messageTemplate: { subject: string; body: string; isAd: boolean };
  results: Record<string, { count: number; cost: number }>;
}
interface Log { id: string; contactName: string; channel: string; recipient: string; resultCode: string; errorMessage: string; isFallback: boolean; unitCost: number; sentAt: string | null }
interface LogPage { items: Log[]; total: number; nextCursor: string | null }

export default function CampaignDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [rc, setRc] = useState('');
  const [q, setQ] = useState('');
  const [active, setActive] = useState(true);
  const loader = useCallback(
    () => Promise.all([api<Detail>(`/api/campaigns/${id}`), api<LogPage>(`/api/campaigns/${id}/logs${qs({ resultCode: rc, q })}`)]),
    [id, rc, q],
  );
  const { data, error, reload, setData } = useApiData(loader, active ? 3000 : null);
  const d = data?.[0] ?? null;
  const logs = data?.[1] ?? null;
  const nowActive = d ? d.status === 'PENDING' || d.status === 'SENDING' : true;
  if (nowActive !== active) setActive(nowActive);
  const load = async (): Promise<void> => reload();

  async function more(): Promise<void> {
    if (!logs?.nextCursor) return;
    const next = await api<LogPage>(`/api/campaigns/${id}/logs${qs({ resultCode: rc, q, cursor: logs.nextCursor })}`);
    setData((prev) => (prev ? [prev[0], { ...next, items: [...prev[1].items, ...next.items] }] : prev));
  }

  async function cancel(): Promise<void> {
    if (!window.confirm('캠페인을 취소하시겠습니까?')) return;
    try {
      await api(`/api/campaigns/${id}/cancel`, { method: 'POST' });
      toast('캠페인을 취소했습니다.', 'success');
      await load();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  if (error && !d) return <Alert tone="error">{error}</Alert>;
  if (!d) return <Skeleton rows={6} />;

  const done = d.sentCount + d.failedCount + d.skippedCount;
  const pct = Math.min(100, Math.round((done / Math.max(d.totalMessages, 1)) * 100));
  const r = (k: string): number => d.results[k]?.count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={d.campaignName}
        description={`${CHANNEL_LABEL[d.channel]} · ${d.platformName || d.provider}${d.fallbackToLms ? ' · 실패 시 LMS 대체' : ''}`}
        titleUiId="ALT-TIT-DETAIL"
        descUiId="ALT-TXT-DETAIL"
        actions={
          <>
            <Link href="/analytics" data-ui-id="ALT-LNK-BACK" className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted">← 통계</Link>
            <a href={`/api/campaigns/${id}/logs/export${qs({ resultCode: rc, q })}`} data-ui-id="ALT-BTN-EXPORT" className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted">CSV 내보내기</a>
            {active && <Button data-ui-id="ALT-BTN-CANCEL" variant="danger" onClick={() => void cancel()}>발송 취소</Button>}
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3" data-ui-id="ALT-SEC-STATUS">
        <Badge tone={statusTone(d.status)}><span data-testid="campaign-status">{STATUS_LABEL[d.status]}</span></Badge>
        {d.status === 'PENDING' && d.scheduledAt && <span className="text-sm text-muted-foreground">예약: {fmtDate(d.scheduledAt)}</span>}
        {d.completedAt && <span className="text-sm text-muted-foreground">완료: {fmtDate(d.completedAt)}</span>}
        {d.errorMessage && <Alert tone="error">{d.errorMessage}</Alert>}
      </div>
      {d.status === 'SENDING' && (
        <progress value={pct} max={100} aria-label="발송 진행률" className="h-2 w-full overflow-hidden rounded [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary" />
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6" data-ui-id="ALT-SEC-STATS">
        <Stat label="대상 고객" value={`${fmtNum(d.totalTargets)}명`} />
        <Stat label="발송 건수" value={`${fmtNum(d.totalMessages)}건`} />
        <Stat label="성공" value={<span data-testid="count-success">{fmtNum(r('SUCCESS'))}</span>} />
        <Stat label="실패" value={<span data-testid="count-failed">{fmtNum(r('FAILED'))}</span>} />
        <Stat label="반송" value={<span data-testid="count-bounced">{fmtNum(r('BOUNCED'))}</span>} />
        <Stat label="수신거부 제외" value={<span data-testid="count-skipped">{fmtNum(r('SKIPPED'))}</span>} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Stat label="실제 비용" value={fmtWon(d.totalCost)} sub={`예상 ${fmtWon(d.estimatedCost)}`} />
        <section className="card text-sm" data-ui-id="ALT-SEC-CONDITIONS">
          <h2 className="mb-2 font-semibold" data-ui-id="ALT-TIT-CONDITIONS">발송 조건</h2>
          <p>모드: {{ ALL: '전체', TOP_N: `상위 ${d.targetFilter.limit}명`, RANDOM_N: `무작위 ${d.targetFilter.limit}명` }[d.targetFilter.mode]}</p>
          {d.targetFilter.labels.length > 0 && <p>라벨: {d.targetFilter.labels.join(', ')}</p>}
          {d.targetFilter.sourceNames.length > 0 && <p>출처: {d.targetFilter.sourceNames.join(', ')}</p>}
          {d.targetFilter.keywords && <p>키워드: {d.targetFilter.keywords}</p>}
          {d.messageTemplate.subject && <p className="mt-2">제목: {d.messageTemplate.subject}</p>}
          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{d.messageTemplate.body}</p>
        </section>
      </div>

      <section className="card space-y-3" data-ui-id="ALT-SEC-LOGS">
        <h2 className="font-semibold" data-ui-id="ALT-TIT-LOGS">발송 로그 ({fmtNum(logs?.total)}건)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="결과" value={rc} onChange={(e) => setRc(e.target.value)} data-ui-id="ALT-SEL-LOG-RESULT">
            <option value="">전체</option>
            {['SUCCESS', 'FAILED', 'BOUNCED', 'SKIPPED', 'PENDING'].map((c) => <option key={c} value={c}>{RESULT_LABEL[c]}</option>)}
          </SelectField>
          <TextField label="수신자/이름 검색" value={q} onChange={(e) => setQ(e.target.value)} data-ui-id="ALT-INP-LOG-QUERY" />
        </div>
        <div className="overflow-x-auto">
          <table className="table-base" aria-label="발송 로그" data-ui-id="ALT-TBL-LOGS">
            <thead><tr><th>이름</th><th>수신자</th><th>채널</th><th>결과</th><th>오류</th><th className="text-right">단가</th><th>시각</th></tr></thead>
            <tbody>
              {logs?.items.map((l) => (
                <tr key={l.id}>
                  <td>{l.contactName}</td>
                  <td className="font-mono text-xs">{l.recipient}</td>
                  <td>{CHANNEL_LABEL[l.channel]}{l.isFallback && <Badge tone="warning" className="ml-1">대체</Badge>}</td>
                  <td><Badge tone={statusTone(l.resultCode)}>{RESULT_LABEL[l.resultCode]}</Badge></td>
                  <td className="max-w-[260px] truncate text-xs text-muted-foreground" title={l.errorMessage}>{l.errorMessage}</td>
                  <td className="text-right tabular-nums">{fmtWon(l.unitCost)}</td>
                  <td className="whitespace-nowrap text-xs">{fmtDate(l.sentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {logs?.nextCursor && <Button data-ui-id="ALT-BTN-LOG-MORE" variant="secondary" size="sm" onClick={() => void more()}>더 보기</Button>}
      </section>
    </div>
  );
}
