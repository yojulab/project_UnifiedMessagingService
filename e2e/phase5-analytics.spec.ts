import { expect, test, type APIRequestContext } from '@playwright/test';
import { ALIGO_SMS, SES_EMAIL, apiContext, apiJson, contactIdsByLabel, ensurePlatform, importContacts, waitForCampaign } from './helpers/api';
import { find } from './helpers/db';
import { bodyRows } from './helpers/ui';
import { contactRows, csv, uniquePhone, uniqueTag } from './helpers/files';
import { AUTH_A, USER_A } from './fixtures/users';

test.describe.configure({ mode: 'serial' });

let a: APIRequestContext;
let smsId: string;
let emailId: string;

async function runCampaign(platformConfigId: string, label: string, template: Record<string, unknown>): Promise<string> {
  const { id } = await apiJson<{ id: string }>(a, 'POST', '/api/campaigns', {
    campaignName: `통계 ${label}`, platformConfigId, targetFilter: { mode: 'ALL', labels: [label] }, messageTemplate: template,
  });
  await waitForCampaign(a, id);
  return id;
}

test.describe('Phase 5 — 발송 결과 & 수신거부 & 테마', () => {
  test.beforeAll(async () => {
    a = await apiContext(AUTH_A);
    smsId = await ensurePlatform(a, ALIGO_SMS);
    emailId = await ensurePlatform(a, SES_EMAIL);
  });
  test.afterAll(async () => {
    await a.dispose();
  });

  test('캠페인 상세 수치 = DispatchLog 집계, 로그 필터, CSV 다운로드', async ({ page }) => {
    const tag = uniqueTag('P5A');
    await importContacts(a, csv(`${tag}.csv`, contactRows([
      { name: '성공가', p1: uniquePhone() }, { name: '성공나', p1: uniquePhone() },
      { name: '실패다', p1: uniquePhone('9999') }, { name: '반송라', p1: uniquePhone('8888') },
    ])), { labels: [tag] });
    const id = await runCampaign(smsId, tag, { body: '{name}님', isAd: true });

    const logs = await find('dispatchlogs', { resultCode: { $exists: true } });
    const mine = logs.filter((l) => String(l.dispatchJobId) === id);
    const count = (rc: string): string => String(mine.filter((l) => l.resultCode === rc).length);

    await page.goto(`/analytics/campaigns/${id}`);
    await expect(page.getByTestId('campaign-status')).toHaveText('부분성공');
    await expect(page.getByTestId('count-success')).toHaveText(count('SUCCESS'));
    await expect(page.getByTestId('count-failed')).toHaveText(count('FAILED'));
    await expect(page.getByTestId('count-bounced')).toHaveText(count('BOUNCED'));
    expect(count('SUCCESS')).toBe('2');

    const table = page.getByRole('table', { name: '발송 로그' });
    await expect(bodyRows(table)).toHaveCount(4);
    await page.getByLabel('결과').selectOption('FAILED');
    await expect(bodyRows(table)).toHaveCount(1);
    await expect(table).toContainText('실패다');

    await page.getByLabel('결과').selectOption('');
    const link = page.getByRole('link', { name: 'CSV 내보내기' });
    // 파일명 헤더 검증 (headless shell 은 비 ASCII filename* 를 'download' 로 대체하므로 브라우저 해석 대신 서버 헤더를 확인)
    const head = await page.context().request.get((await link.getAttribute('href'))!);
    expect(head.headers()['content-disposition']).toContain(`filename*=UTF-8''${encodeURIComponent(`통계 ${tag}_발송로그.csv`)}`);
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    const text = (await (await download.createReadStream()).toArray()).map((c: Buffer) => c.toString('utf8')).join('');
    expect(text.startsWith('﻿이름,수신자,채널,공급사,결과')).toBe(true);
    expect(text.trim().split('\r\n')).toHaveLength(5);
    expect(text).toContain('반송라');
  });

  test('통계 대시보드: KPI + 일별 차트(범례·표 보기)', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page.getByText('발송 시도')).toBeVisible();
    const chart = page.getByRole('figure', { name: '일별 발송 추이' });
    await expect(chart.getByLabel('범례')).toContainText('성공');
    await expect(chart.getByLabel('범례')).toContainText('실패 · 반송');
    await chart.getByText('표로 보기').click();
    await expect(bodyRows(chart.getByRole('table')).first()).toBeVisible();
    const summary = await apiJson<{ attempted: number; success: number }>(a, 'GET', '/api/analytics/summary');
    expect(summary.attempted).toBeGreaterThan(0);
  });

  test('이메일 수신거부: GET 은 확인 페이지로만 이동 → 확인 후 반영, RFC 8058 원클릭 POST 멱등', async ({ page }) => {
    const tag = uniqueTag('P5U');
    const email = `unsub-${tag.toLowerCase()}@e2e.test`;
    await importContacts(a, csv(`${tag}.csv`, contactRows([{ name: `거부${tag}`, e1: email }])), { labels: [tag] });
    const id = await runCampaign(emailId, tag, { subject: '안내', body: '본문' });
    const [log] = (await find('dispatchlogs', {})).filter((l) => String(l.dispatchJobId) === id);
    const header = (log.providerResponse as { dryRunPayload: { headers: Record<string, string> } }).dryRunPayload.headers['List-Unsubscribe'];
    const apiUrl = /<(http[^>]+)>/.exec(header)![1];
    const token = new URL(apiUrl).searchParams.get('token')!;
    const [contact] = await contactIdsByLabel(a, tag);
    const blocked = async (): Promise<boolean> =>
      (await apiJson<{ emails: { emailBlocked: boolean }[] }>(a, 'GET', `/api/contacts/${contact.id}`)).emails[0].emailBlocked;

    // 링크 GET (메일 스캐너 프리패치) → 상태 변화 없음
    await page.goto(new URL(apiUrl).pathname + new URL(apiUrl).search);
    await expect(page).toHaveURL(/\/unsubscribe\?token=/);
    await expect(page.getByRole('heading', { name: '이메일 수신거부' })).toBeVisible();
    await expect(page.getByText(/un\*+@e2e\.test/)).toBeVisible();
    expect(await blocked()).toBe(false);

    await page.getByRole('button', { name: '수신거부' }).click();
    await expect(page.getByRole('status').filter({ hasText: '수신거부가 완료되었습니다' })).toBeVisible();
    expect(await blocked()).toBe(true);

    // RFC 8058 원클릭 (form body) — 비로그인, 멱등
    const anon = await page.context().request;
    const res = await anon.post(`/api/unsubscribe?token=${encodeURIComponent(token)}`, { form: { 'List-Unsubscribe': 'One-Click' } });
    expect(res.status()).toBe(200);
    expect(await find('suppressions', { channel: 'EMAIL', value: email })).toHaveLength(1);

    // 다음 이메일 캠페인에서 제외
    const again = await apiJson<{ messageCount: number; blockedCount: number }>(a, 'POST', '/api/campaigns/estimate', {
      platformConfigId: emailId, targetFilter: { mode: 'ALL', labels: [tag] },
    });
    expect(again).toMatchObject({ messageCount: 0, blockedCount: 1 });
  });

  test.describe('위조 토큰', () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    test('확인 페이지는 오류 표시, POST 는 400', async ({ page, request }) => {
      await page.goto('/unsubscribe?token=eyJjIjoiMSJ9.forged');
      await expect(page.getByRole('alert').filter({ hasText: '유효하지 않거나 만료된 수신거부 링크' })).toBeVisible();
      const res = await request.post('/api/unsubscribe', { data: { token: 'eyJjIjoiMSJ9.forged' } });
      expect(res.status()).toBe(400);
      expect((await res.json()).error.code).toBe('INVALID_TOKEN');
    });
  });

  test('080 수신거부 CSV 업로드 → 해당 번호만 제외, 목록·CSV 내보내기', async ({ page }) => {
    const tag = uniqueTag('P5O');
    const p1 = uniquePhone();
    const p2 = uniquePhone();
    await importContacts(a, csv(`${tag}.csv`, contactRows([{ name: `080${tag}`, p1, p2 }])), { labels: [tag] });
    await page.goto('/analytics/unsubscribes');
    const unknown = uniquePhone(); // 연락처가 없는 번호도 억제 목록에 저장된다 (#25)
    await page.getByLabel('080 수신거부 파일 업로드').setInputFiles(csv(`optout-${tag}.csv`, [['수신거부번호'], [p1], [unknown]]));
    await expect(page.getByRole('status').filter({ hasText: '080 수신거부 반영' })).toContainText('번호 2개 · 일치 연락처 1명 · 신규 거부 2건');
    await expect(bodyRows(page.getByRole('table', { name: '수신거부 목록' })).filter({ hasText: unknown })).toContainText('(연락처 없음)');
    const table = page.getByRole('table', { name: '수신거부 목록' });
    await expect(bodyRows(table).filter({ hasText: `080${tag}` })).toContainText('080 수신거부');

    const est = await apiJson<{ messageCount: number; blockedCount: number }>(a, 'POST', '/api/campaigns/estimate', {
      platformConfigId: smsId, targetFilter: { mode: 'ALL', labels: [tag] },
    });
    expect(est).toMatchObject({ messageCount: 1, blockedCount: 1 });

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'CSV 내보내기' }).click()]);
    const text = (await (await download.createReadStream()).toArray()).map((c: Buffer) => c.toString('utf8')).join('');
    expect(text).toContain(`080${tag}`);
  });

  test('수신거부는 연락처와 독립: 연락처 없는 번호의 웹훅 거부 → 이후 업로드해도 제외', async ({ request }) => {
    const tag = uniqueTag('P5N');
    const phone = uniquePhone();
    const urls = await apiJson<Record<string, string>>(a, 'GET', '/api/me/webhook');
    const res = await request.post(new URL(urls.SOLAPI).pathname + new URL(urls.SOLAPI).search, { form: { phone } });
    expect((await res.json()).data).toMatchObject({ received: 1, matchedContacts: 0, newlyBlocked: 1 });

    await importContacts(a, csv(`${tag}.csv`, contactRows([{ name: `나중${tag}`, p1: phone }])), { labels: [tag] });
    const est = await apiJson<{ messageCount: number; blockedCount: number }>(a, 'POST', '/api/campaigns/estimate', {
      platformConfigId: smsId, targetFilter: { mode: 'ALL', labels: [tag] },
    });
    expect(est).toMatchObject({ messageCount: 0, blockedCount: 1 });
  });

  test('수신거부는 연락처와 독립: 삭제 후 재업로드 · create_new 중복 연락처도 제외', async () => {
    const tag = uniqueTag('P5D');
    const phone = uniquePhone();
    const file = csv(`${tag}.csv`, contactRows([{ name: `재업${tag}`, p1: phone }]));
    await importContacts(a, file, { labels: [tag] });
    const [c] = await contactIdsByLabel(a, tag);
    await apiJson(a, 'PATCH', `/api/contacts/${c.id}`, { recipient: { action: 'block', channel: 'SMS', value: phone } });

    // create_new 로 같은 번호의 연락처를 다른 라벨로 추가 → 그 라벨 캠페인에서도 제외
    const vip = uniqueTag('P5V');
    await importContacts(a, file, { labels: [vip], duplicateHandling: 'create_new' });
    const vipEst = await apiJson<{ messageCount: number }>(a, 'POST', '/api/campaigns/estimate', {
      platformConfigId: smsId, targetFilter: { mode: 'ALL', labels: [vip] },
    });
    expect(vipEst.messageCount).toBe(0);

    // 모든 연락처 삭제 후 재업로드 → 여전히 제외
    for (const x of [...(await contactIdsByLabel(a, tag)), ...(await contactIdsByLabel(a, vip))]) {
      await apiJson(a, 'DELETE', `/api/contacts/${x.id}`);
    }
    await importContacts(a, file, { labels: [tag] });
    const est = await apiJson<{ messageCount: number; blockedCount: number }>(a, 'POST', '/api/campaigns/estimate', {
      platformConfigId: smsId, targetFilter: { mode: 'ALL', labels: [tag] },
    });
    expect(est).toMatchObject({ messageCount: 0, blockedCount: 1 });
    const [again] = await contactIdsByLabel(a, tag);
    const d = await apiJson<{ phones: { smsBlocked: boolean; reason: string }[] }>(a, 'GET', `/api/contacts/${again.id}`);
    expect(d.phones[0]).toMatchObject({ smsBlocked: true, reason: 'MANUAL' });
  });

  test('080 웹훅: 서명 검증 후 반영, 잘못된 서명은 401', async ({ request }) => {
    const tag = uniqueTag('P5W');
    const phone = uniquePhone();
    await importContacts(a, csv(`${tag}.csv`, contactRows([{ name: `웹훅${tag}`, p1: phone }])), { labels: [tag] });
    const urls = await apiJson<Record<string, string>>(a, 'GET', '/api/me/webhook');
    const url = new URL(urls.ALIGO);
    const bad = await request.post(`${url.pathname}?uid=${url.searchParams.get('uid')}&sig=deadbeef`, { data: { phone } });
    expect(bad.status()).toBe(401);
    const ok = await request.post(url.pathname + url.search, { data: { phone } });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).data).toMatchObject({ received: 1, newlyBlocked: 1 });
    const [c] = await contactIdsByLabel(a, tag);
    const d = await apiJson<{ phones: { smsBlocked: boolean }[] }>(a, 'GET', `/api/contacts/${c.id}`);
    expect(d.phones[0].smsBlocked).toBe(true);
  });

  test('테마: 모드·강조색 변경 즉시 반영, 새로고침·재로그인 후 유지', async ({ page, browser }) => {
    await page.goto('/settings');
    const html = page.locator('html');
    await page.getByRole('radio', { name: '다크' }).check();
    await expect(html).toHaveClass(/dark/);
    await page.getByRole('button', { name: '강조 색상 Emerald' }).click();
    await expect(html).toHaveAttribute('data-accent', 'emerald');
    await expect(page.getByRole('button', { name: '강조 색상 Emerald' })).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(html).toHaveAttribute('data-accent', 'emerald');
    await expect(html).toHaveClass(/dark/);

    // 새 브라우저 컨텍스트(로컬 저장소 없음)에서 재로그인 → DB 값으로 복원
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const p2 = await ctx.newPage();
    await p2.goto('/login');
    await p2.getByLabel('이메일').fill(USER_A.email);
    await p2.getByLabel('비밀번호').fill(USER_A.password);
    await p2.getByRole('button', { name: '로그인' }).click();
    await expect(p2).toHaveURL(/\/dashboard/);
    await expect(p2.locator('html')).toHaveAttribute('data-accent', 'emerald');
    await expect(p2.locator('html')).toHaveClass(/dark/);
    await ctx.close();

    // 시스템 모드: OS 설정(prefers-color-scheme)을 따른다
    await page.getByRole('radio', { name: '시스템' }).check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(html).toHaveClass(/dark/);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(html).not.toHaveClass(/dark/);

    // 원복 (다른 스펙 영향 방지)
    await page.getByRole('radio', { name: '라이트' }).check();
    await page.getByRole('button', { name: '강조 색상 Blue' }).click();
    await expect(html).toHaveAttribute('data-accent', 'blue');
  });

  test('기본 발신자 프로필 저장', async ({ page }) => {
    await page.goto('/settings');
    const form = page.getByRole('form', { name: '기본 발신자 프로필' });
    await form.getByLabel('기본 발신 번호').fill('010-2405-8735');
    await form.getByRole('button', { name: '프로필 저장' }).click();
    await expect(page.getByRole('status').filter({ hasText: '프로필을 저장했습니다' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('form', { name: '기본 발신자 프로필' }).getByLabel('기본 발신 번호')).toHaveValue('01024058735');
  });
});
