'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Alert, PageHeader, Skeleton, Stat } from '@/components/ui/Feedback';
import { api, errMsg } from '@/lib/client/api';
import { CHANNEL_LABEL, STATUS_LABEL, fmtDate, fmtNum, fmtWon } from '@/lib/client/format';

interface Summary { attempted: number; success: number; failed: number; bounced: number; successRate: number; totalCost: number; newUnsubscribes: number; campaigns: number }
interface Facets { total: number; unsubscribed: number }
interface Campaign { id: string; campaignName: string; channel: string; status: string; totalMessages: number; sentCount: number; failedCount: number; createdAt: string }
interface Platform { id: string; status: string }

export default function DashboardPage(): ReactElement {
  const [data, setData] = useState<{ summary: Summary; facets: Facets; campaigns: Campaign[]; platforms: Platform[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Summary>('/api/analytics/summary'),
      api<Facets>('/api/contacts/facets'),
      api<Campaign[]>('/api/campaigns'),
      api<Platform[]>('/api/platform-configs'),
    ])
      .then(([summary, facets, campaigns, platforms]) => setData({ summary, facets, campaigns: campaigns.slice(0, 5), platforms }))
      .catch((e: unknown) => setError(errMsg(e)));
  }, []);

  const steps = data
    ? [
        { done: data.platforms.some((p) => p.status === 'ACTIVE'), label: '발송 플랫폼 연동', href: '/platform-config' },
        { done: data.facets.total > 0, label: '연락처 업로드', href: '/contacts/upload' },
        { done: data.campaigns.length > 0, label: '첫 캠페인 발송', href: '/campaigns/new' },
      ]
    : [];

  return (
    <div>
      <PageHeader title="대시보드" description="최근 30일 발송 현황" actions={<Link href="/campaigns/new" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">새 캠페인</Link>} />
      {error && <Alert tone="error">{error}</Alert>}
      {!data && !error && <Skeleton rows={4} />}
      {data && (
        <div className="space-y-6">
          {steps.some((s) => !s.done) && (
            <section className="card" aria-label="시작하기">
              <h2 className="mb-3 font-semibold">시작하기</h2>
              <ol className="grid gap-2 sm:grid-cols-3">
                {steps.map((s, i) => (
                  <li key={s.href}>
                    <Link href={s.href} className={`flex items-center gap-2 rounded-md border p-3 text-sm ${s.done ? 'border-success/40 text-muted-foreground line-through' : 'border-border hover:bg-muted'}`}>
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${s.done ? 'bg-success text-white' : 'bg-primary text-primary-foreground'}`}>{s.done ? '✓' : i + 1}</span>
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Stat label="총 연락처" value={fmtNum(data.facets.total)} sub={`전체 수신거부 ${fmtNum(data.facets.unsubscribed)}명`} />
            <Stat label="발송 건수" value={fmtNum(data.summary.attempted)} sub={`캠페인 ${fmtNum(data.summary.campaigns)}건`} />
            <Stat label="성공률" value={`${data.summary.successRate}%`} sub={`성공 ${fmtNum(data.summary.success)}건`} />
            <Stat label="실패 · 반송" value={fmtNum(data.summary.failed + data.summary.bounced)} />
            <Stat label="발송 비용" value={fmtWon(data.summary.totalCost)} sub={`신규 수신거부 ${fmtNum(data.summary.newUnsubscribes)}`} />
          </div>
          <section className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">최근 캠페인</h2>
              <Link href="/campaigns" className="text-sm text-primary hover:underline">전체 보기</Link>
            </div>
            {data.campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">아직 발송한 캠페인이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead><tr><th>캠페인</th><th>채널</th><th>상태</th><th className="text-right">성공/실패</th><th>생성</th></tr></thead>
                  <tbody>
                    {data.campaigns.map((c) => (
                      <tr key={c.id}>
                        <td><Link href={`/analytics/campaigns/${c.id}`} className="text-primary hover:underline">{c.campaignName}</Link></td>
                        <td>{CHANNEL_LABEL[c.channel]}</td>
                        <td><Badge tone={statusTone(c.status)}>{STATUS_LABEL[c.status]}</Badge></td>
                        <td className="text-right tabular-nums">{fmtNum(c.sentCount)} / {fmtNum(c.failedCount)}</td>
                        <td>{fmtDate(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
