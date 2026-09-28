import type { Types } from 'mongoose';
import { z } from 'zod';
import { AppError, toObjectId } from '@/lib/api';
import { errorMessage } from '@/lib/adapters/IMessagingAdapter';
import { DispatchJob } from '@/lib/db/models/DispatchJob';
import { loadDecryptedConfig } from '@/lib/platform/configService';
import { isDryRun } from '@/lib/adapters/DryRunAdapter';
import { baseUrl, isPublicUrl } from '@/lib/baseUrl';
import { activeRecipients } from '@/lib/unsubscribe/isBlocked';
import { suppressedForContacts } from '@/lib/unsubscribe/service';
import type { CampaignInputSchema, EstimateInputSchema } from '@/lib/validators/schemas';
import type { Channel, MessageTemplate, TargetFilter } from '@/types';
import { composeMessage, unitCostOf } from './compose';
import { senderNameOf } from './engine';
import { countMessages, resolveTargetIds } from './targeting';

type CampaignInput = z.infer<typeof CampaignInputSchema>;
type EstimateInput = z.infer<typeof EstimateInputSchema>;

export interface Estimate {
  channel: Channel;
  provider: string;
  targetCount: number;
  messageCount: number;
  blockedCount: number;
  unitCost: number;
  estimatedCost: number;
  billedType: Channel;
  /** 발송 전 확인이 필요한 경고 (예: 수신거부 링크가 외부에서 접근 불가) */
  warnings: string[];
  sample: { recipient: string; contactName: string; subject?: string; body: string; html?: string; headers?: Record<string, string> } | null;
  sampleError: string | null;
}

async function loadActiveConfig(userId: Types.ObjectId, id: string, what = '발송 플랫폼'): ReturnType<typeof loadDecryptedConfig> {
  const { doc, plain } = await loadDecryptedConfig(userId, toObjectId(id, what));
  if (doc.status !== 'ACTIVE') throw new AppError(400, 'PLATFORM_NOT_ACTIVE', `${what} 연결 상태가 ACTIVE 가 아닙니다. 연결 테스트를 먼저 통과하세요.`);
  return { doc, plain };
}

/** 실발송 이메일의 수신거부 링크가 외부에서 열리지 않으면 발송을 막는다 (광고 메일 수신거부 수단 보장) */
function unsubscribeUrlProblem(channel: Channel): string | null {
  if (channel !== 'EMAIL' || isDryRun() || process.env.ALLOW_PRIVATE_UNSUBSCRIBE_URL === 'true') return null;
  const url = baseUrl();
  if (isPublicUrl(url)) return null;
  return `수신거부 링크 주소(${url || '미설정'})가 외부에서 접근할 수 없습니다. PUBLIC_BASE_URL 을 공개 도메인(https://…)으로 설정한 뒤 발송하세요.`;
}

function assertTemplate(channel: Channel, t: Partial<MessageTemplate>, optOutNumber: string | undefined): void {
  if (channel === 'EMAIL' && !t.subject?.trim()) throw new AppError(400, 'SUBJECT_REQUIRED', '이메일 제목을 입력하세요.');
  if ((channel === 'SMS' || channel === 'LMS') && t.isAd !== false && !optOutNumber) {
    throw new AppError(400, 'OPT_OUT_REQUIRED', '광고 문자 발송에는 080 수신거부 번호가 필요합니다. 플랫폼 설정에서 080 번호를 등록하세요.');
  }
}

