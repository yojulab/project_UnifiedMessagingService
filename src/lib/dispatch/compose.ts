import type { AdapterConfig, SendPayload } from '@/lib/adapters/IMessagingAdapter';
import { DEFAULT_UNIT_COST } from '@/lib/codes/seedData';
import type { ContactDoc } from '@/lib/db/models/Contact';
import { listUnsubscribeHeaders, signUnsubToken, unsubscribePageUrl } from '@/lib/unsubscribe/token';
import type { Channel, MessageTemplate } from '@/types';
import { buildEmailBody, buildSmsBody, decideSmsType, resolveTemplate } from './template';

export interface ComposeContext {
  userId: string;
  channel: Channel;
  template: MessageTemplate;
  config: AdapterConfig;
}

export interface Composed {
  payload: SendPayload;
  /** 과금 기준 실제 유형 (SMS→LMS 자동 전환 반영) */
  billedType: Channel;
}

/** 수신자 1건에 대한 최종 발송 payload 구성 (치환 태그, 080 문구, 수신거부 링크·헤더) */
export function composeMessage(contact: ContactDoc, recipient: string, ctx: ComposeContext): Composed {
  const tpl = ctx.template;
  const body = resolveTemplate(tpl.body, contact);
  const subject = resolveTemplate(tpl.subject ?? '', contact);

  if (ctx.channel === 'EMAIL') {
    const token = signUnsubToken({ contactId: String(contact._id), email: recipient, userId: ctx.userId });
    const url = unsubscribePageUrl(token);
    const { html, text } = buildEmailBody(body, { isHtml: Boolean(tpl.isHtml), unsubUrl: url });
    return {
      payload: {
        recipient,
        subject,
        body: text,
        html,
        senderAddress: ctx.config.senderAddress,
        headers: listUnsubscribeHeaders(token, ctx.config.senderAddress),
      },
      billedType: 'EMAIL',
    };
  }

  if (ctx.channel === 'KAKAO') {
    // 알림톡은 승인된 템플릿 본문 그대로 (광고 문구 삽입 불가)
    return { payload: { recipient, body }, billedType: 'KAKAO' };
  }

  const text = buildSmsBody(body, { isAd: tpl.isAd !== false, optOutNumber: ctx.config.optOutNumber });
  const smsType = ctx.channel === 'LMS' ? 'LMS' : decideSmsType(text);
  return { payload: { recipient, subject: subject || undefined, body: text, smsType }, billedType: smsType };
}

export function unitCostOf(config: AdapterConfig, billedType: Channel): number {
  const custom = Number(config.unitCost);
  return Number.isFinite(custom) && custom > 0 ? custom : (DEFAULT_UNIT_COST[billedType] ?? 0);
}
