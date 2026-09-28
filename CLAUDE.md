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

---

---

## 작업 방식 (Claude 전용)

- **Phase 순서 준수**: 앞 Phase의 스킬 「완료 조건」 체크리스트가 충족되기 전에는 다음 Phase로 넘어가지 않는다. Phase 종료 시 체크리스트 결과를 보고한다.
- **테넌트 격리 최우선**: 모든 Mongoose 쿼리/aggregate에 `userId`가 들어갔는지 작성 직후 스스로 확인한다. 예외 경로는 `/api/auth/*`, `/unsubscribe`, `/api/unsubscribe`, `/api/webhooks/*`뿐이다.
- **비밀값 취급**: 복호화된 키를 로그·응답·에러 메시지에 포함하지 않는다. `.env.local`은 커밋하지 않는다(`.gitignore` 확인).
- **실제 발송 금지**: 개발/테스트 중 실제 공급사 API로 메시지를 보내지 않는다. 어댑터 테스트는 fetch mock 또는 `DRY_RUN=true` 환경 변수로 네트워크 호출을 차단한다. 실제 테스트 발송은 사용자 확인 후에만.
- **Phase 완료 검토**: 각 Phase 마무리 시 `harness-reviewer` 서브에이전트(`.claude/agents/harness-reviewer.md`)로 규칙 준수 여부를 점검한다.

## 검증 명령

```bash
npm run lint                 # ESLint
npx tsc --noEmit             # 타입 검사 (strict)
npm test                     # 단위 테스트 (vitest — 파서/정규화/토큰/암호화 필수)
npm run seed                 # CommonCode 시드 (tsx seeds/run.ts)
npm run dev                  # http://localhost:3000
mongosh "mongodb://host.docker.internal:27017/UnifiedMessagingService_dev"   # DB 확인
```

코드 변경 후에는 최소 `tsc --noEmit`과 관련 단위 테스트를 통과시킨 뒤 완료를 보고한다.
