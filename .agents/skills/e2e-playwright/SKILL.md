---
name: e2e-playwright
description: Playwright headless E2E 검증 가이드. playwright.config.ts 설정(headless, webServer, 전용 테스트 DB), 인증 storageState, 테스트 데이터 시드/정리, DRY_RUN 발송 차단, Phase별 필수 시나리오, 실패 시 trace/screenshot 분석 절차를 참조할 때 이 스킬을 사용한다. 화면이 있는 기능을 구현·수정했거나 Phase 게이트를 통과시킬 때 반드시 사용한다.
---

# Playwright E2E 검증 스킬 (headless)

업무 주기(`rules/work-cycle.md`)의 ⑤단계와 Phase 게이트에서 사용한다.

---

## 1. 설치 (Phase 1 스캐폴딩 직후 1회)

```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium     # 컨테이너(리눅스)에서는 --with-deps 필수
```

`package.json` scripts:
```json
{
  "test:e2e": "playwright test",
  "test:e2e:report": "playwright show-report --host 0.0.0.0"
}
```
`.gitignore`에 `test-results/`, `playwright-report/`, `e2e/.auth/` 추가.

## 2. 설정 — `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;  // 앱 서버(3110)와 충돌 방지
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,          // 단일 테스트 DB 공유 → 직렬 실행
  workers: 1,
  retries: process.env.CI ? 2 : 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: BASE_URL,
    headless: true,              // 항상 headless. headed/--ui/--debug 사용 금지
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
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,   // 남은 서버 재사용 금지 — 오래된 빌드/다른 DB 로 테스트되는 사고 방지
    timeout: 180_000,
    env: {
      MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://host.docker.internal:27017',
      MONGODB_DBNAME: 'UnifiedMessagingService_e2e',   // 전용 DB — dev DB 절대 사용 금지
      NEXTAUTH_URL: BASE_URL,
      NEXT_PUBLIC_BASE_URL: BASE_URL,
      DRY_RUN: 'true',                                 // 실제 공급사 호출 차단
    },
  },
});
```
> 작업 단위 주기(⑤)에서 서버 코드 변경이 없으면 `E2E_SKIP_BUILD=1 npm run test:e2e -- <spec>` 으로 빌드를 생략할 수 있다 (기존 `.next` 로 start). 서버/클라이언트 코드를 바꿨다면 반드시 빌드 포함으로 실행한다. **Phase 게이트는 항상 build + start 기준**. `next dev` 는 에이전트 환경에서 루트 CLAUDE.md 를 자동 수정하므로 사용하지 않는다.
> 수동으로 `next start -p 3100` 을 띄웠다면 테스트 전에 반드시 종료한다 (포트 충돌 시 webServer 가 실패한다).

## 3. 테스트 데이터

- `e2e/global-setup.ts`: `UnifiedMessagingService_e2e` DB **drop** → CommonCode 시드 → 테스트 회원 2명 생성
  - `e2e-a@test.local` (주 사용자), `e2e-b@test.local` (테넌트 격리 검증용), 비밀번호는 `e2e/fixtures/users.ts` 상수.
  - DB 이름이 `_e2e`로 끝나지 않으면 **즉시 throw** (dev/prod DB 삭제 방지 가드).
- `e2e/auth.setup.ts`: UI로 로그인 → `e2e/.auth/user.json` 저장. B 사용자는 `user-b.json`.
- 업로드용 샘플 파일은 `e2e/fixtures/`에 둔다: `contacts.xlsx`, `contacts.xls`, `contacts_utf8.csv`, `contacts_cp949.csv`, `contacts.tsv`, `contacts.txt`, `optout_080.csv`.
- 각 spec은 필요한 데이터를 API(`request` fixture)로 직접 만들고, 다른 spec의 데이터에 의존하지 않는다.

## 4. 발송 차단 (DRY_RUN)

- 어댑터는 `process.env.DRY_RUN === 'true'`이면 네트워크 호출 없이 결정적 결과를 반환한다:
  - 수신자에 `fail` 포함 또는 끝자리 `9999` → `FAILED`, `bounce` 포함 또는 끝자리 `8888` → `BOUNCED`, KAKAO 채널에서만 끝자리 `7777` → `FAILED`(LMS 대체 검증용), 그 외 `SUCCESS` (`messageId: dry-<uuid>`).
  - 설정값 중 `invalid` 가 있으면 연결 테스트 실패.
  - 전송 직전 최종 payload(본문, 헤더)를 `DispatchLog.providerResponse.dryRunPayload`에 기록 → E2E에서 080 문구/`List-Unsubscribe` 헤더 검증에 사용.
- 추가 안전망: spec에서 `page.route('**/*', ...)`로 외부 도메인(zoho.com, amazonaws.com, aligo.in, solapi.com) 요청을 abort하고, 발생 시 테스트 실패 처리.

## 5. 작성 규칙

- 로케이터 우선순위: `getByRole` → `getByLabel` → `getByText` → `getByTestId`. CSS/XPath 셀렉터 금지.
  - 이 규칙은 `ui-design.md`의 접근성 규칙(aria-label, 시맨틱 태그)과 맞물린다 — 로케이터가 안 잡히면 UI의 접근성 누락부터 의심한다.
- `page.waitForTimeout()` 금지. `expect(...).toBeVisible()` 등 자동 대기 단언을 사용.
- 파일 구조: `e2e/phase{N}-{도메인}.spec.ts` (예: `phase3-contacts.spec.ts`).
- UI 동작 검증 + 필요 시 DB 상태 검증(`e2e/helpers/db.ts`의 mongoose 조회)을 함께 한다.

## 6. Phase별 필수 시나리오 (Phase 게이트 기준)

| Phase | spec | 필수 시나리오 |
|---|---|---|
| 1 | `phase1-auth.spec.ts` | 회원가입 → 로그인 → 대시보드 진입 / 잘못된 비밀번호 에러 / 비로그인 `/contacts` 접근 시 로그인 리다이렉트 / 사이드바 6개 메뉴 이동 / 다크·라이트 토글 |
| 2 | `phase2-platform.spec.ts` | 공급사 선택 시 변수 가이드 표시 / JSON·KEY=VALUE 붙여넣기 → 필드 자동 채움 / 누락 필드 경고 / 연결 테스트(DRY_RUN) / 저장 후 목록에 `****` 마스킹 표시 / **B 사용자로 A의 설정 id API 접근 → 404** |
| 3 | `phase3-contacts.spec.ts` | 6종 샘플 파일 업로드 → 상위 3행 미리보기 / 전화 2열·이메일 2열 매핑 → 상세 패널에 모두 표시 / 중복 처리 3옵션 / 검색·출처·라벨 필터 / 수신거부 수동 토글 / **B 사용자 목록에 A 연락처 미노출** |
| 4 | `phase4-campaign.spec.ts` | 플랫폼 미등록 시 안내 링크 / Step 2 대상 수 vs 발송 건수 구분 표시 / TOP_N·RANDOM_N 건수 / `{name}` 치환 미리보기 / 발송 → DispatchLog 생성 / 080 문구 자동 삽입 / 수신거부된 **특정 번호만** 제외 / `fail` 수신자 포함 시 PARTIAL |
| 5 | `phase5-analytics.spec.ts` | 캠페인 결과 수치 = 로그 집계 / 로그 CSV 다운로드 / 수신거부 링크 GET → 확인 페이지 → POST 후 반영 / 위조 토큰 400 / 테마 모드·팔레트 변경 후 새로고침·재로그인 시 유지 |

## 7. 실행 & 실패 분석

```bash
npm run test:e2e                                   # 전체 (Phase 게이트)
npm run test:e2e -- e2e/phase3-contacts.spec.ts    # 특정 spec (작업 단위 주기)
npm run test:e2e -- -g "중복 처리"                   # 특정 테스트
```

실패 시 순서:
1. `list` 리포터의 에러 메시지·실패 단언 확인
2. `test-results/<테스트명>/`의 `test-failed-*.png` 스크린샷을 **직접 열어 확인**
3. 재시도 trace가 있으면 `npx playwright show-trace test-results/<...>/trace.zip` 대신 trace 내 네트워크/콘솔 로그를 확인 (headless 환경 — GUI 뷰어 실행 금지)
4. 서버 로그(webServer stdout)에서 API 에러 확인
5. 원인 수정 후 해당 spec 재실행 → 통과하면 전체 스위트 재실행

- flaky(재시도 후 통과)도 보고서에 표기하고 원인을 제거한다. 재시도 통과를 "통과"로 간주해 넘어가지 않는다.
