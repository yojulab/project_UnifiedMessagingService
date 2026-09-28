import { ok, withAuth } from '@/lib/api';
import { Contact } from '@/lib/db/models/Contact';
import { DispatchJob } from '@/lib/db/models/DispatchJob';
import { DispatchLog } from '@/lib/db/models/DispatchLog';
import { Suppression } from '@/lib/db/models/Suppression';
import { parseRange } from '@/lib/analytics';

export const GET = withAuth(async (req, _ctx, user) => {
  const { from, to } = parseRange(req.nextUrl.searchParams);
  const [byResult, byChannel, campaigns, newUnsub] = await Promise.all([
    DispatchLog.aggregate<{ _id: string; count: number; cost: number }>([
      { $match: { userId: user.oid, sentAt: { $gte: from, $lt: to } } },
      { $group: { _id: '$resultCode', count: { $sum: 1 }, cost: { $sum: '$unitCost' } } },
    ]),
    DispatchLog.aggregate<{ _id: string; count: number; success: number }>([
      { $match: { userId: user.oid, sentAt: { $gte: from, $lt: to }, resultCode: { $ne: 'SKIPPED' } } },
      { $group: { _id: '$channel', count: { $sum: 1 }, success: { $sum: { $cond: [{ $eq: ['$resultCode', 'SUCCESS'] }, 1, 0] } } } },
      { $sort: { count: -1, _id: 1 } },
    ]),
    DispatchJob.countDocuments({ userId: user.oid, createdAt: { $gte: from, $lt: to } }),
    Promise.all([
      Suppression.countDocuments({ userId: user.oid, at: { $gte: from, $lt: to } }),
      Contact.countDocuments({ userId: user.oid, isUnsubscribed: true, unsubscribedAt: { $gte: from, $lt: to } }),
    ]).then(([v, c]) => v + c),
  ]);
  const r = Object.fromEntries(byResult.map((x) => [x._id, x]));
  const success = r.SUCCESS?.count ?? 0;
  const failed = r.FAILED?.count ?? 0;
  const bounced = r.BOUNCED?.count ?? 0;
  const attempted = success + failed + bounced;
  return ok({
    from, to,
    campaigns,
    attempted,
    success,
    failed,
    bounced,
    skipped: r.SKIPPED?.count ?? 0,
    successRate: attempted ? Math.round((success / attempted) * 1000) / 10 : 0,
    totalCost: r.SUCCESS?.cost ?? 0,
    newUnsubscribes: newUnsub,
    byChannel: byChannel.map((c) => ({ channel: c._id, count: c.count, success: c.success })),
  });
});
