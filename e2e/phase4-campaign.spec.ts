import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { ALIGO_SMS, SES_EMAIL, apiContext, apiJson, contactIdsByLabel, ensurePlatform, importContacts, waitForCampaign } from './helpers/api';
import { find } from './helpers/db';
import { contactRows, csv, uniquePhone, uniqueTag } from './helpers/files';
import { AUTH_A, AUTH_B } from './fixtures/users';

test.describe.configure({ mode: 'serial' });

let a: APIRequestContext;
let smsId: string;
let emailId: string;

const digits = (p: string): string => p.replace(/-/g, '');

async function createCampaign(body: Record<string, unknown>): Promise<string> {
  const r = await apiJson<{ id: string }>(a, 'POST', '/api/campaigns', {
    campaignName: uniqueTag('CMP'),
    targetFilter: { mode: 'ALL' },
    messageTemplate: { body: '{name}님 안내드립니다', isAd: true },
    ...body,
  });
  return r.id;
}

async function logsOf(jobId: string): Promise<Record<string, unknown>[]> {
  const jobs = await find('dispatchjobs', {});
  const job = jobs.find((j) => String(j._id) === jobId);
  return find('dispatchlogs', { dispatchJobId: job?._id });
}

async function openWizardToStep2(page: Page, tag: string): Promise<void> {
  await page.goto('/campaigns/new');
  await page.getByRole('radio', { name: '문자 (SMS / LMS)' }).check();
  const select = page.getByLabel('발송 플랫폼');
  const opt = select.getByRole('option', { name: /E2E 알리고/ });
  await select.selectOption((await opt.getAttribute('value')) ?? '');
  await page.getByRole('button', { name: '다음 →' }).click();
  await page.getByRole('button', { name: '라벨' }).click();
  await page.getByRole('listbox', { name: '라벨' }).getByText(tag, { exact: true }).click();
  await page.getByRole('heading', { level: 1 }).click(); // 드롭다운 닫기
}

