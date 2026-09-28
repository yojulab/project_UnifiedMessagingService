import { AppError, notFound, ok, toObjectId, withAuth } from '@/lib/api';
import { DispatchJob } from '@/lib/db/models/DispatchJob';

type Ctx = { params: Promise<{ id: string }> };

/** 대기/예약/발송중 캠페인 취소 (발송중이면 다음 청크부터 중단) */
export const POST = withAuth<Ctx>(async (_req, ctx, user) => {
  const id = toObjectId((await ctx.params).id, '캠페인');
  const res = await DispatchJob.updateOne(
    { _id: id, userId: user.oid, status: { $in: ['PENDING', 'SENDING', 'DRAFT'] } },
    { $set: { status: 'CANCELLED', completedAt: new Date() } },
  );
  if (res.matchedCount === 0) {
    const exists = await DispatchJob.exists({ _id: id, userId: user.oid });
    if (!exists) throw notFound('캠페인');
    throw new AppError(409, 'NOT_CANCELLABLE', '이미 완료된 캠페인은 취소할 수 없습니다.');
  }
  return ok({ cancelled: true });
});
