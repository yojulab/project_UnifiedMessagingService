# 코딩 컨벤션 & 스타일 가이드

## 언어 규칙

- **TypeScript strict 모드** 필수 (`"strict": true`).
- `any` 타입 사용 금지. 불가피한 경우 `unknown` + 타입 가드를 사용한다.
- 모든 함수 및 메서드에 **명시적 반환 타입**을 선언한다.
- 인터페이스 이름은 `I` 접두사를 쓰지 않는다 (예: `MessagingAdapter` ✓, `IMessagingAdapter` ✗).
  단, PRD에서 정의된 `IMessagingAdapter`는 예외로 유지.

## 파일 및 네이밍

| 대상 | 규칙 | 예시 |
|---|---|---|
| React 컴포넌트 | PascalCase | `ContactDetailPanel.tsx` |
| 유틸·헬퍼 | camelCase | `encryption.ts`, `fileParser.ts` |
| Mongoose 모델 | PascalCase (단수형) | `Contact.ts`, `DispatchJob.ts` |
| API Route | kebab-case (폴더) | `api/platform-configs/route.ts` |
| 타입/인터페이스 | PascalCase | `SendPayload`, `TestResult` |
| 환경 변수 | UPPER_SNAKE_CASE | `MONGODB_URI` |

## React / Next.js 규칙

- **Server Component**를 기본으로 사용하고, 클라이언트 상호작용이 필요한 경우에만 `"use client"` 선언.
- `page.tsx`는 가능한 얇게(thin) 유지. 비즈니스 로직은 `lib/` 또는 커스텀 훅으로 분리.
- API Route Handler에서 반드시 `userId`를 세션에서 추출하여 **테넌트 필터링**을 적용한다.
- 에러 핸들링은 `try-catch` + Next.js `error.tsx` boundary를 조합한다.
- **의뢰자 소통용 UI 식별자 (`data-ui-id`) 필수 부여**: 모든 중요 인터랙티브 요소(버튼, 입력 필드 등) 및 핵심 컨테이너에 `data-ui-id="<DOMAIN>-<TYPE>-<NUM>"` 속성을 선언한다 (`ui-design.md` 참조).

## MongoDB / Mongoose 규칙

- 모델 파일은 `src/lib/db/models/` 하위에 위치한다.
- **인덱스 정의**를 스키마 레벨에서 명시한다 (특히 `userId`, 복합 인덱스).
- `timestamps: true` 옵션을 모든 스키마에 적용한다.
- 연결 관리는 `src/lib/db/connection.ts`의 싱글턴 패턴을 사용한다 (Next.js HMR 대응).

## API 응답 형식

```typescript
// 성공
{ success: true, data: T }

// 실패
{ success: false, error: { code: string, message: string } }
```

## 보안 규칙

- 사용자 비밀번호: `bcrypt` (salt rounds ≥ 12) 단방향 해시.
- 공급사 API Key/Secret: `AES-256-GCM` 양방향 암호화 후 DB 저장. 복호화는 발송 시점에만 수행.
- 환경 변수에 **하드코딩된 시크릿 금지**.

## 커밋 메시지

```
<type>(<scope>): <subject>

feat(contacts): 엑셀 파일 업로드 파서 구현
fix(dispatch): 수신거부 번호 필터링 누락 수정
chore(deps): mongoose 8.x 업데이트
```

- type: `feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `build` · `perf`
- scope: 도메인(`auth`, `platform`, `contacts`, `dispatch`, `unsubscribe`, `analytics`, `settings`) 또는 `harness`, `vscode`, `e2e`, `deps`
- 커밋 **시점과 단위**(업무 묶음마다 1커밋, 브랜치, 금지 사항)는 `rules/work-cycle.md` §5 를 따른다.