test.describe('Phase 4 — 캠페인 발송', () => {
  test.beforeAll(async () => {
    a = await apiContext(AUTH_A);
    smsId = await ensurePlatform(a, ALIGO_SMS);
    emailId = await ensurePlatform(a, SES_EMAIL);
  });
  test.afterAll(async () => {
    await a.dispose();
  });

  test.describe('플랫폼 미등록', () => {
    test.use({ storageState: AUTH_B });
    test('Step 1 에 안내와 플랫폼 설정 링크 표시', async ({ page }) => {
      await page.goto('/campaigns/new');
      await page.getByRole('radio', { name: '카카오 알림톡' }).check();
      await expect(page.getByText('등록된 카카오 알림톡 플랫폼이 없습니다.')).toBeVisible();
      await page.getByRole('link', { name: '플랫폼 설정 바로가기 →' }).click();
      await expect(page).toHaveURL(/\/platform-config$/);
    });
  });

  test('Step 2: 대상 고객 수와 발송 건수 구분 + TOP_N / RANDOM_N', async ({ page }) => {
    const tag = uniqueTag('P4T');
    await importContacts(a, csv(`${tag}.csv`, contactRows([
      { name: `가${tag}`, p1: uniquePhone(), p2: uniquePhone() },
      { name: `나${tag}`, p1: uniquePhone() },
    ])), { labels: [tag] });

    await openWizardToStep2(page, tag);
    await expect(page.getByTestId('target-count')).toHaveText('2명');
    await expect(page.getByTestId('message-count')).toHaveText('3건');
    await expect(page.getByTestId('estimated-cost')).toHaveText('₩60'); // SMS 20원 × 3

    await page.getByRole('radio', { name: '상위 N명' }).check();
    await page.getByLabel('N (명)').fill('1');
    await expect(page.getByTestId('target-count')).toHaveText('1명');
    await page.getByLabel('정렬 기준').selectOption('name_asc');
    await expect(page.getByTestId('message-count')).toHaveText('2건'); // 이름순 첫 번째 '가' = 번호 2개

    await page.getByRole('radio', { name: '무작위 N명' }).check();
    await page.getByLabel('N (명)').fill('1');
    await expect(page.getByTestId('target-count')).toHaveText('1명');
  });

  test('Step 3~4: 치환 태그 미리보기 · 080 자동 삽입 → 발송 → 로그 생성', async ({ page }) => {
    const tag = uniqueTag('P4S');
    const name = `홍${tag}`;
    const phone = uniquePhone();
    await importContacts(a, csv(`${tag}.csv`, contactRows([{ name, p1: phone }])), { labels: [tag] });

    await openWizardToStep2(page, tag);
    await expect(page.getByTestId('message-count')).toHaveText('1건');
    await page.getByRole('button', { name: '다음 →' }).click();

    await page.getByLabel('캠페인명').fill(`캠페인 ${tag}`);
    await page.getByLabel('본문').fill('님 안녕하세요');
    await page.getByLabel('본문').press('Home');
    await page.getByRole('button', { name: '{name}' }).click();
    await expect(page.getByLabel('본문')).toHaveValue('{name}님 안녕하세요');
    await expect(page.getByTestId('optout-line')).toHaveText('(무료수신거부: 080-123-4567)');
    await expect(page.getByTestId('sms-preview-body')).toHaveText(`(광고) ${name}님 안녕하세요\n(무료수신거부: 080-123-4567)`);
    await page.getByRole('button', { name: '다음 →' }).click();

    const review = page.getByRole('region', { name: 'Step 4 최종 검토' });
    await expect(review).toContainText('1명 → 1건 발송');
    await page.getByRole('button', { name: '🚀 발송' }).click();
    await expect(page).toHaveURL(/\/analytics\/campaigns\/[0-9a-f]{24}$/);
    await expect(page.getByTestId('campaign-status')).toHaveText('완료', { timeout: 15_000 });
    await expect(page.getByTestId('count-success')).toHaveText('1');

    const jobId = page.url().split('/').pop()!;
    const logs = await logsOf(jobId);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ recipient: digits(phone), resultCode: 'SUCCESS', channel: 'SMS', unitCost: 20 });
    const payload = (logs[0].providerResponse as { dryRunPayload: { body: string; smsType: string } }).dryRunPayload;
    expect(payload.body).toBe(`(광고) ${name}님 안녕하세요\n(무료수신거부: 080-123-4567)`);
    expect(payload.smsType).toBe('SMS');

    // 연락처 상세 패널 발송 이력 타임라인
    await page.goto('/contacts');
    await page.getByRole('textbox', { name: '검색' }).fill(name);
    await page.getByRole('button', { name }).click();
    const timeline = page.getByRole('complementary', { name: '연락처 상세' }).getByRole('list', { name: '발송 이력 타임라인' });
    await expect(timeline).toContainText(`캠페인 ${tag}`);
    await expect(timeline).toContainText('성공');
  });

  test('수신거부된 특정 번호만 제외 (같은 연락처의 다른 번호는 발송)', async () => {
    const tag = uniqueTag('P4B');
    const p1 = uniquePhone();
    const p2 = uniquePhone();
    await importContacts(a, csv(`${tag}.csv`, contactRows([{ name: `핀${tag}`, p1, p2 }])), { labels: [tag] });
    const [c] = await contactIdsByLabel(a, tag);
    await apiJson(a, 'PATCH', `/api/contacts/${c.id}`, { recipient: { action: 'block', channel: 'SMS', value: p1 } });

    const est = await apiJson<{ targetCount: number; messageCount: number; blockedCount: number }>(a, 'POST', '/api/campaigns/estimate', {
      platformConfigId: smsId, targetFilter: { mode: 'ALL', labels: [tag] },
    });
    expect(est).toMatchObject({ targetCount: 1, messageCount: 1, blockedCount: 1 });

    const id = await createCampaign({ platformConfigId: smsId, targetFilter: { mode: 'ALL', labels: [tag] } });
    const done = await waitForCampaign(a, id);
    expect(done).toMatchObject({ status: 'COMPLETED', sentCount: 1, failedCount: 0, skippedCount: 1 });
    const logs = await logsOf(id);
    const by = Object.fromEntries(logs.map((l) => [l.recipient, l.resultCode]));
    expect(by).toEqual({ [digits(p1)]: 'SKIPPED', [digits(p2)]: 'SUCCESS' });
  });

  test('일부 실패 → PARTIAL, 과반 실패 → FAILED', async () => {
    const tag = uniqueTag('P4P');
    await importContacts(a, csv(`${tag}.csv`, contactRows([
      { name: '성공1', p1: uniquePhone() }, { name: '성공2', p1: uniquePhone() }, { name: '성공3', p1: uniquePhone() },
      { name: '실패1', p1: uniquePhone('9999') },
    ])), { labels: [tag] });
    const partial = await waitForCampaign(a, await createCampaign({ platformConfigId: smsId, targetFilter: { mode: 'ALL', labels: [tag] } }));
    expect(partial).toMatchObject({ status: 'PARTIAL', sentCount: 3, failedCount: 1 });

    const tag2 = uniqueTag('P4F');
    await importContacts(a, csv(`${tag2}.csv`, contactRows([
      { name: '성공', p1: uniquePhone() }, { name: '실패', p1: uniquePhone('9999') }, { name: '반송', p1: uniquePhone('8888') },
    ])), { labels: [tag2] });
    const failed = await waitForCampaign(a, await createCampaign({ platformConfigId: smsId, targetFilter: { mode: 'ALL', labels: [tag2] } }));
    expect(failed).toMatchObject({ status: 'FAILED', sentCount: 1, failedCount: 2 });
  });

  test('이메일: 치환 제목 + 수신거부 링크 + RFC 8058 헤더, 다중 이메일 각각 발송', async () => {
    const tag = uniqueTag('P4E');
    await importContacts(a, csv(`${tag}.csv`, contactRows([{ name: `메일${tag}`, e1: `one-${tag}@e2e.test`, e2: `two-${tag}@e2e.test` }])), { labels: [tag] });
    const id = await createCampaign({
      platformConfigId: emailId,
      targetFilter: { mode: 'ALL', labels: [tag] },
      messageTemplate: { subject: '{name}님께', body: '<b>안녕</b>', isHtml: true },
    });
    expect(await waitForCampaign(a, id)).toMatchObject({ status: 'COMPLETED', sentCount: 2 });
    const logs = await logsOf(id);
    expect(logs).toHaveLength(2);
    for (const l of logs) {
      const p = (l.providerResponse as { dryRunPayload: { subject: string; html: string; headers: Record<string, string> } }).dryRunPayload;
      expect(p.subject).toBe(`메일${tag}님께`);
      expect(p.html).toContain('<b>안녕</b>');
      expect(p.html).toMatch(/\/unsubscribe\?token=[\w-]+\.[\w-]+/);
      expect(p.headers['List-Unsubscribe']).toMatch(/^<http:\/\/localhost:3100\/api\/unsubscribe\?token=[^>]+>, <mailto:sender@e2e\.test\?subject=unsubscribe>$/);
      expect(p.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    }
  });

  test('카카오 알림톡 실패 시 LMS 자동 대체 발송', async () => {
    const kakaoId = await ensurePlatform(a, {
      channel: 'KAKAO', provider: 'SOLAPI', name: 'E2E 알림톡',
      configData: { apiKey: 'k', apiSecret: 's', senderNumber: '01000000000', kakaoPfId: 'pf', kakaoTemplateId: 'tpl' },
    });
    const lmsId = await ensurePlatform(a, {
      channel: 'LMS', provider: 'SOLAPI', name: 'E2E 솔라피 LMS',
      configData: { apiKey: 'k', apiSecret: 's', senderNumber: '01000000000', optOutNumber: '080-765-4321' },
    });
    const tag = uniqueTag('P4K');
    const ok = uniquePhone();
    const fb = uniquePhone('7777');
    await importContacts(a, csv(`${tag}.csv`, contactRows([{ name: '알림톡성공', p1: ok }, { name: '대체발송', p1: fb }])), { labels: [tag] });
    const id = await createCampaign({
      platformConfigId: kakaoId, fallbackToLms: true, fallbackConfigId: lmsId,
      targetFilter: { mode: 'ALL', labels: [tag] }, messageTemplate: { body: '{name}님 예약 안내', isAd: true },
    });
    expect(await waitForCampaign(a, id)).toMatchObject({ status: 'COMPLETED', sentCount: 2, failedCount: 0 });
    const logs = Object.fromEntries((await logsOf(id)).map((l) => [l.recipient, l]));
    expect(logs[digits(ok)]).toMatchObject({ channel: 'KAKAO', isFallback: false, resultCode: 'SUCCESS' });
    expect(logs[digits(fb)]).toMatchObject({ channel: 'LMS', isFallback: true, resultCode: 'SUCCESS' });
    const body = (logs[digits(fb)].providerResponse as { dryRunPayload: { body: string } }).dryRunPayload.body;
    expect(body).toContain('(무료수신거부: 080-765-4321)');
  });

  test('080 번호 없는 문자 플랫폼으로 광고 발송은 거부', async () => {
    const noOptOut = await ensurePlatform(a, {
      channel: 'SMS', provider: 'SOLAPI', name: 'E2E 080없음',
      configData: { apiKey: 'k', apiSecret: 's', senderNumber: '01000000000' },
    });
    const res = await a.post('/api/campaigns', {
      data: { campaignName: 'x', platformConfigId: noOptOut, targetFilter: { mode: 'ALL' }, messageTemplate: { body: '광고', isAd: true } },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe('OPT_OUT_REQUIRED');
  });

  test('예약 발송은 PENDING 유지 → 취소 가능', async ({ page }) => {
    const tag = uniqueTag('P4R');
    await importContacts(a, csv(`${tag}.csv`, contactRows([{ name: `예약${tag}`, p1: uniquePhone() }])), { labels: [tag] });
    const at = new Date(Date.now() + 3 * 3600_000).toISOString();
    const id = await createCampaign({ platformConfigId: smsId, targetFilter: { mode: 'ALL', labels: [tag] }, scheduledAt: at });
    await page.goto(`/analytics/campaigns/${id}`);
    await expect(page.getByTestId('campaign-status')).toHaveText('대기');
    await expect(page.getByText(/예약:/)).toBeVisible();
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: '발송 취소' }).click();
    await expect(page.getByTestId('campaign-status')).toHaveText('취소');
    expect(await logsOf(id)).toHaveLength(0);
  });

  test('테넌트 격리: B 는 A 의 캠페인/로그/플랫폼으로 발송 불가', async () => {
    const b = await apiContext(AUTH_B);
    const [job] = await apiJson<{ id: string }[]>(a, 'GET', '/api/campaigns');
    expect((await b.get(`/api/campaigns/${job.id}`)).status()).toBe(404);
    expect((await b.get(`/api/campaigns/${job.id}/logs`)).status()).toBe(404);
    expect((await b.get(`/api/campaigns/${job.id}/logs/export`)).status()).toBe(404);
    expect((await b.post(`/api/campaigns/${job.id}/cancel`)).status()).toBe(404);
    const res = await b.post('/api/campaigns', { data: { campaignName: 'x', platformConfigId: smsId, targetFilter: { mode: 'ALL' }, messageTemplate: { body: 'x' } } });
    expect(res.status()).toBe(404);
    await b.dispose();
  });
});
