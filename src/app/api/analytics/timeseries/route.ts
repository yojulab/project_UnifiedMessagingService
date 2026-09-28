import { ok, withAuth } from '@/lib/api';
import { parseRange } from '@/lib/analytics';
import { DispatchLog } from '@/lib/db/models/DispatchLog';

/** 일별(KST) 발송 추이 — 결과별 건수 */
export const GET = withAuth(async (req, _ctx, user) => {
  const { from, to } = parseRange(req.nextUrl.searchParams);
  const channel = req.nextUrl.searchParams.get('channel');
  const match: Record<string, unknown> = { userId: user.oid, sentAt: { $gte: from, $lt: to }, resultCode: { $in: ['SUCCESS', 'FAILED', 'BOUNCED'] } };
  if (channel) match.channel = channel;
  const rows = await DispatchLog.aggregate<{ _id: { day: string; rc: string }; count: number }>([
    { $match: match },
    {
      $group: {
        _id: { day: { $dateToString: { date: '$sentAt', format: '%Y-%m-%d', timezone: 'Asia/Seoul' } }, rc: '$resultCode' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.day': 1 } },
  ]);
  const days = new Map<string, { day: string; SUCCESS: number; FAILED: number; BOUNCED: number }>();
  for (const r of rows) {
    const d = days.get(r._id.day) ?? { day: r._id.day, SUCCESS: 0, FAILED: 0, BOUNCED: 0 };
    d[r._id.rc as 'SUCCESS' | 'FAILED' | 'BOUNCED'] += r.count;
    days.set(r._id.day, d);
  }
  // 기간 내 발송이 없는 날도 0 으로 채워 추이를 왜곡 없이 보여준다 (최대 366일)
  const kstDay = (d: Date): string => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
  const filled: { day: string; SUCCESS: number; FAILED: number; BOUNCED: number }[] = [];
  for (let t = from.getTime(); t < to.getTime() && filled.length < 366; t += 86_400_000) {
    const day = kstDay(new Date(t));
    if (filled.at(-1)?.day === day) continue;
    filled.push(days.get(day) ?? { day, SUCCESS: 0, FAILED: 0, BOUNCED: 0 });
  }
  return ok(filled);
});
