import { Types } from 'mongoose';
import { ok, withAuth } from '@/lib/api';
import { buildContactFilter, toListItem } from '@/lib/contacts/queries';
import { Contact, type ContactDoc } from '@/lib/db/models/Contact';
import { Suppression } from '@/lib/db/models/Suppression';
import { suppressedForContacts } from '@/lib/unsubscribe/service';

/** 연락처 목록 — 커서(_id) 기반 페이지네이션 */
export const GET = withAuth(async (req, _ctx, user) => {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get('limit') ?? 50) || 50, 1), 200);
  const unsubParam = sp.get('unsub');
  let suppressedValues: { phones: string[]; emails: string[] } | undefined;
  if (unsubParam === 'only') {
    const [phones, emails] = await Promise.all([
      Suppression.distinct('value', { userId: user.oid, channel: { $in: ['SMS', 'KAKAO'] } }),
      Suppression.distinct('value', { userId: user.oid, channel: 'EMAIL' }),
    ]);
    suppressedValues = { phones: phones as string[], emails: emails as string[] };
  }
  const filter = buildContactFilter(user.oid, {
    q: sp.get('q') ?? '',
    sourceNames: sp.getAll('sourceName').filter(Boolean),
    labels: sp.getAll('label').filter(Boolean),
    unsub: unsubParam === 'exclude' || unsubParam === 'only' ? unsubParam : 'all',
    suppressedValues,
  });
  const total = await Contact.countDocuments(filter);
  const cursor = sp.get('cursor');
  const pageFilter = cursor && Types.ObjectId.isValid(cursor) ? { ...filter, _id: { $lt: new Types.ObjectId(cursor) } } : filter;
  const docs = (await Contact.find(pageFilter).sort({ _id: -1 }).limit(limit + 1).lean()) as ContactDoc[];
  const hasMore = docs.length > limit;
  const items = docs.slice(0, limit);
  const suppressed = await suppressedForContacts(user.oid, items);
  return ok({
    items: items.map((c) => toListItem(c, suppressed)),
    total,
    nextCursor: hasMore ? String(items[items.length - 1]._id) : null,
  });
});

/** 연락처 일괄/전체 삭제 */
export const DELETE = withAuth(async (req, _ctx, user) => {
  const sp = req.nextUrl.searchParams;
  const all = sp.get('all') === 'true';
  const ids = sp.getAll('id').filter((id) => Types.ObjectId.isValid(id));

  let filter: Record<string, unknown>;
  if (ids.length > 0) {
    const oids = ids.map((id) => new Types.ObjectId(id));
    filter = { _id: { $in: oids }, userId: user.oid };
  } else if (all) {
    filter = { userId: user.oid };
  } else {
    const unsubParam = sp.get('unsub');
    let suppressedValues: { phones: string[]; emails: string[] } | undefined;
    if (unsubParam === 'only') {
      const [phones, emails] = await Promise.all([
        Suppression.distinct('value', { userId: user.oid, channel: { $in: ['SMS', 'KAKAO'] } }),
        Suppression.distinct('value', { userId: user.oid, channel: 'EMAIL' }),
      ]);
      suppressedValues = { phones: phones as string[], emails: emails as string[] };
    }
    filter = buildContactFilter(user.oid, {
      q: sp.get('q') ?? '',
      sourceNames: sp.getAll('sourceName').filter(Boolean),
      labels: sp.getAll('label').filter(Boolean),
      unsub: unsubParam === 'exclude' || unsubParam === 'only' ? unsubParam : 'all',
      suppressedValues,
    });
  }

  const res = await Contact.deleteMany(filter);
  return ok({ deletedCount: res.deletedCount });
});
