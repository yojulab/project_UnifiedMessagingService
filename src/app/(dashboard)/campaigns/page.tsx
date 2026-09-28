'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Alert, EmptyState, PageHeader, Skeleton } from '@/components/ui/Feedback';
import { api, errMsg } from '@/lib/client/api';
import { CHANNEL_LABEL, STATUS_LABEL, fmtDate, fmtNum, fmtWon } from '@/lib/client/format';

interface Campaign {
  id: string; campaignName: string; channel: string; provider: string; status: string; scheduledAt: string | null;
  totalTargets: number; totalMessages: number; sentCount: number; failedCount: number; skippedCount: number; totalCost: number; createdAt: string;
}

export default function CampaignsPage(): ReactElement {
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = (): void => void api<Campaign[]>('/api/campaigns').then(setItems).catch((e: unknown) => setError(errMsg(e)));
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <PageHeader title="캠페인 발송" description="발송 캠페인 목록" actions={<Link href="/campaigns/new" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">새 캠페인</Link>} />
      {error && <Alert tone="error">{error}</Alert>}
      {!items && !error && <Skeleton rows={5} />}
      {items && items.length === 0 && <EmptyState title="캠페인이 없습니다.">‘새 캠페인’으로 첫 메시지를 발송하세요.</EmptyState>}
      {items && items.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="table-base" aria-label="캠페인 목록">
            <thead>
              <tr><th>캠페인</th><th>채널</th><th>상태</th><th className="text-right">대상/건수</th><th className="text-right">성공/실패</th><th className="text-right">비용</th><th>일시</th></tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const done = c.sentCount + c.failedCount + c.skippedCount;
                return (
                  <tr key={c.id}>
                    <td><Link href={`/analytics/campaigns/${c.id}`} className="font-medium text-primary hover:underline">{c.campaignName}</Link></td>
                    <td>{CHANNEL_LABEL[c.channel]}<span className="ml-1 text-xs text-muted-foreground">{c.provider}</span></td>
                    <td>
                      <Badge tone={statusTone(c.status)}>{STATUS_LABEL[c.status]}</Badge>
                      {c.status === 'SENDING' && <span className="ml-2 text-xs text-muted-foreground">{Math.round((done / Math.max(c.totalMessages, 1)) * 100)}%</span>}
                    </td>
                    <td className="text-right tabular-nums">{fmtNum(c.totalTargets)}명 / {fmtNum(c.totalMessages)}건</td>
                    <td className="text-right tabular-nums">{fmtNum(c.sentCount)} / {fmtNum(c.failedCount)}</td>
                    <td className="text-right tabular-nums">{fmtWon(c.totalCost)}</td>
                    <td className="whitespace-nowrap text-xs">{c.scheduledAt && c.status === 'PENDING' ? `예약 ${fmtDate(c.scheduledAt)}` : fmtDate(c.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
