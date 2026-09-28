---
name: project-bootstrap
description: Next.js + MongoDB + TailwindCSS 프로젝트 초기 세팅 및 Phase 1 구현 가이드. 프로젝트 스캐폴딩, 인증 시스템, CommonCode 시드 데이터, 기본 레이아웃을 구축할 때 이 스킬을 참조한다.
---

# 프로젝트 부트스트랩 스킬 (Phase 1)

## 목적
Next.js 프로젝트를 PRD 명세에 맞춰 초기화하고, 인증/인프라/시드 데이터를 구축한다.

---

## Step 1: Next.js 프로젝트 생성

```bash
cd /apps/project_UnifiedMessagingService
# Tailwind v4 가 설치되지 않도록 --no-tailwind 로 생성 후 v3 를 수동 설치 (harness-decisions #1)
npx -y create-next-app@latest <임시경로> --typescript --eslint --app --src-dir --import-alias "@/*" --use-npm --no-tailwind --no-react-compiler --yes
npm install -D tailwindcss@3 postcss autoprefixer
```

> 기존 `docs/`, `.agents/`, `CLAUDE.md` 와 충돌하지 않도록 임시 경로에 생성한 뒤 복사한다 (생성기가 만드는 `AGENTS.md`/`CLAUDE.md`/`README.md` 는 복사하지 않음).

## Step 2: 필수 패키지 설치

```bash
npm install mongoose next-auth@4 bcryptjs zod papaparse next-themes @aws-sdk/client-sesv2
npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz   # npm 의 xlsx 0.18 은 보안 패치 중단 — SheetJS 공식 배포본 사용
npm install -D @types/node@24 @types/papaparse tsx vitest @playwright/test
npx playwright install --with-deps chromium
```

> Playwright 설정·테스트 DB·DRY_RUN은 `e2e-playwright` 스킬 §1~4를 따른다 (Phase 1에서 함께 구축).

## Step 3: 환경 변수 세팅

`.env.local` 파일을 워크스페이스 루트에 생성:

```env
MONGODB_URI=mongodb://host.docker.internal:27017
MONGODB_DBNAME=UnifiedMessagingService_dev
NEXTAUTH_SECRET=dev-secret-change-in-production-32chars
NEXTAUTH_URL=http://localhost:3000
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
NEXT_PUBLIC_APP_NAME=통합 메시징 서비스
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Step 4: MongoDB 연결 싱글턴 구현

`src/lib/db/connection.ts`에 캐시된 연결 패턴을 구현한다. (database-api.md 규칙 참조)

## Step 5: Mongoose 모델 정의

`src/lib/db/models/` 하위에 PRD §3에 정의된 7개 컬렉션 모델을 생성한다:
1. `User.ts` — 회원 정보
2. `CommonCode.ts` — 공통 코드 (카테고리: MSG_CHANNEL, PROVIDER, DISPATCH_STATUS, UNSUB_REASON)
3. `PlatformConfig.ts` — 플랫폼 연동 키 (configData 암호화)
4. `Contact.ts` — 연락처 (phones[], emails[] 배열)
5. `UploadHistory.ts` — 파일 업로드 이력
6. `DispatchJob.ts` — 발송 작업
7. `DispatchLog.ts` — 발송 결과 로그

## Step 6: CommonCode 시드 스크립트

`seeds/commonCodes.ts`에 시드 데이터를 정의한다:

```typescript
export const commonCodeSeeds = [
  // ── 발송 채널 ──
  { category: 'MSG_CHANNEL', code: 'EMAIL', name: '이메일', sortOrder: 1 },
  { category: 'MSG_CHANNEL', code: 'SMS', name: 'SMS', sortOrder: 2 },
  { category: 'MSG_CHANNEL', code: 'LMS', name: 'LMS', sortOrder: 3 },
  { category: 'MSG_CHANNEL', code: 'KAKAO', name: '카카오 알림톡', sortOrder: 4 },

  // ── 공급사 ──
  { category: 'PROVIDER', code: 'ZOHO', name: 'Zoho Mail REST API', sortOrder: 1,
    configTemplate: JSON.stringify({
      clientId: { label: 'Client ID', required: true },
      clientSecret: { label: 'Client Secret', required: true },
      refreshToken: { label: 'Refresh Token', required: true },
      accountId: { label: 'Account ID', required: true },
      senderAddress: { label: '발신 이메일', required: true },
    })
  },
  { category: 'PROVIDER', code: 'AWS_SES', name: 'AWS SES', sortOrder: 2,
    configTemplate: JSON.stringify({
      accessKeyId: { label: 'Access Key ID', required: true },
      secretAccessKey: { label: 'Secret Access Key', required: true },
      region: { label: 'Region', required: true, default: 'ap-northeast-2' },
      senderAddress: { label: '발신 이메일', required: true },
    })
  },
  { category: 'PROVIDER', code: 'ALIGO', name: '알리고 SMS', sortOrder: 3,
    configTemplate: JSON.stringify({
      apiKey: { label: 'API Key', required: true },
      userId: { label: 'User ID', required: true },
      senderNumber: { label: '발신 번호', required: true },
    })
  },
  { category: 'PROVIDER', code: 'SOLAPI', name: '솔라피', sortOrder: 4,
    configTemplate: JSON.stringify({
      apiKey: { label: 'API Key', required: true },
      apiSecret: { label: 'API Secret', required: true },
      senderNumber: { label: '발신 번호', required: true },
    })
  },

  // ── 발송 상태 ──
  { category: 'DISPATCH_STATUS', code: 'PENDING', name: '대기', sortOrder: 1 },
  { category: 'DISPATCH_STATUS', code: 'SENDING', name: '발송중', sortOrder: 2 },
  { category: 'DISPATCH_STATUS', code: 'SUCCESS', name: '성공', sortOrder: 3 },
  { category: 'DISPATCH_STATUS', code: 'FAILED', name: '실패', sortOrder: 4 },
  { category: 'DISPATCH_STATUS', code: 'PARTIAL', name: '부분성공', sortOrder: 5 },

  // ── 수신거부 사유 ──
  { category: 'UNSUB_REASON', code: 'OPT_OUT_080', name: '080 수신거부', sortOrder: 1 },
  { category: 'UNSUB_REASON', code: 'OPT_OUT_EMAIL', name: '이메일 수신거부', sortOrder: 2 },
  { category: 'UNSUB_REASON', code: 'MANUAL', name: '관리자 수동 해제', sortOrder: 3 },
];
```

## Step 7: 인증 시스템 구현

- `NextAuth.js` Credentials Provider 기반 로그인.
- 회원가입 API Route: `/api/auth/register`
- bcrypt salt rounds: 12

## Step 8: 기본 레이아웃 (Sidebar + Header)

- `src/app/(dashboard)/layout.tsx`: 인증된 사용자용 기본 레이아웃.
- Sidebar: 네비게이션 메뉴 6개 (대시보드, 플랫폼, 연락처, 캠페인, 통계, 설정).
- Header: 로고, 사용자 이름/이메일, 테마 토글.

## 완료 조건 체크리스트

- [ ] `npm run dev` 정상 기동 (포트 3000)
- [ ] MongoDB 연결 성공 (콘솔 로그 확인)
- [ ] 회원가입 → 로그인 → 대시보드 진입 플로우 동작
- [ ] CommonCode 시드 데이터 DB 적재 완료
- [ ] Sidebar + Header 레이아웃 렌더링 정상
- [ ] Dark/Light 모드 토글 동작
- [ ] Playwright headless E2E `e2e/phase1-auth.spec.ts` 통과 (`e2e-playwright` 스킬 §6 필수 시나리오)
