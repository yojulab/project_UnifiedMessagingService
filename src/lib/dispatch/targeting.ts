import type { PipelineStage, Types } from 'mongoose';
import { buildContactFilter } from '@/lib/contacts/queries';
import { Contact, type ContactDoc } from '@/lib/db/models/Contact';
import { activeRecipients } from '@/lib/unsubscribe/isBlocked';
import { suppressedForContacts } from '@/lib/unsubscribe/service';
import type { Channel, TargetFilter, TopNSort } from '@/types';

const SORTS: Record<TopNSort, Record<string, 1 | -1>> = {
  createdAt_desc: { createdAt: -1, _id: -1 },
  createdAt_asc: { createdAt: 1, _id: 1 },
  name_asc: { name: 1, _id: 1 },
};

/** 타겟 조건 → Mongo 필터 (전체 수신거부 제외 + 채널 연락수단 보유 연락처만) */
export function targetQuery(userId: Types.ObjectId, channel: Channel, f: TargetFilter): Record<string, unknown> {
  const filter = buildContactFilter(userId, {
    q: f.keywords,
    sourceNames: f.sourceNames,
    labels: f.labels,
    unsub: 'exclude',
  });
  if (channel === 'EMAIL') filter['emails.0'] = { $exists: true };
  else filter['phones.0'] = { $exists: true };
  return filter;
}

/** 타겟팅 모드에 따라 대상 연락처 ID 목록을 확정한다. */
export async function resolveTargetIds(userId: Types.ObjectId, channel: Channel, f: TargetFilter): Promise<Types.ObjectId[]> {
  const match = targetQuery(userId, channel, f);
  if (f.mode === 'RANDOM_N') {
    const pipeline: PipelineStage[] = [{ $match: match }, { $sample: { size: f.limit ?? 1 } }, { $project: { _id: 1 } }];
    const docs = await Contact.aggregate<{ _id: Types.ObjectId }>(pipeline);
    return docs.map((d) => d._id);
  }
  let q = Contact.find(match, { _id: 1 });
  if (f.mode === 'TOP_N') q = q.sort(SORTS[f.sort ?? 'createdAt_desc']).limit(f.limit ?? 1);
  else q = q.sort({ _id: 1 });
  const docs = await q.lean();
  return docs.map((d) => d._id);
}

export async function countTargets(userId: Types.ObjectId, channel: Channel, f: TargetFilter): Promise<number> {
  const total = await Contact.countDocuments(targetQuery(userId, channel, f));
  return f.mode === 'ALL' ? total : Math.min(total, f.limit ?? 0);
}

/** ID 목록의 연락처를 청크 단위로 순회 (항상 userId 필터 포함) */
export async function* iterateContacts(userId: Types.ObjectId, ids: Types.ObjectId[], chunk = 200): AsyncGenerator<ContactDoc[]> {
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const docs = (await Contact.find({ userId, _id: { $in: slice } }).lean()) as ContactDoc[];
    const order = new Map(slice.map((id, idx) => [String(id), idx]));
    docs.sort((a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0));
    yield docs;
  }
}

export interface MessageCount {
  targetCount: number;
  messageCount: number;
  blockedCount: number;
}

/** 대상 고객 수 vs 실제 발송 메시지 건수 (다중 연락처, 번호 단위 수신거부, 캠페인 내 중복 수신자 제거) */
export async function countMessages(userId: Types.ObjectId, channel: Channel, ids: Types.ObjectId[]): Promise<MessageCount & { firstContact: ContactDoc | null }> {
  const seen = new Set<string>();
  let blocked = 0;
  let first: ContactDoc | null = null;
  for await (const docs of iterateContacts(userId, ids, 1000)) {
    const suppressed = await suppressedForContacts(userId, docs);
    for (const c of docs) {
      if (!first) first = c;
      const all = channel === 'EMAIL' ? (c.emails ?? []) : (c.phones ?? []);
      const active = activeRecipients(c, channel, suppressed);
      blocked += all.length - active.length;
      for (const r of active) seen.add(r);
    }
  }
  return { targetCount: ids.length, messageCount: seen.size, blockedCount: blocked, firstContact: first };
}
