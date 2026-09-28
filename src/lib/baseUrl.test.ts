import { describe, expect, it } from 'vitest';
import { isPublicUrl } from './baseUrl';

describe('isPublicUrl — 수신거부 링크를 수신자가 열 수 있는 주소인가', () => {
  it.each([
    'https://msg.axfoundly.com',
    'https://example.co.kr/app',
    'http://203.0.113.10:8080',
  ])('공개: %s', (u) => expect(isPublicUrl(u)).toBe(true));

  it.each([
    'http://localhost:3110',
    'http://app.localhost',
    'http://127.0.0.1:3000',
    'http://10.1.2.3',
    'http://172.20.0.5',
    'http://192.168.0.10',
    'http://169.254.1.1',
    'http://myhost.local',
    'http://host.docker.internal',
    'http://[::1]:3000',
    '',
    'not a url',
  ])('비공개/무효: %s', (u) => expect(isPublicUrl(u)).toBe(false));
});
