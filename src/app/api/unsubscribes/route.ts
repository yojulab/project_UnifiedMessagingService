import { z } from 'zod';
import { ok, parseBody, withAuth } from '@/lib/api';
import { csvResponse } from '@/lib/csv';
import { Contact } from '@/lib/db/models/Contact';
import { Suppression } from '@/lib/db/models/Suppression';
import { unsuppress } from '@/lib/unsubscribe/service';
import { formatPhone, normalizeEmail, normalizePhone } from '@/lib/validators/contactNormalizer';
import { UNSUB_CHANNELS, UNSUB_REASONS } from '@/types';

interface Row {
  kind: 'VALUE' | 'CONTACT';
  contactId: string | null;
  name: string;
  value: string;
  channel: string;
  reason: string;
  at: Date | null;
}

/** 수신거부 목록 — 억제 목록(번호/이메일 단위) + 연락처 전체 거부. ?format=csv 로 내보내기 */
export const GET = withAuth(async (req, _ctx, user) => {
  const sp = req.nextUrl.searchParams;
  const channel = sp.get('channel');
  const reason = sp.get('reason');
  const filter: Record<string, unknown> = { userId: user.oid };
  if (channel && (UNSUB_CHANNELS as readonly string[]).includes(channel)) filter.channel = channel;
  if (reason && (UNSUB_REASONS as readonly string[]).includes(reason)) filter.reason = reason;

  const sups = await Suppression.find(filter).sort({ at: -1 }).limit(5000).lean();
  const values = sups.map((s) => s.value);
  const contacts = values.length
    ? await Contact.find({ userId: user.oid, $or: [{ phones: { $in: values } }, { emails: { $in: values } }] }, { name: 1, phones: 1, emails: 1 }).lean()
    : [];
  const owner = new Map<string, { id: string; names: string[] }>();
  for (const c of contacts) {
    for (const v of [...(c.phones ?? []), ...(c.emails ?? [])]) {
      const o = owner.get(v) ?? { id: String(c._id), names: [] };
      o.names.push(c.name);
      owner.set(v, o);
    }
  }
  const rows: Row[] = sups.map((s) => ({
    kind: 'VALUE',
    contactId: owner.get(s.value)?.id ?? null,
    name: owner.get(s.value)?.names.join(', ') || '(연락처 없음)',
    value: s.value,
    channel: s.channel,
    reason: s.reason,
    at: s.at ?? null,
  }));
  if (!channel && (!reason || reason === 'MANUAL')) {
    const whole = await Contact.find({ userId: user.oid, isUnsubscribed: true }, { name: 1, unsubscribedAt: 1 }).lean();
    rows.push(...whole.map((c): Row => ({ kind: 'CONTACT', contactId: String(c._id), name: c.name, value: '(연락처 전체)', channel: 'ALL', reason: 'MANUAL', at: c.unsubscribedAt ?? null })));
    rows.sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0));
  }
  const display = (r: Row): string => (r.channel === 'SMS' || r.channel === 'KAKAO' ? formatPhone(r.value) : r.value);

  if (sp.get('format') === 'csv') {
    async function* gen(): AsyncGenerator<unknown[]> {
      for (const r of rows) yield [r.name, display(r), r.channel, r.reason, r.at];
    }
    return csvResponse('수신거부목록.csv', ['이름', '번호/이메일', '채널', '사유', '일시'], gen());
  }
  return ok(rows.map((r) => ({ ...r, display: display(r) })));
});

const ReleaseSchema = z.object({ channel: z.enum(UNSUB_CHANNELS), value: z.string().min(1) });

/** 번호/이메일 단위 수신거부 해제 (관리자) */
export const DELETE = withAuth(async (req, _ctx, user) => {
  const input = await parseBody(req, ReleaseSchema);
  const value = input.channel === 'EMAIL' ? normalizeEmail(input.value) : normalizePhone(input.value);
  return ok({ released: value ? await unsuppress(user.oid, input.channel, value) : false });
});
