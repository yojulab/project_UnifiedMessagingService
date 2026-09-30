# 🚀 통합 메시징 서비스 (Unified Messaging Service) — Workspace Harness

> **PRD 원본**: [docs/PRD_UNIFIED_MESSAGING_SERVICE.md](file:///apps/project_UnifiedMessagingService/docs/PRD_UNIFIED_MESSAGING_SERVICE.md)

---

## 프로젝트 정체성

이 워크스페이스는 **멀티 플랫폼 통합 메시징 솔루션**을 구현한다.
고객 연락처(CSV/엑셀/TXT)를 기반으로 **이메일(Zoho, AWS SES 등)**과 **SMS/LMS/카카오톡(알리고, 솔라피 등)**을 단일 대시보드에서 발송·관리한다.
공급사에 종속되지 않는 **Provider Adapter Pattern**을 핵심 아키텍처로 채택하며, 테넌트(회원)별 완전 격리를 보장한다.

---

## 기술 스택 (확정)

| 계층 | 기술 | 비고 |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | Fullstack — API Routes + RSC/Client Components |
| Language | **TypeScript** | 전체 코드베이스, `strict: true` |
| DB | **MongoDB** + **Mongoose ODM** | 다중 전화/이메일 배열, 비정형 메타데이터 |
| UI | **React 18+** + **TailwindCSS v3** | `next-themes` 기반 다크/라이트/시스템/커스텀 팔레트 |
| Auth | **NextAuth.js** 또는 **JWT 직접 구현** | bcrypt 해시, 세션 쿠키 |
| 암호화 | **AES-256-GCM** (API Key), **bcrypt** (비밀번호) | |
| 파일 파싱 | **xlsx** / **papaparse** / **csv-parse** | `.xlsx`, `.xls`, `.csv`, `.tsv`, `.txt` |

---

## 환경 변수 (`.env.local`)

```env
# ── Database ──────────────────────────
MONGODB_URI=mongodb://host.docker.internal:27017
MONGODB_DBNAME=UnifiedMessagingService_dev

# ── Auth ──────────────────────────────
NEXTAUTH_SECRET=<generate-random-32byte>
NEXTAUTH_URL=http://localhost:3000

# ── Encryption ────────────────────────
ENCRYPTION_KEY=<32-byte-hex-key-for-AES-256-GCM>
ENCRYPTION_IV_LENGTH=16

# ── App ───────────────────────────────
NEXT_PUBLIC_APP_NAME=통합 메시징 서비스
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

> **주의**: 위 값은 개발용 기본값이다. 프로덕션에서는 반드시 교체할 것.

---

## 프로젝트 디렉토리 구조 (Target Layout)

```
project_UnifiedMessagingService/
├── docs/                           # PRD, 설계 문서
│   └── PRD_UNIFIED_MESSAGING_SERVICE.md
├── .agents/                        # 워크스페이스 하네스 (이 파일)
│   ├── AGENTS.md
│   ├── rules/
│   └── skills/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/                 # 인증 관련 라우트 그룹
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/            # 인증 후 메인 레이아웃
│   │   │   ├── platform-config/    # 플랫폼 연동 설정
│   │   │   ├── contacts/           # 연락처 관리 허브
│   │   │   ├── campaigns/          # 캠페인 발송 마법사
│   │   │   ├── analytics/          # 발송 결과 & 통계
│   │   │   └── settings/           # 환경 설정 & 테마
│   │   ├── api/                    # API Route Handlers
│   │   │   ├── auth/
│   │   │   ├── platform-configs/
│   │   │   ├── contacts/
│   │   │   ├── campaigns/
│   │   │   ├── dispatch/
│   │   │   ├── analytics/
│   │   │   └── unsubscribe/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/                 # 공용 UI 컴포넌트
│   │   ├── ui/                     # 기본 원자 컴포넌트 (Button, Input, Modal 등)
│   │   ├── layout/                 # Sidebar, Header, Footer
│   │   ├── contacts/               # 연락처 전용 컴포넌트
│   │   ├── campaigns/              # 캠페인 전용 컴포넌트
│   │   └── platform/               # 플랫폼 설정 전용 컴포넌트
│   ├── lib/                        # 코어 비즈니스 로직
│   │   ├── db/                     # Mongoose 연결 & 모델 정의
│   │   │   ├── connection.ts
│   │   │   └── models/
│   │   │       ├── User.ts
│   │   │       ├── CommonCode.ts
│   │   │       ├── PlatformConfig.ts
│   │   │       ├── Contact.ts
│   │   │       ├── UploadHistory.ts
│   │   │       ├── DispatchJob.ts
│   │   │       └── DispatchLog.ts
│   │   ├── adapters/               # Provider Adapter Pattern
│   │   │   ├── IMessagingAdapter.ts    # 공통 인터페이스
│   │   │   ├── email/
│   │   │   │   ├── ZohoAdapter.ts
│   │   │   │   └── SesAdapter.ts
│   │   │   ├── sms/
│   │   │   │   ├── AligoAdapter.ts
│   │   │   │   └── SolapiAdapter.ts
│   │   │   └── AdapterFactory.ts       # 팩토리 패턴으로 어댑터 인스턴스 생성
│   │   ├── encryption.ts           # AES-256-GCM 유틸
│   │   ├── auth.ts                 # 인증 헬퍼
│   │   ├── parsers/                # 파일 파서 (Excel, CSV, TSV, TXT)
│   │   │   └── fileParser.ts
│   │   └── validators/             # Zod 스키마 및 유효성 검사
│   ├── hooks/                      # 커스텀 React Hooks
│   ├── types/                      # 글로벌 TypeScript 타입 정의
│   │   └── index.ts
│   └── styles/                     # 글로벌 CSS, Tailwind 설정
│       └── globals.css
├── public/                         # 정적 에셋
├── seeds/                          # CommonCode 시드 데이터
│   └── commonCodes.ts
├── tailwind.config.ts
├── next.config.mjs
├── tsconfig.json
├── package.json
└── .env.local
```

---

## 핵심 아키텍처 원칙

### 1. Provider Adapter Pattern (공급사 어댑터)
```typescript
// src/lib/adapters/IMessagingAdapter.ts
interface IMessagingAdapter {
  send(payload: SendPayload): Promise<SendResult>;
  testConnection(config: PlatformConfigData): Promise<TestResult>;
  formatUnsubscribeFooter?(contactId: string): string;
}
```
- 모든 공급사(Zoho, AWS SES, 알리고, 솔라피 등)는 이 인터페이스를 구현한다.
- `AdapterFactory.create(channel, provider)` 로 런타임에 적절한 어댑터를 반환한다.
- 새 공급사 추가 시 어댑터 클래스 1개 + CommonCode 시드 1건만 추가하면 된다.

### 2. 테넌트 격리
- **모든 DB 쿼리**에 `userId` 필터를 반드시 포함한다.
- Mongoose 미들웨어 또는 서비스 레이어에서 `userId` 자동 주입을 보장한다.

### 3. 다중 연락처 도달
- `Contacts.phones[]` / `Contacts.emails[]` 배열 각 요소에 대해 개별 발송 로그(`DispatchLog`)를 생성한다.
- 수신거부 검증은 **개별 번호/이메일 단위**로 수행한다.

### 4. 수신거부 체계
- **SMS**: 본문 하단 `(무료수신거부: 080-XXX-XXXX)` 자동 삽입, 080 데이터 동기화.
- **Email**: HMAC 토큰 기반 원클릭 수신거부 링크 삽입, RFC 8058 `List-Unsubscribe` 헤더 탑재.

---

## MongoDB 컬렉션 참조

| 컬렉션 | Mongoose 모델 | 용도 |
|---|---|---|
| `users` | `User` | 회원 정보, 인증, 테마 설정 |
| `commoncodes` | `CommonCode` | 시스템 공통 코드 (채널/공급사/상태값) |
| `platformconfigs` | `PlatformConfig` | 회원별 공급사 API Key (AES-256 암호화 저장) |
| `contacts` | `Contact` | 연락처 (다중 phones/emails 배열 구조) |
| `uploadhistories` | `UploadHistory` | 파일 업로드 이력 및 배치 추적 |
| `dispatchjobs` | `DispatchJob` | 발송 캠페인 작업 |
| `dispatchlogs` | `DispatchLog` | 개별 발송 결과 로그 |

> 상세 스키마는 [PRD §3 참조](file:///apps/project_UnifiedMessagingService/docs/PRD_UNIFIED_MESSAGING_SERVICE.md)

---

## 개발 Phase 로드맵

1. **Phase 1** — 프로젝트 초기화 + 인증 + CommonCode 시드
2. **Phase 2** — 플랫폼 연동 설정 관리 + 어댑터 추상화
3. **Phase 3** — 연락처 업로드/파싱/매핑 + Master-Detail 뷰어
4. **Phase 4** — 캠페인 발송 마법사 + 타겟팅 + 수신거부 자동화
5. **Phase 5** — 발송 결과 분석 대시보드 + 테마 설정 + 최종 검증

> 각 Phase는 `rules/work-cycle.md`의 **Phase 게이트**(tsc·lint·단위 테스트·**Playwright headless E2E 전체 스위트**·완료 조건·규칙 검토)를 통과하고 사용자 승인을 받아야 완료된다.

---

## 작업 수행 및 커밋 원칙 (일정 업무별 커밋 필수)

모든 작업(기능 구현, 버그/이슈 수정, 리팩토링, 하네스/설정 변경 등)은 **일정 업무 단위 완료 시 반드시 git commit으로 기록**해야 한다.

1. **일정 업무별 1커밋 필수**:
   - 단위 작업(Task Unit)이나 사용자가 요청한 개별 이슈/버그 해결이 끝나고 검증(정적 검증 `tsc`/`lint`, 테스트)을 통과하면 **즉시 커밋**을 수행한다.
   - 미커밋 상태로 작업을 종료하거나 사용자에게 완료 보고만 남기고 커밋을 누락하는 것을 엄격히 금지한다.
   - 여러 업무를 몰아서 한 번에 커밋하지 않고, 각 일정 업무 묶음마다 1커밋을 기록한다.
2. **보고 전 커밋 기록**:
   - 사용자에게 완료 보고 시 반드시 커밋 해시(`<short-hash>`)를 포함한다.
3. **커밋 규칙 준수**:
   - `rules/work-cycle.md` §5 (커밋 규칙) 및 `rules/coding-conventions.md` (커밋 메시지 형식)를 철저히 준수한다.
   - **한 커밋 = 한 목적**: 서로 다른 업무 묶음(예: 기능 코드 수정과 하네스 변경)을 한 커밋에 섞지 않고 별도 커밋으로 분리한다.
   - **경로 지정 스테이징**: `git add <file>...` 로 이번 업무 파일만 명시적으로 스테이징한다 (`git add -A` / `git add .` 절대 금지).
   - **비밀·산출물 제외**: `.env.local`, `.next/`, `test-results/`, `playwright-report/` 등 금지 파일 스테이징 차단 (`git diff --cached --name-only` 로 확인).
   - **메시지 형식**: `<type>(<scope>): <subject>` (한국어 요약, 명령형, 50자 내외).
   - `push`, 병합, PR 생성은 사용자의 명시적 요청 시에만 수행한다.

---

## 하네스 인덱스 (Gemini · Claude Code 공용)

> `.agents/`가 단일 원본이다. Claude Code는 루트 `CLAUDE.md`의 import와 `.claude/skills/*` symlink로 동일 파일을 사용한다.

| 구분 | 파일 | 용도 |
|---|---|---|
| Rule | `rules/coding-conventions.md` | 언어·네이밍·보안·커밋 규칙 |
| Rule | `rules/database-api.md` | Mongo 연결·스키마·API·암호화 규칙 |
| Rule | `rules/ui-design.md` | 테마·Tailwind·레이아웃 규칙 |
| Rule | `rules/harness-decisions.md` | **문서 간 충돌에 대한 확정 결정 (스킬 본문보다 우선)** |
| Rule | `rules/work-cycle.md` | **업무 주기(작업 단위 8단계·Phase 게이트·주기적 점검)·보고 형식·커밋 규칙(업무 묶음마다 1커밋)** |
| Skill | `skills/project-bootstrap` | Phase 1 |
| Skill | `skills/db-schema` | 7개 모델 스키마 |
| Skill | `skills/adapter-pattern` | Phase 2 어댑터 |
| Skill | `skills/platform-config` | Phase 2 플랫폼 설정 UI/API |
| Skill | `skills/contacts-import` | Phase 3 업로드·매핑·Master-Detail |
| Skill | `skills/campaign-dispatch` | Phase 4 발송 마법사·엔진 |
| Skill | `skills/unsubscribe-compliance` | Phase 4~5 수신거부 체계 |
| Skill | `skills/analytics-theme` | Phase 5 통계·설정·테마 |
| Skill | `skills/e2e-playwright` | 전 Phase — Playwright headless E2E 검증 |
