import { expect, test as setup } from '@playwright/test';
import { AUTH_A, AUTH_B, USER_A, USER_B } from './fixtures/users';

for (const [user, file] of [[USER_A, AUTH_A], [USER_B, AUTH_B]] as const) {
  setup(`로그인 상태 저장: ${user.email}`, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('이메일').fill(user.email);
    await page.getByLabel('비밀번호').fill(user.password);
    await page.getByRole('button', { name: '로그인' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId('header-user-name')).toHaveText(user.name);
    await page.context().storageState({ path: file });
  });
}
