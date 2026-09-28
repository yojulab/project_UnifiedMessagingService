import { ok, toObjectId, withAuth } from '@/lib/api';
import { DispatchJob } from '@/lib/db/models/DispatchJob';
import { DispatchLog } from '@/lib/db/models/DispatchLog';

type Ctx = { params: Promise<{ id: string }> };

/** 연락처 발송 이력 타임라인 */
export const GET = withAuth<Ctx>(async (_req, ctx, user) => {
  const contactId = toObjectId((await ctx.params).id, '연락처');
  const logs = await DispatchLog.find({ userId: user.oid, contactId }).sort({ sentAt: -1, createdAt: -1 }).limit(100).lean();
  const jobIds = [...new Set(logs.map((l) => String(l.dispatchJobId)))];
  const jobs = await DispatchJob.find({ userId: user.oid, _id: { $in: jobIds } }, { campaignName: 1 }).lean();
  const names = Object.fromEntries(jobs.map((j) => [String(j._id), j.campaignName]));
  return ok(
    logs.map((l) => ({
      id: String(l._id),
      campaignId: String(l.dispatchJobId),
      campaignName: names[String(l.dispatchJobId)] ?? '',
      channel: l.channel,
      recipient: l.recipient,
      subject: l.subject,
      bodyPreview: l.bodyPreview,
      resultCode: l.resultCode,
      errorMessage: l.errorMessage,
      sentAt: l.sentAt ?? l.createdAt,
    })),
  );
});
