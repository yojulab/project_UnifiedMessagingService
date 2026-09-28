import { Types } from 'mongoose';
import { notFound, ok, toObjectId, withAuth } from '@/lib/api';
import { DispatchJob } from '@/lib/db/models/DispatchJob';
import { DispatchLog } from '@/lib/db/models/DispatchLog';
import { buildLogFilter } from '@/lib/dispatch/logQuery';

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth<Ctx>(async (req, ctx, user) => {
  const jobId = toObjectId((await ctx.params).id, '캠페인');
  if (!(await DispatchJob.exists({ _id: jobId, userId: user.oid }))) throw notFound('캠페인');
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get('limit') ?? 50) || 50, 1), 200);
  const filter = buildLogFilter(user.oid, jobId, sp);
  const total = await DispatchLog.countDocuments(filter);
  const cursor = sp.get('cursor');
  const pageFilter = cursor && Types.ObjectId.isValid(cursor) ? { ...filter, _id: { $lt: new Types.ObjectId(cursor) } } : filter;
  const docs = await DispatchLog.find(pageFilter).sort({ _id: -1 }).limit(limit + 1).lean();
  const hasMore = docs.length > limit;
  const items = docs.slice(0, limit);
  return ok({
    total,
    nextCursor: hasMore ? String(items[items.length - 1]._id) : null,
    items: items.map((l) => ({
      id: String(l._id),
      contactId: String(l.contactId),
      contactName: l.contactName,
      channel: l.channel,
      provider: l.provider,
      recipient: l.recipient,
      subject: l.subject,
      bodyPreview: l.bodyPreview,
      resultCode: l.resultCode,
      messageId: l.messageId,
      errorMessage: l.errorMessage,
      isFallback: l.isFallback,
      unitCost: l.unitCost,
      sentAt: l.sentAt,
      dryRunPayload: (l.providerResponse as { dryRunPayload?: unknown } | null)?.dryRunPayload ?? null,
    })),
  });
});
