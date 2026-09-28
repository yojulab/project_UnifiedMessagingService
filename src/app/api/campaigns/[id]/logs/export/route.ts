import { notFound, toObjectId, withAuth } from '@/lib/api';
import { csvResponse } from '@/lib/csv';
import { DispatchJob } from '@/lib/db/models/DispatchJob';
import { DispatchLog } from '@/lib/db/models/DispatchLog';
import { buildLogFilter } from '@/lib/dispatch/logQuery';
import { formatPhone } from '@/lib/validators/contactNormalizer';

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth<Ctx>(async (req, ctx, user) => {
  const jobId = toObjectId((await ctx.params).id, '캠페인');
  const job = await DispatchJob.findOne({ _id: jobId, userId: user.oid }, { campaignName: 1 }).lean();
  if (!job) throw notFound('캠페인');
  const filter = buildLogFilter(user.oid, jobId, req.nextUrl.searchParams);
  async function* rows(): AsyncGenerator<unknown[]> {
    for await (const l of DispatchLog.find(filter).sort({ _id: 1 }).lean().cursor()) {
      const recipient = l.channel === 'EMAIL' ? l.recipient : formatPhone(l.recipient);
      yield [l.contactName, recipient, l.channel, l.provider, l.resultCode, l.errorMessage, l.unitCost, l.isFallback ? 'Y' : '', l.sentAt, l.messageId];
    }
  }
  return csvResponse(
    `${job.campaignName}_발송로그.csv`,
    ['이름', '수신자', '채널', '공급사', '결과', '오류', '단가', 'LMS대체', '발송시각', '메시지ID'],
    rows(),
  );
});
