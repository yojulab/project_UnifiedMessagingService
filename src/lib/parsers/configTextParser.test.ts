import { describe, expect, it } from 'vitest';
import { checkAgainstTemplate, matchConfigToTemplate, parseConfigText, toCamelCase } from './configTextParser';

describe('toCamelCase', () => {
  it.each([
    ['API_KEY', 'apiKey'],
    ['api-key', 'apiKey'],
    ['ApiKey', 'apiKey'],
    ['apiKey', 'apiKey'],
    ['USER_ID', 'userId'],
    ['sender number', 'senderNumber'],
    ['REGION', 'region'],
  ])('%s → %s', (input, expected) => expect(toCamelCase(input)).toBe(expected));
});

describe('parseConfigText', () => {
  it('JSON 객체를 파싱한다', () => {
    expect(parseConfigText('{"apiKey": "abc", "USER_ID": "u1", "port": 25}')).toEqual({ apiKey: 'abc', userId: 'u1', port: '25' });
  });

  it('KEY=VALUE 줄 형식을 파싱하고 주석·빈 줄·따옴표를 처리한다', () => {
    const raw = `# 알리고 설정\nAPI_KEY=xxx\n\nUSER_ID="yyy"\nSENDER_NUMBER='01012345678'\n`;
    expect(parseConfigText(raw)).toEqual({ apiKey: 'xxx', userId: 'yyy', senderNumber: '01012345678' });
  });

  it('KEY: VALUE 형식과 export 접두어를 허용한다', () => {
    expect(parseConfigText('export REGION: ap-northeast-2\napiSecret: s=1')).toEqual({ region: 'ap-northeast-2', apiSecret: 's=1' });
  });

  it('잘못된 JSON 은 에러', () => {
    expect(() => parseConfigText('{bad')).toThrow('JSON');
    expect(() => parseConfigText('[1,2]')).toThrow();
  });

  it('템플릿 대비 누락/알 수 없는 키를 찾는다', () => {
    const tpl = { apiKey: { required: true }, userId: { required: true }, optOutNumber: { required: false } };
    expect(checkAgainstTemplate({ apiKey: 'a', foo: 'b' }, tpl)).toEqual({ missing: ['userId'], unknown: ['foo'] });
  });

  it('공급사 접두어(ZOHO_) 및 별칭(FROM_EMAIL -> senderAddress)을 템플릿 키로 자동 매핑한다', () => {
    const raw = `ZOHO_CLIENT_ID=client-123
ZOHO_CLIENT_SECRET=secret-456
ZOHO_FROM_EMAIL=contact@axfoundly.com
ZOHO_REFRESH_TOKEN=token-789
ZOHO_ACCOUNT_ID=acc-001
ZOHO_GRANT_CODE=`;
    const parsed = parseConfigText(raw);
    const tpl = {
      clientId: { required: true },
      clientSecret: { required: true },
      refreshToken: { required: true },
      accountId: { required: true },
      senderAddress: { required: true },
    };
    const { mapped, check } = matchConfigToTemplate(parsed, tpl);
    expect(mapped).toEqual({
      clientId: 'client-123',
      clientSecret: 'secret-456',
      senderAddress: 'contact@axfoundly.com',
      refreshToken: 'token-789',
      accountId: 'acc-001',
    });
    expect(check.missing).toEqual([]);
    expect(check.unknown).toEqual(['zohoGrantCode']);
  });
});
