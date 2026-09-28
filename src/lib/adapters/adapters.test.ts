import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdapterFactory } from './AdapterFactory';
import { DryRunAdapter, isDryRun } from './DryRunAdapter';
import { ZohoAdapter } from './email/ZohoAdapter';
import { AligoAdapter } from './sms/AligoAdapter';
import { SolapiAdapter } from './sms/SolapiAdapter';

const zohoCfg = { clientId: 'cid', clientSecret: 'csec', refreshToken: 'rtok', accountId: '123', senderAddress: 'a@b.com' };

function mockFetch(responses: unknown[]): ReturnType<typeof vi.fn> {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(new Response(JSON.stringify(r), { status: 200 }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('DRY_RUN fail-safe', () => {
  it('DRY_RUN=false 를 명시해야만 실제 어댑터', () => {
    vi.stubEnv('DRY_RUN', '');
    expect(isDryRun()).toBe(true);
    expect(AdapterFactory.create('SMS', 'ALIGO', { apiKey: 'k', userId: 'u', senderNumber: '010' })).toBeInstanceOf(DryRunAdapter);
    vi.stubEnv('DRY_RUN', 'false');
    expect(AdapterFactory.create('SMS', 'ALIGO', { apiKey: 'k', userId: 'u', senderNumber: '010' })).toBeInstanceOf(AligoAdapter);
  });

  it('DRY_RUN 에서도 필수 설정 누락은 에러', () => {
    expect(() => AdapterFactory.create('SMS', 'ALIGO', { apiKey: 'k' })).toThrow('알리고 설정 누락');
  });
});

describe('ZohoAdapter', () => {
  it('허용되지 않은 도메인은 거부 (비밀값 유출 방지)', () => {
    expect(() => new ZohoAdapter({ ...zohoCfg, accountsDomain: 'evil.example.com' })).toThrow('Zoho 도메인');
    expect(() => new ZohoAdapter({ ...zohoCfg, mailDomain: 'mail.zoho.com.evil.io' })).toThrow('Zoho 도메인');
    expect(() => new ZohoAdapter({ ...zohoCfg, accountsDomain: 'accounts.zoho.eu', mailDomain: 'mail.zoho.eu' })).not.toThrow();
    expect(() => new ZohoAdapter({ ...zohoCfg, accountsDomain: 'accounts.zoho.com.au', mailDomain: 'mail.zoho.com.au' })).not.toThrow();
  });

  it('토큰은 form body 로 요청하고 URL 에 비밀값이 없음, 발송 요청 형식', async () => {
    const fetch = mockFetch([{ access_token: 'AT', expires_in: 3600 }, { status: { code: 200 }, data: { messageId: 'm1' } }]);
    const r = await new ZohoAdapter(zohoCfg).send({ recipient: 'x@y.com', subject: 'S', body: 'T', html: '<p>H</p>' });
    expect(r).toMatchObject({ success: true, messageId: 'm1' });
    const [tokenUrl, tokenInit] = fetch.mock.calls[0] as [string, RequestInit];
    expect(tokenUrl).toBe('https://accounts.zoho.com/oauth/v2/token');
    expect(String(tokenInit.body)).toContain('client_secret=csec');
    const [sendUrl, sendInit] = fetch.mock.calls[1] as [string, RequestInit];
    expect(sendUrl).toBe('https://mail.zoho.com/api/accounts/123/messages');
    expect(JSON.parse(String(sendInit.body))).toMatchObject({ toAddress: 'x@y.com', subject: 'S', content: '<p>H</p>', mailFormat: 'html' });
  });
});

describe('AligoAdapter', () => {
  it('form 필드와 SMS/LMS 유형, 결과 매핑', async () => {
    const fetch = mockFetch([{ result_code: 1, msg_id: 99 }, { result_code: -101, message: '인증오류' }]);
    const a = new AligoAdapter('SMS', { apiKey: 'k', userId: 'u', senderNumber: '010-1234-5678' });
    expect(await a.send({ recipient: '01011112222', body: '본문', smsType: 'LMS', subject: '제목' })).toMatchObject({ success: true, messageId: '99' });
    const body = (fetch.mock.calls[0] as [string, RequestInit])[1].body as URLSearchParams;
    expect(Object.fromEntries(body)).toMatchObject({ key: 'k', user_id: 'u', sender: '01012345678', receiver: '01011112222', msg_type: 'LMS', title: '제목' });
    expect(await a.send({ recipient: '010', body: 'x' })).toMatchObject({ success: false, resultCode: 'FAILED', errorMessage: '인증오류' });
  });
});

describe('SolapiAdapter', () => {
  it('HMAC 인증 헤더와 알림톡(ATA) 옵션', async () => {
    const fetch = mockFetch([{ statusCode: '2000', messageId: 'M' }]);
    const s = new SolapiAdapter('KAKAO', { apiKey: 'AK', apiSecret: 'SEC', senderNumber: '010', kakaoPfId: 'pf', kakaoTemplateId: 'tp' });
    expect(await s.send({ recipient: '01011112222', body: '안내' })).toMatchObject({ success: true, messageId: 'M' });
    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toMatch(/^HMAC-SHA256 apiKey=AK, date=.+, salt=[0-9a-f]{32}, signature=[0-9a-f]{64}$/);
    expect(JSON.parse(String(init.body)).message).toMatchObject({ type: 'ATA', kakaoOptions: { pfId: 'pf', templateId: 'tp', disableSms: true } });
  });

  it('알림톡은 pfId/templateId 필수', () => {
    expect(() => new SolapiAdapter('KAKAO', { apiKey: 'a', apiSecret: 'b', senderNumber: 'c' })).toThrow('솔라피 알림톡 설정 누락');
  });
});
