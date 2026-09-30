# CLAUDE.md — 통합 메시징 서비스 (Claude Code 하네스)

이 프로젝트의 하네스 **단일 원본(SSOT)은 `.agents/`** 이다 (Gemini/Antigravity와 공유).
Claude Code는 아래 import와 `.claude/skills/*` → `.agents/skills/*` symlink로 같은 파일을 읽는다.
규칙·스킬 내용을 수정할 때는 **`.agents/` 쪽 원본을 수정**하고, Claude 전용 운영 지침만 이 파일에 둔다.

## 공유 하네스 (자동 로드)

@.agents/AGENTS.md
@.agents/rules/coding-conventions.md
@.agents/rules/database-api.md
@.agents/rules/ui-design.md
@.agents/rules/harness-decisions.md
@.agents/rules/work-cycle.md

PRD 원본: `docs/PRD_UNIFIED_MESSAGING_SERVICE.md` — 기능 명세가 모호하면 먼저 해당 절을 읽는다.

---

## 스킬 맵 (Phase ↔ 스킬)

작업 착수 전 해당 Phase의 스킬을 **반드시 먼저 로드**한다. 스킬은 `.claude/skills/`에서 자동 발견된다.

| Phase | 작업 | 스킬 |
|---|---|---|
| 1 | 스캐폴딩 · 인증 · CommonCode 시드 · 레이아웃 | `project-bootstrap`, `db-schema` |
| 2 | 어댑터 추상화 · 공급사 구현 | `adapter-pattern` |
| 2 | 플랫폼 설정 UI/API · Textarea 파싱 · 암호화 | `platform-config` |
| 3 | 파일 업로드 · 컬럼 매핑 · Master-Detail | `contacts-import`, `db-schema` |
| 4 | 캠페인 마법사 · 타겟팅 · 발송 엔진 | `campaign-dispatch`, `adapter-pattern` |
| 4~5 | 080 / 이메일 수신거부 · RFC 8058 | `unsubscribe-compliance` |
| 5 | 발송 통계 · 설정 · 테마 | `analytics-theme` |
| 전 Phase | Playwright headless E2E 검증 (업무 주기 ⑤, Phase 게이트) | `e2e-playwright` |

---

## 작업 방식 (Claude 전용)

- **업무 주기 준수**: 모든 작업은 `work-cycle.md`의 작업 단위 주기(①착수 → ②구현 → ③정적 검증 → ④단위 테스트 → ⑤E2E headless → ⑥자가 점검 → ⑦보고 → ⑧커밋)를 따르고, 같은 형식으로 보고한다. 화면이 있는 작업은 Playwright E2E 통과 전에는 완료로 보고하지 않는다.
- **업무 묶음마다 커밋**: 사용자는 이 규칙으로 커밋을 상시 요청했다 — 작업 단위·리뷰 반영·하네스 변경·설정 변경이 끝날 때마다 `work-cycle.md` §5 대로 **묶음별 1커밋**(경로 지정 스테이징, 현재 브랜치에 커밋하되 `main`/`master` 위라면 `work/<phase|topic>` 생성, 비밀·산출물 제외)을 남긴다. `push`·병합·이력 재작성은 여전히 사용자가 요청할 때만.
- **Phase 게이트**: Phase 종료 시 E2E 전체 스위트(build + start 기준) + 완료 조건 체크리스트 + `harness-reviewer`를 모두 통과한 뒤 결과를 보고하고, **사용자 승인 후** 다음 Phase로 넘어간다.
- **E2E는 항상 headless**: `--headed`, `--ui`, `--debug`, `show-report`/`show-trace` GUI 실행 금지. 실패 분석은 `test-results/`의 스크린샷을 Read로 직접 열어 확인한다.
- **테넌트 격리 최우선**: 모든 Mongoose 쿼리/aggregate에 `userId`가 들어갔는지 작성 직후 스스로 확인한다. 예외 경로는 `/api/auth/*`, `/unsubscribe`, `/api/unsubscribe`, `/api/webhooks/*`뿐이다.
- **비밀값 취급**: 복호화된 키를 로그·응답·에러 메시지에 포함하지 않는다. `.env.local`은 커밋하지 않는다(`.gitignore` 확인).
- **실제 발송 금지**: 개발/테스트 중 실제 공급사 API로 메시지를 보내지 않는다. 어댑터 테스트는 fetch mock 또는 `DRY_RUN=true` 환경 변수로 네트워크 호출을 차단한다. 실제 테스트 발송은 사용자 확인 후에만.

## 검증 명령

```bash
npx tsc --noEmit             # 타입 검사 (strict)
npm run lint                 # ESLint CLI (Next 16 은 next lint 없음)
npm test                     # 단위 테스트 (vitest — 파서/정규화/토큰/암호화/템플릿)
npm run test:e2e             # Playwright E2E 전체 (headless, build+start, 포트 3100, DB UnifiedMessagingService_e2e, DRY_RUN)
E2E_SKIP_BUILD=1 npm run test:e2e -- e2e/phase3-contacts.spec.ts   # 앱 코드 변경 없을 때 영향 spec 만 (빌드 생략)
npm run seed                 # CommonCode 시드 (dev DB)
npm run build && npm start   # 로컬 실행 확인 — `next dev` 는 사용하지 않는다 (harness-decisions #14)
mongosh "mongodb://host.docker.internal:27017/UnifiedMessagingService_dev"   # DB 확인
```

코드 변경 후에는 `tsc --noEmit` → `lint` → 단위 테스트 → 영향 spec E2E 순으로 통과시킨 뒤 완료를 보고한다. E2E 는 dev DB(`UnifiedMessagingService_dev`)를 절대 사용하지 않는다.
포트 3100 에 서버를 수동으로 띄웠다면 E2E 실행 전에 반드시 종료한다 (`next-server` 프로세스 이름으로 남는다).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
