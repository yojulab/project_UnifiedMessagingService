import { expect, test, type Page } from '@playwright/test';
import { apiContext, apiJson, contactIdsByLabel, importContacts } from './helpers/api';
import { find } from './helpers/db';
import { bodyRows } from './helpers/ui';
import { contactRows, cp949Csv, csv, uniquePhone, uniqueTag, xlsx, type FilePayload } from './helpers/files';
import { AUTH_A, AUTH_B } from './fixtures/users';

test.describe.configure({ mode: 'serial' });

async function uploadAndPreview(page: Page, file: FilePayload): Promise<void> {
  await page.goto('/contacts/upload');
  await page.getByLabel('연락처 파일 업로드').setInputFiles(file);
  await expect(page.getByRole('region', { name: '미리보기' })).toContainText(file.name);
}

function fourRows(prefix: string): { name: string; p1: string; p2: string; e1: string; e2: string; company: string }[] {
  return [1, 2, 3, 4].map((i) => ({
    name: `${prefix}${i}`,
    p1: uniquePhone(),
    p2: i === 1 ? uniquePhone() : '',
    e1: `${prefix.toLowerCase()}${i}-${Date.now()}@e2e.test`,
    e2: i === 1 ? `${prefix.toLowerCase()}${i}b-${Date.now()}@e2e.test` : '',
    company: `회사${i}`,
  }));
}

