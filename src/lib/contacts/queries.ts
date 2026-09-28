import type { Types } from 'mongoose';
import { formatPhone } from '@/lib/validators/contactNormalizer';
import { isRecipientBlocked, suppressionKey, type SuppressedSet } from '@/lib/unsubscribe/isBlocked';
import type { ContactDoc } from '@/lib/db/models/Contact';

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface ContactFilterInput {
  q?: string;
  sourceNames?: string[];
  labels?: string[];
  /** exclude: 전체 수신거부 제외, only: 수신거부(전체/일부) 연락처만 */
  unsub?: 'all' | 'exclude' | 'only';
  /** unsub=only 일 때 억제 목록의 번호/이메일 값 */
  suppressedValues?: { phones: string[]; emails: string[] };
}

/** 테넌트 필터가 항상 포함된 연락처 쿼리 조건 */
export function buildContactFilter(userId: Types.ObjectId, f: ContactFilterInput): Record<string, unknown> {
  const filter: Record<string, unknown> = { userId };
  const and: Record<string, unknown>[] = [];
  const q = f.q?.trim();
  if (q) {
    const or: Record<string, unknown>[] = [];
    const rx = new RegExp(escapeRegex(q), 'i');
    or.push({ name: rx }, { company: rx }, { department: rx }, { labels: rx });
    const digits = q.replace(/\D/g, '');
    if (digits.length >= 3 && /^[\d\s\-+()]+$/.test(q)) or.push({ phones: new RegExp(escapeRegex(digits)) });
    if (q.includes('@') || /^[\w.+-]+$/.test(q)) or.push({ emails: new RegExp(escapeRegex(q.toLowerCase())) });
    and.push({ $or: or });
  }
  if (f.sourceNames?.length) filter.sourceName = { $in: f.sourceNames };
  if (f.labels?.length) filter.labels = { $in: f.labels };
  if (f.unsub === 'exclude') filter.isUnsubscribed = false;
  if (f.unsub === 'only') {
    and.push({
      $or: [
        { isUnsubscribed: true },
        { 'unsubscribedChannels.0': { $exists: true } },
        { phones: { $in: f.suppressedValues?.phones ?? [] } },
        { emails: { $in: f.suppressedValues?.emails ?? [] } },
      ],
    });
  }
  if (and.length) filter.$and = and;
  return filter;
}

export function unsubSummary(c: ContactDoc, suppressed: SuppressedSet): 'ALL' | 'PARTIAL' | 'NONE' {
  if (c.isUnsubscribed) return 'ALL';
  if ((c.unsubscribedChannels?.length ?? 0) > 0) return 'PARTIAL';
  const blocked = [...(c.phones ?? []).map((p) => suppressionKey('SMS', p)), ...(c.emails ?? []).map((e) => suppressionKey('EMAIL', e))];
  return blocked.some((k) => suppressed.has(k)) ? 'PARTIAL' : 'NONE';
}

export function toListItem(c: ContactDoc, suppressed: SuppressedSet): Record<string, unknown> {
  return {
    id: String(c._id),
    name: c.name,
    primaryPhone: c.phones?.[0] ? formatPhone(c.phones[0]) : '',
    primaryEmail: c.emails?.[0] ?? '',
    phoneCount: c.phones?.length ?? 0,
    emailCount: c.emails?.length ?? 0,
    company: c.company ?? '',
    sourceName: c.sourceName ?? '',
    labels: c.labels ?? [],
    unsubscribe: unsubSummary(c, suppressed),
  };
}

export interface SuppressionInfo {
  channel: string;
  value: string;
  reason: string;
  at: Date;
}

export function toDetail(
  c: ContactDoc & { createdAt?: Date; updatedAt?: Date },
  suppressed: SuppressedSet,
  suppressions: SuppressionInfo[],
): Record<string, unknown> {
  const reasonOf = (channel: string, value: string): string | null =>
    suppressions.find((s) => s.channel === channel && s.value === value)?.reason ?? null;
  const own = { isUnsubscribed: false, unsubscribedChannels: c.unsubscribedChannels };
  return {
    ...toListItem(c, suppressed),
    department: c.department ?? '',
    notes: c.notes ?? '',
    customFields: c.customFields ?? {},
    isUnsubscribed: Boolean(c.isUnsubscribed),
    unsubscribedAt: c.unsubscribedAt ?? null,
    phones: (c.phones ?? []).map((p) => ({
      value: p,
      display: formatPhone(p),
      smsBlocked: isRecipientBlocked(own, 'SMS', p, suppressed),
      reason: reasonOf('SMS', p),
    })),
    emails: (c.emails ?? []).map((e) => ({
      value: e,
      display: e,
      emailBlocked: isRecipientBlocked(own, 'EMAIL', e, suppressed),
      reason: reasonOf('EMAIL', e),
    })),
    createdAt: c.createdAt ?? null,
    updatedAt: c.updatedAt ?? null,
  };
}
