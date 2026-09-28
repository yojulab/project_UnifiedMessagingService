import { notFound, ok, toObjectId, withAuth } from '@/lib/api';
import { DispatchJob, type DispatchJobDoc } from '@/lib/db/models/DispatchJob';
import { DispatchLog } from '@/lib/db/models/DispatchLog';
import { PlatformConfig } from '@/lib/db/models/PlatformConfig';
import { jobSummary } from '@/lib/dispatch/views';

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth<Ctx>(async (_req, ctx, user) => {
  const id = toObjectId((await ctx.params).id, '캠페인');
  const job = (await DispatchJob.findOne({ _id: id, userId: user.oid }, { targetContactIds: 0 }).lean()) as DispatchJobDoc | null;
  if (!job) throw notFound('캠페인');
  const [breakdown, byChannel, platform] = await Promise.all([
    DispatchLog.aggregate<{ _id: string; count: number; cost: number }>([
      { $match: { userId: user.oid, dispatchJobId: id } },
      { $group: { _id: '$resultCode', count: { $sum: 1 }, cost: { $sum: '$unitCost' } } },
    ]),
    DispatchLog.aggregate<{ _id: string; count: number }>([
      { $match: { userId: user.oid, dispatchJobId: id } },
      { $group: { _id: '$channel', count: { $sum: 1 } } },
    ]),
    PlatformConfig.findOne({ _id: job.platformConfigId, userId: user.oid }, { name: 1 }).lean(),
  ]);
  return ok({
    ...jobSummary(job),
    platformName: platform?.name ?? '',
    targetFilter: job.targetFilter,
    messageTemplate: job.messageTemplate,
    results: Object.fromEntries(breakdown.map((b) => [b._id, { count: b.count, cost: b.cost }])),
    channels: Object.fromEntries(byChannel.map((b) => [b._id, b.count])),
  });
});