test.describe('Phase 3 — 연락처 허브', () => {
  const variants: [string, (rows: ReturnType<typeof fourRows>) => FilePayload][] = [
    ['xlsx', (r) => xlsx(`${uniqueTag('x')}.xlsx`, contactRows(r))],
    ['xls', (r) => xlsx(`${uniqueTag('xl')}.xls`, contactRows(r), 'biff8')],
    ['csv(UTF-8)', (r) => csv(`${uniqueTag('c')}.csv`, contactRows(r))],
    ['tsv', (r) => csv(`${uniqueTag('t')}.tsv`, contactRows(r), '\t')],
    ['txt(파이프)', (r) => csv(`${uniqueTag('p')}.txt`, contactRows(r), '|')],
  ];

  for (const [label, make] of variants) {
    test(`${label} 업로드 → 상위 3행 미리보기 → 자동 추천 매핑 → 가져오기`, async ({ page }) => {
      const rows = fourRows('김');
      const file = make(rows);
      await uploadAndPreview(page, file);
      const sample = page.getByRole('table', { name: '샘플 데이터' });
      await expect(bodyRows(sample)).toHaveCount(3);
      await expect(sample).toContainText(rows[0].name);
      await expect(page.getByLabel('이름 컬럼')).toHaveValue('이름');
      await expect(page.getByRole('checkbox', { name: '전화번호: 연락처 1' })).toBeChecked();
      await expect(page.getByRole('checkbox', { name: '전화번호: 연락처 2' })).toBeChecked();
      await expect(page.getByRole('checkbox', { name: '이메일: 이메일 1' })).toBeChecked();
      await page.getByRole('button', { name: '4행 가져오기' }).click();
      await expect(page.getByTestId('import-result')).toContainText('신규 4');
    });
  }

  test('CP949(EUC-KR) CSV 한글 헤더/이름 인식', async ({ page }) => {
    const phones = [uniquePhone(), uniquePhone()];
    await uploadAndPreview(page, cp949Csv(`${uniqueTag('cp')}.csv`, phones));
    const sample = page.getByRole('table', { name: '샘플 데이터' });
    await expect(sample.getByRole('columnheader', { name: '이름' })).toBeVisible();
    await expect(sample.getByRole('columnheader', { name: '전화' })).toBeVisible();
    await expect(sample).toContainText('홍길동');
    await expect(page.getByLabel('이름 컬럼')).toHaveValue('이름');
    await page.getByRole('button', { name: '2행 가져오기' }).click();
    await expect(page.getByTestId('import-result')).toContainText('신규 2');
  });

  test('전화 2열·이메일 2열 매핑 → 상세 패널에 모두 표시, 라벨·출처 기록', async ({ page }) => {
    const tag = uniqueTag('MAP');
    const p1 = uniquePhone();
    const p2 = uniquePhone();
    const name = `다중연락${Date.now() % 10000}`;
    const file = csv(`${tag}.csv`, contactRows([{ name, p1, p2, e1: `a-${tag}@e2e.test`, e2: `b-${tag}@e2e.test`, company: 'MULTI' }]));
    await uploadAndPreview(page, file);
    await page.getByLabel('일괄 부여할 라벨 (쉼표 구분)').fill(tag);
    await page.getByRole('button', { name: '1행 가져오기' }).click();
    await expect(page.getByTestId('import-result')).toContainText('신규 1');

    await page.goto('/contacts');
    await page.getByRole('textbox', { name: '검색' }).fill(name);
    await page.getByRole('button', { name }).click();
    const panel = page.getByRole('complementary', { name: '연락처 상세' });
    const phones = panel.getByRole('list', { name: '전화번호 목록' });
    await expect(phones.getByRole('listitem')).toHaveCount(2);
    await expect(phones).toContainText(p1);
    await expect(phones).toContainText(p2);
    await expect(panel.getByRole('list', { name: '이메일 목록' }).getByRole('listitem')).toHaveCount(2);
    await expect(panel).toContainText(tag);
    await expect(panel).toContainText(`${tag}.csv`);

    const docs = await find('contacts', { name });
    expect(docs[0].phones).toEqual([p1.replace(/-/g, ''), p2.replace(/-/g, '')]);
  });

  test('중복 처리: skip / overwrite(수신거부 유지) / create_new', async () => {
    const ctx = await apiContext(AUTH_A);
    const tag = uniqueTag('DUP');
    const p = uniquePhone();
    const base = (company: string): FilePayload => csv(`${tag}.csv`, contactRows([{ name: `중복${tag}`, p1: p, company }]));

    expect((await importContacts(ctx, base('A사'), { labels: [tag] })).importedRows).toBe(1);
    const [c] = await contactIdsByLabel(ctx, tag);
    await apiJson(ctx, 'PATCH', `/api/contacts/${c.id}`, { recipient: { action: 'block', channel: 'SMS', value: p } });

    const skip = await importContacts(ctx, base('B사'), { duplicateHandling: 'skip', labels: [tag] });
    expect(skip).toMatchObject({ importedRows: 0, skippedRows: 1 });

    const ow = await importContacts(ctx, base('C사'), { duplicateHandling: 'overwrite', labels: [tag, 'OW'] });
    expect(ow).toMatchObject({ importedRows: 0, updatedRows: 1 });
    const detail = await apiJson<{ company: string; labels: string[]; phones: { smsBlocked: boolean }[] }>(ctx, 'GET', `/api/contacts/${c.id}`);
    expect(detail.company).toBe('C사');
    expect(detail.labels).toEqual(expect.arrayContaining([tag, 'OW']));
    expect(detail.phones[0].smsBlocked).toBe(true); // 덮어쓰기로 수신거부 해제되지 않음

    const cn = await importContacts(ctx, base('D사'), { duplicateHandling: 'create_new', labels: [tag] });
    expect(cn.importedRows).toBe(1);
    expect(await contactIdsByLabel(ctx, tag)).toHaveLength(2);
    await ctx.dispose();
  });

  test('UploadHistory 집계 = 결과, 무효 행은 건너뜀 + 경고', async ({ page }) => {
    const tag = uniqueTag('HIS');
    const file = csv(`${tag}.csv`, contactRows([{ name: '정상', p1: uniquePhone() }, { name: '', p1: uniquePhone() }, { name: '번호오류', p1: '12-34' }]));
    await uploadAndPreview(page, file);
    await page.getByRole('button', { name: '3행 가져오기' }).click();
    await expect(page.getByTestId('import-result')).toContainText('신규 1');
    await expect(page.getByTestId('import-result')).toContainText('건너뜀 2');
    const [h] = await find('uploadhistories', { originalFileName: `${tag}.csv` });
    expect(h).toMatchObject({ totalRows: 3, importedRows: 1, skippedRows: 2, status: 'COMPLETED' });
  });

  test('검색 · 출처 · 라벨 · 수신거부 필터', async ({ page }) => {
    const ctx = await apiContext(AUTH_A);
    const tag = uniqueTag('FLT');
    const file = csv(`${tag}.csv`, contactRows([
      { name: `필터가${tag}`, p1: uniquePhone(), company: 'ALPHA' },
      { name: `필터나${tag}`, p1: uniquePhone(), company: 'BETA' },
    ]));
    await importContacts(ctx, file, { labels: [tag] });
    const [c1] = (await contactIdsByLabel(ctx, tag)).filter((c) => c.name.startsWith('필터가'));
    await apiJson(ctx, 'PATCH', `/api/contacts/${c1.id}`, { unsubscribeAll: true });

    await page.goto('/contacts');
    const table = page.getByRole('table', { name: '연락처 목록' });
    await page.getByRole('textbox', { name: '검색' }).fill(tag);
    await expect(bodyRows(table)).toHaveCount(2);

    await page.getByRole('button', { name: '라벨' }).click();
    await page.getByRole('listbox', { name: '라벨' }).getByText(tag, { exact: true }).click();
    await page.getByRole('textbox', { name: '검색' }).fill('BETA');
    await expect(bodyRows(table)).toHaveCount(1);
    await expect(table).toContainText(`필터나${tag}`);

    await page.getByRole('textbox', { name: '검색' }).fill('');
    await page.getByLabel('수신거부', { exact: true }).selectOption('only');
    await expect(bodyRows(table)).toHaveCount(1);
    await expect(table).toContainText(`필터가${tag}`);
    await page.getByLabel('수신거부', { exact: true }).selectOption('exclude');
    await expect(bodyRows(table)).toHaveCount(1);
    await expect(table).toContainText(`필터나${tag}`);

    const bySource = await apiJson<{ total: number }>(ctx, 'GET', `/api/contacts?sourceName=${encodeURIComponent(`${tag}.csv`)}`);
    expect(bySource.total).toBe(2);
    await ctx.dispose();
  });

  test('목록 커서 페이지네이션: 50건 + 더 보기', async ({ page }) => {
    const ctx = await apiContext(AUTH_A);
    const tag = uniqueTag('PGN');
    const rows = Array.from({ length: 55 }, (_, i) => ({ name: `페이지${tag}-${String(i).padStart(2, '0')}`, p1: uniquePhone() }));
    expect((await importContacts(ctx, csv(`${tag}.csv`, contactRows(rows)), { labels: [tag] })).importedRows).toBe(55);
    await page.goto('/contacts');
    await page.getByRole('textbox', { name: '검색' }).fill(tag);
    const table = page.getByRole('table', { name: '연락처 목록' });
    await expect(page.getByText('총 55명')).toBeVisible();
    await expect(bodyRows(table)).toHaveCount(50);
    await page.getByRole('button', { name: '더 보기' }).click();
    await expect(bodyRows(table)).toHaveCount(55);
    await expect(page.getByRole('button', { name: '더 보기' })).toHaveCount(0);
    await ctx.dispose();
  });

  test('상세 패널: 번호 단위 수신거부 토글', async ({ page }) => {
    const ctx = await apiContext(AUTH_A);
    const tag = uniqueTag('TGL');
    const p1 = uniquePhone();
    const p2 = uniquePhone();
    await importContacts(ctx, csv(`${tag}.csv`, contactRows([{ name: `토글${tag}`, p1, p2 }])), { labels: [tag] });
    await page.goto('/contacts');
    await page.getByRole('textbox', { name: '검색' }).fill(tag);
    await page.getByRole('button', { name: `토글${tag}` }).click();
    const panel = page.getByRole('complementary', { name: '연락처 상세' });
    await panel.getByRole('button', { name: `${p1} 수신거부 등록` }).click();
    await expect(panel.getByRole('button', { name: `${p1} 수신거부 해제` })).toBeVisible();
    await expect(panel.getByRole('button', { name: `${p2} 수신거부 등록` })).toBeVisible();
    await expect(panel).toContainText('관리자 수동');
    const row = bodyRows(page.getByRole('table', { name: '연락처 목록' })).filter({ hasText: `토글${tag}` });
    await expect(row).toContainText('일부거부');
    await panel.getByRole('button', { name: `${p1} 수신거부 해제` }).click();
    await expect(panel.getByRole('button', { name: `${p1} 수신거부 등록` })).toBeVisible();
    await ctx.dispose();
  });

  test.describe('테넌트 격리', () => {
    test.use({ storageState: AUTH_B });

    test('B 사용자 목록에 A 의 연락처가 보이지 않고, 직접 접근은 404', async ({ page }) => {
      const a = await apiContext(AUTH_A);
      const tag = uniqueTag('ISO');
      await importContacts(a, csv(`${tag}.csv`, contactRows([{ name: `격리${tag}`, p1: uniquePhone() }])), { labels: [tag] });
      const [c] = await contactIdsByLabel(a, tag);

      await page.goto('/contacts');
      await page.getByRole('textbox', { name: '검색' }).fill(tag);
      await expect(page.getByText('연락처가 없습니다.')).toBeVisible();

      const b = await apiContext(AUTH_B);
      expect((await b.get(`/api/contacts/${c.id}`)).status()).toBe(404);
      expect((await b.patch(`/api/contacts/${c.id}`, { data: { name: 'x' } })).status()).toBe(404);
      expect((await b.delete(`/api/contacts/${c.id}`)).status()).toBe(404);
      const facets = await apiJson<{ sourceNames: string[] }>(b, 'GET', '/api/contacts/facets');
      expect(facets.sourceNames).not.toContain(`${tag}.csv`);
      await a.dispose();
      await b.dispose();
    });
  });
});
