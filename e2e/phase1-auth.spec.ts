import { expect, test } from '@playwright/test';
import { USER_A } from './fixtures/users';

test.describe('Phase 1 — 인증 & 레이아웃', () => {
  test.describe('비로그인', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('회원가입 → 자동 로그인 → 대시보드 진입', async ({ page }) => {
      const email = `new-${Date.now()}@test.local`;
      await page.goto('/register');
      await page.getByLabel('이름').fill('신규회원');
      await page.getByLabel('회사명').fill('E2E');
      await page.getByLabel('이메일').fill(email);
      await page.getByRole('textbox', { name: '비밀번호', exact: true }).fill('Passw0rd!123');
      await page.getByLabel('비밀번호 확인').fill('Passw0rd!123');
      await page.getByRole('button', { name: '가입하기' }).click();
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByTestId('header-user-name')).toHaveText('신규회원');
    });

    test('중복 이메일 가입은 에러', async ({ page }) => {
      await page.goto('/register');
      await page.getByLabel('이름').fill('중복');
      await page.getByLabel('이메일').fill(USER_A.email);
      await page.getByRole('textbox', { name: '비밀번호', exact: true }).fill('Passw0rd!123');
      await page.getByLabel('비밀번호 확인').fill('Passw0rd!123');
      await page.getByRole('button', { name: '가입하기' }).click();
      await expect(page.getByRole('alert').filter({ hasText: '이미 가입된 이메일' })).toBeVisible();
    });

    test('잘못된 비밀번호는 에러 메시지', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('이메일').fill(USER_A.email);
      await page.getByLabel('비밀번호').fill('wrong-password');
      await page.getByRole('button', { name: '로그인' }).click();
      await expect(page.getByRole('alert').filter({ hasText: '이메일 또는 비밀번호가 올바르지 않습니다' })).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
    });

    test('비로그인 /contacts 접근 시 로그인으로 리다이렉트 (callbackUrl 유지)', async ({ page }) => {
      await page.goto('/contacts');
      await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fcontacts/);
      await page.getByLabel('이메일').fill(USER_A.email);
      await page.getByLabel('비밀번호').fill(USER_A.password);
      await page.getByRole('button', { name: '로그인' }).click();
      await expect(page).toHaveURL(/\/contacts$/);
    });

    test('비로그인 API 는 401 JSON', async ({ request }) => {
      const res = await request.get('/api/contacts');
      expect(res.status()).toBe(401);
      expect(await res.json()).toMatchObject({ success: false, error: { code: 'UNAUTHORIZED' } });
    });
  });

  test('사이드바 6개 메뉴 이동', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = page.getByRole('navigation', { name: '주 메뉴' });
    const menus: [string, RegExp, string][] = [
      ['플랫폼 연동', /\/platform-config$/, '플랫폼 연동 설정'],
      ['연락처', /\/contacts$/, '연락처 관리'],
      ['캠페인 발송', /\/campaigns$/, '캠페인 발송'],
      ['발송 통계', /\/analytics$/, '발송 결과 & 통계'],
      ['환경 설정', /\/settings$/, '환경 설정'],
      ['대시보드', /\/dashboard$/, '대시보드'],
    ];
    await expect(nav.getByRole('link')).toHaveCount(6);
    for (const [label, url, heading] of menus) {
      await nav.getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
    }
  });

  test('다크/라이트 토글', async ({ page }) => {
    await page.goto('/dashboard');
    const html = page.locator('html');
    const toDark = page.getByRole('button', { name: '다크 모드로 전환' });
    await expect(toDark).toBeVisible();
    await toDark.click();
    await expect(html).toHaveClass(/dark/);
    await page.getByRole('button', { name: '라이트 모드로 전환' }).click();
    await expect(html).not.toHaveClass(/dark/);
  });

  test('로그아웃', async ({ page, context }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: '로그아웃' }).click();
    await expect(page).toHaveURL(/\/login/);
    await context.clearCookies();
  });
});
