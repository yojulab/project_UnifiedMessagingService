import { ok, withAuth } from '@/lib/api';
import { Contact } from '@/lib/db/models/Contact';

/** 필터용 출처 파일명 / 라벨 목록 */
export const GET = withAuth(async (_req, _ctx, user) => {
  const [sourceNames, labels, total, unsubscribed] = await Promise.all([
    Contact.distinct('sourceName', { userId: user.oid }),
    Contact.distinct('labels', { userId: user.oid }),
    Contact.countDocuments({ userId: user.oid }),
    Contact.countDocuments({ userId: user.oid, isUnsubscribed: true }),
  ]);
  return ok({
    sourceNames: (sourceNames as string[]).filter(Boolean).sort(),
    labels: (labels as string[]).filter(Boolean).sort(),
    total,
    unsubscribed,
  });
});
