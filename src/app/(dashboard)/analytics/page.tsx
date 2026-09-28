'use client';

import Link from 'next/link';
import { useCallback, useState, type ReactElement } from 'react';
import { useApiData } from '@/lib/client/useApiData';
import { DailyChart, type DayPoint } from '@/components/analytics/DailyChart';
import { Badge, statusTone } from '@/components/ui/Badge';
import { SelectField, TextField } from '@/components/ui/Field';
import { Alert, EmptyState, PageHeader, Skeleton, Stat } from '@/components/ui/Feedback';
import { api, qs } from '@/lib/client/api';
import { CHANNEL_LABEL, STATUS_LABEL, fmtDate, fmtNum, fmtWon } from '@/lib/client/format';

interface Summary {
  campaigns: number; attempted: number; success: number; failed: number; bounced: number; skipped: number;
  successRate: number; totalCost: number; newUnsubscribes: number; byChannel: { channel: string; count: number; success: number }[];
}
interface Campaign { id: string; campaignName: string; channel: string; status: string; totalMessages: number; sentCount: number; failedCount: number; totalCost: number; createdAt: string }

function kstDate(offsetDays: number): string {
  const d = new Date(Date.now() + 9 * 3600_000 + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsPage(): ReactElement {
  const [from, setFrom] = useState(kstDate(-29));
  const [to, setTo] = useState(kstDate(0));
  const [channel, setChannel] = useState('');
  const loader = useCallback(
    () =>
      Promise.all([
        api<Summary>(`/api/analytics/summary${qs({ from, to })}`),
        api<DayPoint[]>(`/api/analytics/timeseries${qs({ from, to, channel })}`),
        api<Campaign[]>('/api/campaigns'),
      ]),
    [from, to, channel],
  );
  const { data, error } = useApiData(loader);
  const summary = data?.[0] ?? null;
  const series = data?.[1] ?? [];
  const campaigns = data?.[2] ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="발송 결과 & 통계" actions={<Link href="/analytics/unsubscribes" className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted">수신거부 목록</Link>} />
      <div className="card grid gap-3 sm:grid-cols-3" aria-label="기간 필터">
        <TextField label="시작일" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        <TextField label="종료일" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        <SelectField label="채널" value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="">전체</option>
          {['EMAIL', 'SMS', 'LMS', 'KAKAO'].map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
        </SelectField>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {!summary && !error && <Skeleton rows={4} />}
      {summary && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Stat label="발송 시도" value={fmtNum(summary.attempted)} sub={`캠페인 ${fmtNum(summary.campaigns)}건`} />
            <Stat label="성공률" value={`${summary.successRate}%`} sub={`성공 ${fmtNum(summary.success)}건`} />
            <Stat label="실패 · 반송" value={`${fmtNum(summary.failed)} · ${fmtNum(summary.bounced)}`} sub={`수신거부 제외 ${fmtNum(summary.skipped)}건`} />
            <Stat label="총 비용" value={fmtWon(summary.totalCost)} />
            <Stat label="신규 수신거부" value={fmtNum(summary.newUnsubscribes)} />
          </div>
          <section className="card">
            <h2 className="mb-3 font-semibold">일별 발송 추이</h2>
            {series.every((d) => d.SUCCESS + d.FAILED + d.BOUNCED === 0) ? <p className="text-sm text-muted-foreground">기간 내 발송 내역이 없습니다.</p> : <DailyChart data={series} />}
          </section>
          {summary.byChannel.length > 0 && (
            <section className="card">
              <h2 className="mb-3 font-semibold">채널별</h2>
              <table className="table-base">
                <thead><tr><th>채널</th><th className="text-right">발송</th><th className="text-right">성공</th><th className="text-right">성공률</th></tr></thead>
                <tbody>
                  {summary.byChannel.map((c) => (
                    <tr key={c.channel}><td>{CHANNEL_LABEL[c.channel]}</td><td className="text-right tabular-nums">{fmtNum(c.count)}</td><td className="text-right tabular-nums">{fmtNum(c.success)}</td><td className="text-right tabular-nums">{c.count ? Math.round((c.success / c.count) * 1000) / 10 : 0}%</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
      <section className="card">
        <h2 className="mb-3 font-semibold">캠페인별 결과</h2>
        {campaigns.length === 0 ? <EmptyState title="캠페인이 없습니다." /> : (
          <div className="overflow-x-auto">
            <table className="table-base" aria-label="캠페인별 결과">
              <thead><tr><th>캠페인</th><th>채널</th><th>상태</th><th className="text-right">발송</th><th className="text-right">성공/실패</th><th className="text-right">비용</th><th>일시</th></tr></thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td><Link className="text-primary hover:underline" href={`/analytics/campaigns/${c.id}`}>{c.campaignName}</Link></td>
                    <td>{CHANNEL_LABEL[c.channel]}</td>
                    <td><Badge tone={statusTone(c.status)}>{STATUS_LABEL[c.status]}</Badge></td>
                    <td className="text-right tabular-nums">{fmtNum(c.totalMessages)}</td>
                    <td className="text-right tabular-nums">{fmtNum(c.sentCount)} / {fmtNum(c.failedCount)}</td>
                    <td className="text-right tabular-nums">{fmtWon(c.totalCost)}</td>
                    <td className="whitespace-nowrap text-xs">{fmtDate(c.createdAt)}</td>
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
