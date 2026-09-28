import { expect, test } from '@playwright/test';
import { apiContext, apiJson } from './helpers/api';
import { findOne } from './helpers/db';
import { AUTH_A, AUTH_B } from './fixtures/users';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 2 — 플랫폼 연동 설정', () => {
  test.beforeAll(async () => {
    // 재시도·재실행에도 동일한 시작 상태 보장: A 의 기존 설정 삭제
    const ctx = await apiContext(AUTH_A);
    for (const c of await apiJson<{ id: string }[]>(ctx, 'GET', '/api/platform-configs')) {
      await apiJson(ctx, 'DELETE', `/api/platform-configs/${c.id}`);
    }
    await ctx.dispose();
  });

  test('공급사 선택 시 변수 가이드 + KEY=VALUE 붙여넣기 자동 채움 + 누락 경고', async ({ page }) => {
    await page.goto('/platform-config');
    await page.getByRole('button', { name: '새 플랫폼 추가' }).click();
    await page.getByLabel('발송 채널').selectOption('SMS');
    await page.getByLabel('공급사').selectOption('ALIGO');

    const guide = page.getByLabel('변수 가이드');
    await expect(guide).toContainText('API Key');
    await expect(guide).toContainText('080 무료수신거부 번호');

    await page.getByLabel('일괄 입력 (JSON 또는 KEY=VALUE)').fill('API_KEY=aligo-key-ABCD1234\nUSER_ID=e2e-user\nFOO=bar');
    await expect(page.getByLabel('API Key')).toHaveValue('aligo-key-ABCD1234');
    await expect(page.getByLabel('User ID')).toHaveValue('e2e-user');
    const notice = page.getByRole('status').filter({ hasText: '항목을 채웠습니다' });
    await expect(notice).toContainText('누락된 필수 항목: 발신 번호');
    await expect(notice).toContainText('알 수 없는 키(무시됨): foo');
    await expect(page.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  test('JSON 붙여넣기 → 연결 테스트(DRY_RUN) → 저장 → 마스킹 표시', async ({ page }) => {
    await page.goto('/platform-config');
    await page.getByRole('button', { name: '새 플랫폼 추가' }).click();
    await page.getByLabel('발송 채널').selectOption('SMS');
    await page.getByLabel('공급사').selectOption('ALIGO');
    await page
      .getByLabel('일괄 입력 (JSON 또는 KEY=VALUE)')
      .fill('{"apiKey": "aligo-key-ABCD1234", "userId": "e2e-user", "senderNumber": "01012345678", "optOutNumber": "0801234567"}');
    await expect(page.getByRole('status').filter({ hasText: '4개 항목을 채웠습니다' })).toBeVisible();

    const form = page.getByRole('region', { name: '새 플랫폼 추가' });
    await form.getByRole('button', { name: '연결 테스트' }).click();
    await expect(form.getByRole('status').filter({ hasText: 'DRY_RUN: ALIGO 연결 테스트 성공' })).toBeVisible();

    await form.getByRole('button', { name: '저장' }).click();
    const card = page.getByTestId('platform-card').filter({ hasText: '알리고 SMS' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('정상');
    await expect(card).toContainText('****1234');
    await expect(card).toContainText('080-123-4567');
    await expect(card).not.toContainText('aligo-key-ABCD1234');
  });

  test('DB 에는 비밀값이 암호문으로, API 응답에는 평문이 없음', async () => {
    const ctx = await apiContext(AUTH_A);
    const list = await apiJson<{ id: string; provider: string; configData: Record<string, string> }[]>(ctx, 'GET', '/api/platform-configs');
    const cfg = list.find((c) => c.provider === 'ALIGO');
    expect(cfg?.configData.apiKey).toBe('****1234');
    expect(JSON.stringify(list)).not.toContain('aligo-key-ABCD1234');

    const doc = await findOne('platformconfigs', { provider: 'ALIGO' });
    const stored = doc?.configData as Record<string, string>;
    expect(stored.apiKey).toMatch(/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
    expect(stored.userId).toBe('e2e-user'); // 비밀 아님 → 평문
    await ctx.dispose();
  });

  test('수정 시 마스킹 값을 그대로 두면 기존 키 유지', async () => {
    const ctx = await apiContext(AUTH_A);
    const list = await apiJson<{ id: string; provider: string; configData: Record<string, string> }[]>(ctx, 'GET', '/api/platform-configs');
    const cfg = list.find((c) => c.provider === 'ALIGO')!;
    const r = await apiJson<{ test: { connected: boolean } }>(ctx, 'PUT', `/api/platform-configs/${cfg.id}`, {
      configData: { ...cfg.configData, senderNumber: '01099998888' },
    });
    expect(r.test.connected).toBe(true);
    const after = await apiJson<{ id: string; configData: Record<string, string> }[]>(ctx, 'GET', '/api/platform-configs');
    const updated = after.find((c) => c.id === cfg.id)!;
    expect(updated.configData.apiKey).toBe('****1234');
    expect(updated.configData.senderNumber).toBe('01099998888');
    await ctx.dispose();
  });

  test('연결 테스트 실패 시 오류 메시지', async ({ page }) => {
    await page.goto('/platform-config');
    await page.getByRole('button', { name: '새 플랫폼 추가' }).click();
    await page.getByLabel('발송 채널').selectOption('EMAIL');
    await page.getByLabel('공급사').selectOption('AWS_SES');
    await page.getByLabel('일괄 입력 (JSON 또는 KEY=VALUE)').fill('ACCESS_KEY_ID=invalid\nSECRET_ACCESS_KEY=x\nSENDER_ADDRESS=a@b.com');
    const form = page.getByRole('region', { name: '새 플랫폼 추가' });
    await form.getByLabel('Region').fill('ap-northeast-2');
    await form.getByRole('button', { name: '연결 테스트' }).click();
    await expect(form.getByRole('alert').filter({ hasText: 'accessKeyId 값이 유효하지 않습니다' })).toBeVisible();
  });

  test('잘못된 080 번호 형식은 저장 거부', async () => {
    const ctx = await apiContext(AUTH_A);
    const res = await ctx.post('/api/platform-configs', {
      data: { channel: 'LMS', provider: 'SOLAPI', configData: { apiKey: 'k', apiSecret: 's', senderNumber: '01000000000', optOutNumber: '010-1111-2222' } },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_OPT_OUT');
    await ctx.dispose();
  });

  test('테넌트 격리: B 사용자는 A 의 설정에 접근할 수 없음 (404)', async () => {
    const a = await apiContext(AUTH_A);
    const b = await apiContext(AUTH_B);
    const list = await apiJson<{ id: string }[]>(a, 'GET', '/api/platform-configs');
    const id = list[0].id;
    expect((await b.put(`/api/platform-configs/${id}`, { data: { name: 'hacked' } })).status()).toBe(404);
    expect((await b.delete(`/api/platform-configs/${id}`)).status()).toBe(404);
    expect((await b.post(`/api/platform-configs/${id}/test`)).status()).toBe(404);
    expect(await apiJson<unknown[]>(b, 'GET', '/api/platform-configs')).toEqual([]);
    await a.dispose();
    await b.dispose();
  });
});
