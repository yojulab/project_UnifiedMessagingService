# 통합 메시징 서비스 (Unified Messaging Service)

이메일(Zoho · AWS SES)과 SMS/LMS · 카카오 알림톡(알리고 · 솔라피)을 하나의 대시보드에서 발송하고, 080 / 이메일 수신거부를 번호·이메일 단위로 관리하는 멀티 테넌트 웹 애플리케이션입니다. 요구사항은 [`docs/PRD_UNIFIED_MESSAGING_SERVICE.md`](docs/PRD_UNIFIED_MESSAGING_SERVICE.md) 를 따릅니다.

**스택**: Next.js 16 (App Router) · TypeScript strict · MongoDB/Mongoose 9 · NextAuth v4 · TailwindCSS v3 · Vitest · Playwright

## 시작하기

```bash
npm install
cp .env.example .env.local      # 값 채우기: openssl rand -hex 32 로 NEXTAUTH_SECRET / ENCRYPTION_KEY / UNSUBSCRIBE_SECRET / WEBHOOK_SECRET
npm run seed                    # CommonCode(채널·공급사·상태·수신거부 사유) 적재
npm run build && npm start      # http://localhost:3000
```

- `DRY_RUN=true`(기본값)이면 공급사 API 를 호출하지 않고 결과를 시뮬레이션합니다. 실제 발송은 `.env.local` 에서 `DRY_RUN=false` 로 바꾼 뒤 재시작하세요.
- 예약 발송은 서버 프로세스 안의 폴러(`src/instrumentation.ts`, 기본 30초)가 처리합니다. 서버리스 환경이 아니라 `next start` 처럼 상주하는 Node 프로세스에서 실행해야 합니다.

## 주요 기능

| 메뉴 | 기능 |
|---|---|
| 플랫폼 연동 | 공급사별 변수 가이드, JSON/KEY=VALUE 일괄 붙여넣기, 연결 테스트, 비밀값 AES-256-GCM 암호화·마스킹 |
| 연락처 | xlsx/xls/csv(UTF-8·CP949)/tsv/txt 업로드, 3행 미리보기, 전화·이메일 복수 컬럼 매핑, 중복 처리(건너뛰기/덮어쓰기/신규), Master-Detail, 번호 단위 수신거부 토글, 발송 이력 타임라인 |
| 캠페인 발송 | 4단계 마법사, 전체/상위 N/무작위 N, 출처·라벨·키워드 필터, 대상 수 vs 발송 건수·비용 견적, `{name}` 치환, `(광고)`·080 문구 자동 삽입, SMS→LMS 자동 전환, 알림톡 실패 시 LMS 대체, 즉시/예약 발송 |
| 발송 통계 | KPI, 일별 추이 차트, 캠페인별 결과·로그 필터·CSV 내보내기, 수신거부 목록·080 CSV 가져오기·서명 웹훅 |
| 환경 설정 | 기본 발신자 프로필, 비밀번호 변경, 라이트/다크/시스템 + 강조색 6종 (DB 저장, 새로고침 없이 반영) |

이메일 수신거부 링크는 `/unsubscribe?token=…` 확인 페이지로 연결되며(GET 으로는 상태를 바꾸지 않음), RFC 8058 `List-Unsubscribe` / `List-Unsubscribe-Post` 헤더를 붙입니다(AWS SES). Zoho Mail API 는 사용자 정의 헤더를 지원하지 않아 본문 링크만 삽입됩니다.

## 테스트

```bash
npx tsc --noEmit && npm run lint
npm test                        # 단위 테스트
npm run test:e2e                # E2E (headless) — 빌드 후 포트 3100, 전용 DB UnifiedMessagingService_e2e 를 매번 초기화
```

## 에이전트 하네스

`.agents/` 가 Gemini · Claude Code 공용 하네스 원본입니다 (`AGENTS.md`, `rules/`, `skills/`). Claude Code 는 루트 `CLAUDE.md` 와 `.claude/skills` 심볼릭 링크로 같은 파일을 사용합니다. 작업 주기와 검증 게이트는 `.agents/rules/work-cycle.md`, 구현 중 확정한 결정은 `.agents/rules/harness-decisions.md` 를 참고하세요.
