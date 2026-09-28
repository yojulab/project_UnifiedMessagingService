import type { Channel } from '@/types';
import {
  asRecord, errorMessage, readJson, requireFields,
  type AdapterConfig, type IMessagingAdapter, type SendPayload, type SendResult, type TestResult,
} from '../IMessagingAdapter';

/**
 * Zoho Mail REST API 어댑터.
 * 주의: Zoho Mail 발송 API 는 사용자 정의 헤더를 지원하지 않으므로 List-Unsubscribe 헤더는 전달되지 않는다.
 * (본문 하단 수신거부 링크는 발송 엔진이 항상 삽입) — 헤더가 필수라면 AWS SES 를 사용한다.
 */
/** 비밀값이 임의 호스트로 전송되지 않도록 Zoho 공식 데이터센터 도메인만 허용 */
const ZOHO_TLD = '(com|eu|in|com\\.au|jp|com\\.cn|ca|sa|uk)';
const ACCOUNTS_RE = new RegExp(`^accounts\\.zoho\\.${ZOHO_TLD}$`);
const MAIL_RE = new RegExp(`^mail\\.zoho\\.${ZOHO_TLD}$`);

export class ZohoAdapter implements IMessagingAdapter {
  readonly channel: Channel = 'EMAIL';
  readonly provider = 'ZOHO';
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: AdapterConfig) {
    requireFields(config, ['clientId', 'clientSecret', 'refreshToken', 'accountId', 'senderAddress'], 'Zoho');
    if (!ACCOUNTS_RE.test(this.accountsDomain) || !MAIL_RE.test(this.mailDomain)) {
      throw new Error('Zoho 도메인은 accounts.zoho.<지역> / mail.zoho.<지역> 형식만 허용됩니다.');
    }
  }

  private get accountsDomain(): string {
    return this.config.accountsDomain || 'accounts.zoho.com';
  }

  private get mailDomain(): string {
    return this.config.mailDomain || 'mail.zoho.com';
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) return this.accessToken;
    const params = new URLSearchParams({
      refresh_token: this.config.refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'refresh_token',
    });
    // 비밀값은 URL 쿼리가 아닌 form body 로 전송 (프록시·접근 로그 노출 방지)
    const res = await fetch(`https://${this.accountsDomain}/oauth/v2/token`, { method: 'POST', body: params });
    const json = asRecord(await readJson(res));
    if (!res.ok || typeof json.access_token !== 'string') {
      throw new Error(`Zoho 토큰 발급 실패: ${String(json.error ?? res.status)}`);
    }
    this.accessToken = json.access_token;
    this.tokenExpiresAt = Date.now() + (Number(json.expires_in ?? 3600) - 60) * 1000;
    return this.accessToken;
  }

  async send(payload: SendPayload): Promise<SendResult> {
    try {
      const token = await this.getAccessToken();
      const res = await fetch(`https://${this.mailDomain}/api/accounts/${this.config.accountId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAddress: payload.senderAddress || this.config.senderAddress,
          toAddress: payload.recipient,
          subject: payload.subject ?? '',
          content: payload.html ?? payload.body,
          mailFormat: payload.html ? 'html' : 'plaintext',
        }),
      });
      const json = asRecord(await readJson(res));
      const status = asRecord(json.status);
      if (!res.ok || Number(status.code) !== 200) {
        return { success: false, resultCode: 'FAILED', errorMessage: String(status.description ?? res.status), providerResponse: json };
      }
      const data = asRecord(json.data);
      return { success: true, resultCode: 'SUCCESS', messageId: String(data.messageId ?? ''), providerResponse: json };
    } catch (err) {
      return { success: false, resultCode: 'FAILED', errorMessage: errorMessage(err) };
    }
  }

  async testConnection(): Promise<TestResult> {
    try {
      const token = await this.getAccessToken();
      const res = await fetch(`https://${this.mailDomain}/api/accounts`, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
      if (!res.ok) return { connected: false, message: `Zoho 계정 조회 실패 (HTTP ${res.status})` };
      return { connected: true, message: 'Zoho Mail 연결 성공' };
    } catch (err) {
      return { connected: false, message: errorMessage(err) };
    }
  }
}
