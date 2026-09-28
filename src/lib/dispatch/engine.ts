import { Types } from 'mongoose';
import { AdapterFactory } from '@/lib/adapters/AdapterFactory';
import { errorMessage, type AdapterConfig, type IMessagingAdapter } from '@/lib/adapters/IMessagingAdapter';
import { connectDB } from '@/lib/db/connection';
import { DispatchJob, type DispatchJobDoc } from '@/lib/db/models/DispatchJob';
import { DispatchLog } from '@/lib/db/models/DispatchLog';
import type { ContactDoc } from '@/lib/db/models/Contact';
import { loadDecryptedConfig } from '@/lib/platform/configService';
import { activeRecipients } from '@/lib/unsubscribe/isBlocked';
import { suppressedForContacts } from '@/lib/unsubscribe/service';
import type { Channel, DispatchStatus, MessageTemplate } from '@/types';
import { composeMessage, unitCostOf } from './compose';
import { iterateContacts } from './targeting';

const CONCURRENCY = 5;

/** 결과 집계로 최종 상태 판정: 전부 성공 COMPLETED, 실패율 > 50% FAILED, 그 외 PARTIAL */
export function decideStatus(sent: number, failed: number): DispatchStatus {
  if (failed === 0) return 'COMPLETED';
  const total = sent + failed;
  if (failed / total > 0.5) return 'FAILED';
  return 'PARTIAL';
}

