import crypto from 'node:crypto';
import { baseUrl } from '@/lib/baseUrl';
import type { Types } from 'mongoose';
import { Contact } from '@/lib/db/models/Contact';
import { Suppression } from '@/lib/db/models/Suppression';
import { suppressionKey } from './isBlocked';
import type { UnsubChannel, UnsubReason } from '@/types';

/** 억제 목록에 등록 (멱등). 연락처 존재 여부와 무관하게 저장한다. */
export async function suppress(
  userId: Types.ObjectId,
  channel: UnsubChannel,
  values: string[],
  reason: UnsubReason,
  contactId: Types.ObjectId | null = null,
): Promise<number> {
  const uniq = [...new Set(values.filter(Boolean))];
  if (uniq.length === 0) return 0;
  const now = new Date();
  let inserted = 0;
  for (let i = 0; i < uniq.length; i += 1000) {
    const res = await Suppression.bulkWrite(
      uniq.slice(i, i + 1000).map((value) => ({
        updateOne: {
          filter: { userId, channel, value },
          update: { $setOnInsert: { userId, channel, value, reason, contactId, at: now } },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    inserted += res.upsertedCount;
  }
  return inserted;
}

export async function unsuppress(userId: Types.ObjectId, channel: UnsubChannel, value: string): Promise<boolean> {
  const res = await Suppression.deleteOne({ userId, channel, value });
  return res.deletedCount > 0;
}

/** 주어진 값들 중 억제된 것의 `${channel}:${value}` 집합 */
export async function loadSuppressed(userId: Types.ObjectId, values: string[]): Promise<Set<string>> {
  const uniq = [...new Set(values.filter(Boolean))];
  const out = new Set<string>();
  for (let i = 0; i < uniq.length; i += 5000) {
    const docs = await Suppression.find({ userId, value: { $in: uniq.slice(i, i + 5000) } }, { channel: 1, value: 1 }).lean();
    for (const d of docs) out.add(suppressionKey(d.channel as UnsubChannel, d.value));
  }
  return out;
}

/** 연락처 목록의 모든 번호/이메일에 대한 억제 집합 */
export async function suppressedForContacts(
  userId: Types.ObjectId,
  contacts: { phones?: string[] | null; emails?: string[] | null }[],
): Promise<Set<string>> {
  return loadSuppressed(userId, contacts.flatMap((c) => [...(c.phones ?? []), ...(c.emails ?? [])]));
}

/** 080 CSV / 웹훅용: 억제 목록 등록 + 현재 일치하는 연락처 수 */
export async function blockRecipients(
  userId: Types.ObjectId,
  channel: UnsubChannel,
  values: string[],
  reason: UnsubReason,
): Promise<{ matchedContacts: number; newlyBlocked: number }> {
  const newlyBlocked = await suppress(userId, channel, values, reason);
  const field = channel === 'EMAIL' ? 'emails' : 'phones';
  const matchedContacts = values.length ? await Contact.countDocuments({ userId, [field]: { $in: values } }) : 0;
  return { matchedContacts, newlyBlocked };
}

function webhookSecret(): string {
  const s = process.env.WEBHOOK_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('WEBHOOK_SECRET 가 설정되지 않았습니다.');
  return s;
}

export function webhookSignature(userId: string): string {
  return crypto.createHmac('sha256', webhookSecret()).update(`optout:${userId}`).digest('hex');
}

export function verifyWebhookSignature(userId: string, sig: string): boolean {
  const expected = Buffer.from(webhookSignature(userId));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function optOutWebhookUrl(userId: string, provider: string): string {
  return `${baseUrl()}/api/webhooks/${provider.toLowerCase()}/opt-out?uid=${userId}&sig=${webhookSignature(userId)}`;
}

/** 공급사별 080 웹훅 페이로드에서 전화번호 추출 (JSON/form, 단건/배열 모두 허용) */
export function extractPhones(body: unknown): string[] {
  const out: string[] = [];
  const keys = ['phone', 'number', 'tel', 'receiver', 'mobile', 'phoneNumber', 'rejectNumber', 'numbers', 'phones', 'list', 'data'];
  const walk = (v: unknown, depth: number): void => {
    if (depth > 3 || v === null || v === undefined) return;
    if (typeof v === 'string' || typeof v === 'number') {
      String(v).split(/[,\s]+/).forEach((p) => p && out.push(p));
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, depth + 1));
    else if (typeof v === 'object') {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) if (keys.includes(k)) walk(val, depth + 1);
    }
  };
  walk(body, 0);
  return out;
}
