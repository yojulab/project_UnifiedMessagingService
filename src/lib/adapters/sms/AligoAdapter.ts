import type { Channel } from '@/types';
import {
  asRecord, errorMessage, readJson, requireFields,
  type AdapterConfig, type IMessagingAdapter, type SendPayload, type SendResult, type TestResult,
} from '../IMessagingAdapter';

const BASE = 'https://apis.aligo.in';

export class AligoAdapter implements IMessagingAdapter {
  readonly provider = 'ALIGO';

  constructor(
    readonly channel: Channel,
    private readonly config: AdapterConfig,
  ) {
    requireFields(config, ['apiKey', 'userId', 'senderNumber'], '알리고');
  }

  private form(extra: Record<string, string>): URLSearchParams {
    return new URLSearchParams({ key: this.config.apiKey, user_id: this.config.userId, ...extra });
  }

  async send(payload: SendPayload): Promise<SendResult> {
    try {
      const msgType = payload.smsType ?? (this.channel === 'LMS' ? 'LMS' : 'SMS');
      const res = await fetch(`${BASE}/send/`, {
        method: 'POST',
        body: this.form({
          sender: this.config.senderNumber.replace(/\D/g, ''),
          receiver: payload.recipient,
          msg: payload.body,
          msg_type: msgType,
          ...(msgType === 'LMS' && payload.subject ? { title: payload.subject } : {}),
        }),
      });
      const json = asRecord(await readJson(res));
      if (Number(json.result_code) !== 1) {
        return { success: false, resultCode: 'FAILED', errorMessage: String(json.message ?? res.status), providerResponse: json };
      }
      return { success: true, resultCode: 'SUCCESS', messageId: String(json.msg_id ?? ''), providerResponse: json };
    } catch (err) {
      return { success: false, resultCode: 'FAILED', errorMessage: errorMessage(err) };
    }
  }

  async testConnection(): Promise<TestResult> {
    try {
      const res = await fetch(`${BASE}/remain/`, { method: 'POST', body: this.form({}) });
      const json = asRecord(await readJson(res));
      if (Number(json.result_code) !== 1) return { connected: false, message: `알리고 인증 실패: ${String(json.message ?? res.status)}` };
      return { connected: true, message: `알리고 연결 성공 (SMS 잔여 ${String(json.SMS_CNT ?? '-')}건)`, providerInfo: json };
    } catch (err) {
      return { connected: false, message: errorMessage(err) };
    }
  }
}