async function computeEstimate(
  userId: Types.ObjectId,
  configId: string,
  filter: TargetFilter,
  template: Partial<MessageTemplate>,
): Promise<{ estimate: Estimate; ids: Types.ObjectId[] }> {
  const { doc, plain } = await loadActiveConfig(userId, configId);
  const channel = doc.channel as Channel;
  const ids = await resolveTargetIds(userId, channel, filter);
  const counts = await countMessages(userId, channel, ids);

  let sample: Estimate['sample'] = null;
  let sampleError: string | null = null;
  let billedType: Channel = channel === 'SMS' ? 'SMS' : channel;
  const c = counts.firstContact;
  const recipient = c ? activeRecipients(c, channel, await suppressedForContacts(userId, [c]))[0] : undefined;
  if (c && recipient && template.body?.trim()) {
    try {
      const composed = composeMessage(c, recipient, {
        userId: String(userId),
        channel,
        template: { body: template.body, subject: template.subject ?? '', isHtml: template.isHtml ?? false, isAd: template.isAd ?? true },
        config: plain,
        senderName: await senderNameOf(userId),
      });
      billedType = composed.billedType;
      sample = {
        recipient,
        contactName: c.name,
        subject: composed.payload.subject,
        body: composed.payload.body,
        html: composed.payload.html,
        // Zoho 는 사용자 정의 헤더를 전송하지 못하므로 미리보기에도 표시하지 않는다 (harness-decisions #19)
        headers: doc.provider === 'ZOHO' ? undefined : composed.payload.headers,
      };
    } catch (err) {
      sampleError = errorMessage(err);
    }
  }
  const unitCost = unitCostOf(plain, billedType);
  return {
    ids,
    estimate: {
      channel,
      provider: doc.provider,
      targetCount: counts.targetCount,
      messageCount: counts.messageCount,
      blockedCount: counts.blockedCount,
      unitCost,
      estimatedCost: Math.round(unitCost * counts.messageCount * 100) / 100,
      billedType,
      warnings: [unsubscribeUrlProblem(channel)].filter((w): w is string => Boolean(w)),
      sample,
      sampleError,
    },
  };
}

export async function estimateCampaign(userId: Types.ObjectId, input: EstimateInput): Promise<Estimate> {
  const { estimate } = await computeEstimate(userId, input.platformConfigId, input.targetFilter, input.messageTemplate ?? {});
  return estimate;
}

export async function createCampaign(userId: Types.ObjectId, input: CampaignInput): Promise<{ id: string; scheduled: boolean; estimate: Estimate }> {
  const { doc, plain } = await loadActiveConfig(userId, input.platformConfigId);
  const channel = doc.channel as Channel;
  assertTemplate(channel, input.messageTemplate, plain.optOutNumber);
  const urlProblem = unsubscribeUrlProblem(channel);
  if (urlProblem) throw new AppError(400, 'UNSUBSCRIBE_URL_NOT_PUBLIC', urlProblem);

  let fallbackConfigId: Types.ObjectId | null = null;
  if (channel === 'KAKAO' && input.fallbackToLms) {
    if (!input.fallbackConfigId) throw new AppError(400, 'FALLBACK_REQUIRED', 'LMS 대체 발송에 사용할 문자 플랫폼을 선택하세요.');
    const fb = await loadActiveConfig(userId, input.fallbackConfigId, 'LMS 대체 플랫폼');
    if (fb.doc.channel !== 'SMS' && fb.doc.channel !== 'LMS') throw new AppError(400, 'INVALID_FALLBACK', 'LMS 대체 발송은 SMS/LMS 플랫폼만 선택할 수 있습니다.');
    assertTemplate('LMS', input.messageTemplate, fb.plain.optOutNumber);
    fallbackConfigId = fb.doc._id;
  }

  let scheduledAt: Date | null = null;
  if (input.scheduledAt) {
    scheduledAt = new Date(input.scheduledAt);
    if (scheduledAt.getTime() < Date.now() + 60_000) throw new AppError(400, 'INVALID_SCHEDULE', '예약 시각은 현재로부터 1분 이후여야 합니다.');
  }

  const { estimate, ids } = await computeEstimate(userId, input.platformConfigId, input.targetFilter, input.messageTemplate);
  if (ids.length === 0 || estimate.messageCount === 0) throw new AppError(400, 'NO_TARGETS', '조건에 맞는 발송 대상이 없습니다.');
  if (estimate.sampleError) throw new AppError(400, 'COMPOSE_ERROR', estimate.sampleError);

  const job = await DispatchJob.create({
    userId,
    campaignName: input.campaignName,
    channel,
    provider: doc.provider,
    platformConfigId: doc._id,
    fallbackToLms: Boolean(fallbackConfigId),
    fallbackConfigId,
    targetFilter: input.targetFilter,
    messageTemplate: input.messageTemplate,
    targetContactIds: ids,
    scheduledAt,
    totalTargets: estimate.targetCount,
    totalMessages: estimate.messageCount,
    estimatedCost: estimate.estimatedCost,
    status: 'PENDING',
  });
  return { id: String(job._id), scheduled: Boolean(scheduledAt), estimate };
}
