import crypto from 'node:crypto';
import type { Channel } from '@/types';
import {
  asRecord, errorMessage, readJson, requireFields,
  type AdapterConfig, type IMessagingAdapter, type SendPayload, type SendResult, type TestResult,
} from '../IMessagingAdapter';

const BASE = 'https://api.solapi.com';

/** 솔라피 — SMS / LMS / 카카오 알림톡(ATA) */
export class SolapiAdapter implements IMessagingAdapter {
  readonly provider = 'SOLAPI';

  constructor(
    readonly channel: Channel,
    private readonly config: AdapterConfig,
  ) {
    requireFields(config, ['apiKey', 'apiSecret', 'senderNumber'], '솔라피');
    if (channel === 'KAKAO') requireFields(config, ['kakaoPfId', 'kakaoTemplateId'], '솔라피 알림톡');
  }

  private authHeader(): string {
    const date = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString('hex');
    const signature = crypto.createHmac('sha256', this.config.apiSecret).update(date + salt).digest('hex');
    return `HMAC-SHA256 apiKey=${this.config.apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
  }

  async send(payload: SendPayload): Promise<SendResult> {
    try {
      const type = this.channel === 'KAKAO' ? 'ATA' : (payload.smsType ?? (this.channel === 'LMS' ? 'LMS' : 'SMS'));
      const message: Record<string, unknown> = {
        to: payload.recipient,
        from: this.config.senderNumber.replace(/\D/g, ''),
        text: payload.body,
        type,
      };
      if (type === 'LMS' && payload.subject) message.subject = payload.subject;
      if (type === 'ATA') {
        message.kakaoOptions = { pfId: this.config.kakaoPfId, templateId: this.config.kakaoTemplateId, disableSms: true };
      }
      const res = await fetch(`${BASE}/messages/v4/send`, {
        method: 'POST',
        headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const json = asRecord(await readJson(res));
      const status = String(json.statusCode ?? '');
      if (!res.ok || (status && !status.startsWith('2'))) {
        return { success: false, resultCode: 'FAILED', errorMessage: String(json.errorMessage ?? json.statusMessage ?? res.status), providerResponse: json };
      }
      return { success: true, resultCode: 'SUCCESS', messageId: String(json.messageId ?? ''), providerResponse: json };
    } catch (err) {
      return { success: false, resultCode: 'FAILED', errorMessage: errorMessage(err) };
    }
  }

  async testConnection(): Promise<TestResult> {
    try {
      const res = await fetch(`${BASE}/cash/v1/balance`, { headers: { Authorization: this.authHeader() } });
      const json = asRecord(await readJson(res));
      if (!res.ok) return { connected: false, message: `솔라피 인증 실패: ${String(json.errorMessage ?? res.status)}` };
      return { connected: true, message: `솔라피 연결 성공 (잔액 ${String(json.balance ?? '-')}원)`, providerInfo: json };
    } catch (err) {
      return { connected: false, message: errorMessage(err) };
    }
  }
}
