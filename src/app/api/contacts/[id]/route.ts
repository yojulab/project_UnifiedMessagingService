import { z } from 'zod';
import { notFound, ok, parseBody, toObjectId, withAuth } from '@/lib/api';
import { toDetail } from '@/lib/contacts/queries';
import type { Types } from 'mongoose';
import { Contact, type ContactDoc } from '@/lib/db/models/Contact';
import { Suppression } from '@/lib/db/models/Suppression';
import { suppress, unsuppress } from '@/lib/unsubscribe/service';
import { normalizeEmail, normalizeMany, normalizePhone } from '@/lib/validators/contactNormalizer';
import { UNSUB_CHANNELS } from '@/types';

type Ctx = { params: Promise<{ id: string }> };

async function detailOf(userId: Types.ObjectId, doc: ContactDoc): Promise<Record<string, unknown>> {
  const values = [...(doc.phones ?? []), ...(doc.emails ?? [])];
  const rows = await Suppression.find({ userId, value: { $in: values } }, { channel: 1, value: 1, reason: 1, at: 1 }).lean();
  const set = new Set(rows.map((r) => `${r.channel}:${r.value}`));
  return toDetail(doc, set, rows.map((r) => ({ channel: r.channel, value: r.value, reason: r.reason, at: r.at })));
}

export const GET = withAuth<Ctx>(async (_req, ctx, user) => {
  const id = toObjectId((await ctx.params).id, '연락처');
  const doc = (await Contact.findOne({ _id: id, userId: user.oid }).lean()) as ContactDoc | null;
  if (!doc) throw notFound('연락처');
  return ok(await detailOf(user.oid, doc));
});

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  company: z.string().trim().max(200).optional(),
  department: z.string().trim().max(200).optional(),
  notes: z.string().max(5000).optional(),
  labels: z.array(z.string().trim().min(1).max(50)).max(50).optional(),
  phones: z.array(z.string()).max(20).optional(),
  emails: z.array(z.string()).max(20).optional(),
  /** 연락처 전체 수신거부 토글 */
  unsubscribeAll: z.boolean().optional(),
  /** 번호/이메일 단위 수신거부 등록·해제 */
  recipient: z
    .object({ action: z.enum(['block', 'unblock']), channel: z.enum(UNSUB_CHANNELS), value: z.string().min(1) })
    .optional(),
});

export const PATCH = withAuth<Ctx>(async (req, ctx, user) => {
  const id = toObjectId((await ctx.params).id, '연락처');
  const input = await parseBody(req, PatchSchema);
  const filter = { _id: id, userId: user.oid };
  const exists = await Contact.exists(filter);
  if (!exists) throw notFound('연락처');

  const set: Record<string, unknown> = {};
  for (const k of ['name', 'company', 'department', 'notes', 'labels'] as const) {
    if (input[k] !== undefined) set[k] = input[k];
  }
  if (input.phones) set.phones = normalizeMany(input.phones, normalizePhone).valid;
  if (input.emails) set.emails = normalizeMany(input.emails, normalizeEmail).valid;
  if (input.unsubscribeAll !== undefined) {
    set.isUnsubscribed = input.unsubscribeAll;
    set.unsubscribedAt = input.unsubscribeAll ? new Date() : null;
  }
  if (Object.keys(set).length) await Contact.updateOne(filter, { $set: set });

  if (input.recipient) {
    const { action, channel, value } = input.recipient;
    const v = channel === 'EMAIL' ? normalizeEmail(value) : normalizePhone(value);
    if (v) {
      if (action === 'block') await suppress(user.oid, channel, [v], 'MANUAL', id);
      else await unsuppress(user.oid, channel, v);
    }
  }
  const doc = (await Contact.findOne(filter).lean()) as ContactDoc;
  return ok(await detailOf(user.oid, doc));
});

export const DELETE = withAuth<Ctx>(async (_req, ctx, user) => {
  const id = toObjectId((await ctx.params).id, '연락처');
  const res = await Contact.deleteOne({ _id: id, userId: user.oid });
  if (res.deletedCount === 0) throw notFound('연락처');
  return ok({ deleted: true });
});
