import { defineConfig, devices } from '@playwright/test';

const PORT = 3100; // 앱 서버(3110)와 충돌 방지
const BASE_URL = `http://localhost:${PORT}`;
export const E2E_DB = 'UnifiedMessagingService_e2e';

// 테스트 프로세스(헬퍼/global-setup)와 서버가 같은 DB 를 보도록 고정
process.env.E2E_MONGODB_URI ??= process.env.MONGODB_URI ?? 'mongodb://host.docker.internal:27017';
process.env.E2E_MONGODB_DBNAME = E2E_DB;
process.env.E2E_BASE_URL = BASE_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // 단일 테스트 DB 공유 → 직렬 실행
  workers: 1,
  retries: process.env.CI ? 2 : 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: BASE_URL,
    headless: true, // 항상 headless. headed/--ui/--debug 사용 금지
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD ? `npx next start -p ${PORT}` : `npm run build && npx next start -p ${PORT}`,
    url: `${BASE_URL}/login`,
    // 남아 있는 서버(이전 빌드·다른 DB)를 재사용하면 오래된 코드로 테스트하게 되므로 항상 새로 띄운다
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      MONGODB_URI: process.env.E2E_MONGODB_URI,
      MONGODB_DBNAME: E2E_DB, // 전용 DB — dev DB 절대 사용 금지
      NEXTAUTH_URL: BASE_URL,
      NEXT_PUBLIC_BASE_URL: BASE_URL,
      DRY_RUN: 'true', // 실제 공급사 호출 차단
      DISPATCH_POLL_INTERVAL_MS: '2000',
    },
  },
});