export async function aggregateJob(jobId: Types.ObjectId, userId: Types.ObjectId): Promise<{ sent: number; failed: number; skipped: number; cost: number }> {
  const rows = await DispatchLog.aggregate<{ _id: string; count: number; cost: number }>([
    { $match: { userId, dispatchJobId: jobId } },
    { $group: { _id: '$resultCode', count: { $sum: 1 }, cost: { $sum: '$unitCost' } } },
  ]);
  const by = Object.fromEntries(rows.map((r) => [r._id, r]));
  return {
    sent: by.SUCCESS?.count ?? 0,
    failed: (by.FAILED?.count ?? 0) + (by.BOUNCED?.count ?? 0),
    skipped: by.SKIPPED?.count ?? 0,
    cost: rows.reduce((s, r) => s + (r._id === 'SUCCESS' ? r.cost : 0), 0),
  };
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

interface Runtime {
  job: DispatchJobDoc;
  adapter: IMessagingAdapter;
  config: AdapterConfig;
  fallback: { adapter: IMessagingAdapter; config: AdapterConfig } | null;
}

async function sendOne(rt: Runtime, contact: ContactDoc, recipient: string): Promise<void> {
  const { job } = rt;
  const channel = job.channel as Channel;
  const base = {
    dispatchJobId: job._id,
    contactId: contact._id,
    userId: job.userId,
    channel,
    provider: job.provider,
    recipient,
    contactName: contact.name,
  };
  // 멱등성: (jobId, recipient) 유니크 — 이미 처리된 수신자는 건너뜀 (재시작/중복 실행 안전)
  let logId: Types.ObjectId;
  try {
    const log = await DispatchLog.create({ ...base, resultCode: 'PENDING' });
    logId = log._id;
  } catch (err) {
    if (isDuplicateKey(err)) return;
    throw err;
  }

  const template = job.messageTemplate as MessageTemplate;
  const ctx = { userId: String(job.userId), channel, template, config: rt.config };
  let composed;
  try {
    composed = composeMessage(contact, recipient, ctx);
  } catch (err) {
    await DispatchLog.updateOne({ _id: logId, userId: job.userId }, { $set: { resultCode: 'FAILED', errorMessage: errorMessage(err), sentAt: new Date() } });
    return;
  }

  let result = await rt.adapter.send(composed.payload);
  let usedChannel: Channel = composed.billedType;
  let usedConfig = rt.config;
  let usedProvider = job.provider;
  let isFallback = false;
  let payload = composed.payload;

  // 카카오 알림톡 실패 → LMS 자동 전환
  if (!result.success && channel === 'KAKAO' && rt.fallback) {
    try {
      const fb = composeMessage(contact, recipient, { ...ctx, channel: 'LMS', config: rt.fallback.config });
      const fbResult = await rt.fallback.adapter.send(fb.payload);
      result = { ...fbResult, errorMessage: fbResult.success ? `알림톡 실패(${result.errorMessage ?? ''}) → LMS 대체 발송` : fbResult.errorMessage };
      usedChannel = 'LMS';
      usedConfig = rt.fallback.config;
      usedProvider = rt.fallback.adapter.provider;
      isFallback = true;
      payload = fb.payload;
    } catch (err) {
      result = { ...result, errorMessage: `${result.errorMessage ?? ''} / LMS 대체 실패: ${errorMessage(err)}` };
    }
  }

  await DispatchLog.updateOne(
    { _id: logId, userId: job.userId },
    {
      $set: {
        channel: usedChannel,
        provider: usedProvider,
        subject: payload.subject ?? '',
        bodyPreview: payload.body.slice(0, 300),
        resultCode: result.resultCode,
        messageId: result.messageId ?? '',
        providerResponse: result.providerResponse ?? {},
        errorMessage: result.errorMessage ?? '',
        isFallback,
        unitCost: result.success ? unitCostOf(usedConfig, usedChannel) : 0,
        sentAt: new Date(),
      },
    },
  );
}

async function logSkipped(job: DispatchJobDoc, contact: ContactDoc, recipient: string): Promise<void> {
  try {
    await DispatchLog.create({
      dispatchJobId: job._id, contactId: contact._id, userId: job.userId, channel: job.channel, provider: job.provider,
      recipient, contactName: contact.name, resultCode: 'SKIPPED', errorMessage: '수신거부로 발송 제외', sentAt: new Date(),
    });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
  }
}

async function buildRuntime(job: DispatchJobDoc): Promise<Runtime> {
  const { plain } = await loadDecryptedConfig(job.userId, job.platformConfigId);
  const adapter = AdapterFactory.create(job.channel as Channel, job.provider, plain);
  let fallback: Runtime['fallback'] = null;
  if (job.channel === 'KAKAO' && job.fallbackToLms && job.fallbackConfigId) {
    const fb = await loadDecryptedConfig(job.userId, job.fallbackConfigId);
    fallback = { adapter: AdapterFactory.create('LMS', fb.doc.provider, fb.plain), config: fb.plain };
  }
  return { job, adapter, config: plain, fallback };
}

/**
 * 발송 작업 실행. PENDING → SENDING 을 원자적으로 선점한 워커만 실행한다.
 * 개별 실패는 로그에만 기록하고 계속 진행한다.
 */
export async function processJob(jobId: Types.ObjectId | string): Promise<void> {
  await connectDB();
  const now = new Date();
  const job = (await DispatchJob.findOneAndUpdate(
    { _id: jobId, status: 'PENDING', $or: [{ scheduledAt: null }, { scheduledAt: { $lte: now } }] },
    { $set: { status: 'SENDING', startedAt: now } },
    { returnDocument: 'after' },
  ).lean()) as DispatchJobDoc | null;
  if (!job) return;

  let rt: Runtime;
  try {
    rt = await buildRuntime(job);
  } catch (err) {
    await DispatchJob.updateOne({ _id: job._id, userId: job.userId }, { $set: { status: 'FAILED', errorMessage: errorMessage(err), completedAt: new Date() } });
    return;
  }

  const channel = job.channel as Channel;
  const seen = new Set<string>();
  let cancelled = false;
  for await (const contacts of iterateContacts(job.userId, job.targetContactIds as Types.ObjectId[])) {
    const current = await DispatchJob.findOne({ _id: job._id, userId: job.userId }, { status: 1 }).lean();
    if (current?.status === 'CANCELLED') {
      cancelled = true;
      break;
    }
    const tasks: (() => Promise<void>)[] = [];
    // 발송 시점에 억제 목록 재조회 (예약 발송 중 거부 반영, 연락처 삭제·재업로드와 무관)
    const suppressed = await suppressedForContacts(job.userId, contacts);
    for (const c of contacts) {
      const all = channel === 'EMAIL' ? (c.emails ?? []) : (c.phones ?? []);
      // 발송 시점에 수신거부 재검증 (예약 발송 중 거부 반영)
      const active = new Set(activeRecipients(c, channel, suppressed));
      for (const r of all) {
        if (seen.has(r)) continue;
        seen.add(r);
        if (active.has(r)) tasks.push(() => sendOne(rt, c, r));
        else if (channel !== 'KAKAO' || /^01/.test(r)) tasks.push(() => logSkipped(job, c, r));
      }
    }
    for (let i = 0; i < tasks.length; i += CONCURRENCY) {
      await Promise.all(tasks.slice(i, i + CONCURRENCY).map((t) => t()));
    }
    const agg = await aggregateJob(job._id, job.userId);
    await DispatchJob.updateOne(
      { _id: job._id, userId: job.userId },
      { $set: { sentCount: agg.sent, failedCount: agg.failed, skippedCount: agg.skipped, totalCost: agg.cost } },
    );
  }

  const agg = await aggregateJob(job._id, job.userId);
  await DispatchJob.updateOne(
    { _id: job._id, userId: job.userId, status: { $in: ['SENDING', 'CANCELLED'] } },
    {
      $set: {
        status: cancelled ? 'CANCELLED' : decideStatus(agg.sent, agg.failed),
        sentCount: agg.sent,
        failedCount: agg.failed,
        skippedCount: agg.skipped,
        totalCost: agg.cost,
        completedAt: new Date(),
      },
    },
  );
}

/** 예약 시각 도래 작업 + 방치된 작업을 처리한다 (스케줄러에서 주기 호출). */
export async function processDueJobs(): Promise<number> {
  await connectDB();
  const now = new Date();
  // 10분 이상 진행 없는 SENDING 작업은 재개 (로그 멱등성으로 중복 발송 없음)
  await DispatchJob.updateMany(
    { status: 'SENDING', updatedAt: { $lt: new Date(now.getTime() - 10 * 60_000) } },
    { $set: { status: 'PENDING' } },
  );
  const due = await DispatchJob.find(
    {
      status: 'PENDING',
      $or: [{ scheduledAt: { $lte: now } }, { scheduledAt: null, createdAt: { $lt: new Date(now.getTime() - 60_000) } }],
    },
    { _id: 1 },
  )
    .sort({ scheduledAt: 1 })
    .limit(10)
    .lean();
  for (const j of due) await processJob(j._id);
  return due.length;
}
