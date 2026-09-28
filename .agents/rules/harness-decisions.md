# 하네스 정합성 결정 (스킬 본문보다 우선)

`.agents/` 문서들 사이 또는 PRD와 충돌하는 지점에 대한 확정 결정이다. 구현 시 아래를 따른다.

1. **Next.js / Tailwind 버전** — `create-next-app@latest`는 Tailwind v4를 설치한다. 규칙은 v3이므로 스캐폴딩 시 `--tailwind`를 **빼고** 생성한 뒤 `tailwindcss@3 postcss autoprefixer`를 수동 설치·`npx tailwindcss init -p`한다. 인증은 `next-auth@4`(Credentials Provider, JWT 세션)로 고정한다.
2. **`any` 금지** — 스킬 코드 스니펫의 `any`(`providerResponse`, `config: Record<string, any>`, `(global as any)` 등)는 설명용이다. 구현 시 `unknown` + 타입 가드, 공급사별 Config 타입, `declare global { var mongoose: ... }`로 대체한다.
3. **테마 저장 구조** — PRD §5.6은 모드와 팔레트를 동시에 선택한다(예: dark + emerald). 단일 enum `themePreference`로는 표현 불가하므로 `User.themeMode` + `User.accentColor` 두 필드로 분리한다 (`analytics-theme` 스킬).
4. **번호/이메일 단위 수신거부** — `Contact`에 `unsubscribedRecipients[]`를 추가하고, 발송 판정은 `isRecipientBlocked()` 하나로 통일한다. `campaign-dispatch` 스킬의 `calculateMessageCount`도 이 함수를 사용하도록 구현한다 (`unsubscribe-compliance` 스킬).
5. **수신거부 토큰** — HMAC만 반환하는 `generateUnsubToken`은 조회 불가. `payload.signature` 형태 서명 토큰(`signUnsubToken/verifyUnsubToken`)을 사용하고, GET은 확인 페이지만, 상태 변경은 POST로 한다.
6. **DispatchJob 상태** — `campaign-dispatch`의 `PARTIAL`을 `DispatchJob.status` enum에 추가한다 (CommonCode `DISPATCH_STATUS`에도 이미 존재). 규칙: 전부 성공 `COMPLETED`, 실패율 > 50% `FAILED`, 그 외 일부 실패 `PARTIAL`.
7. **CommonCode 코드 형식** — PRD 예시(`EMAIL_ZOHO`) 대신 시드 형식(`PROVIDER`=`ZOHO`, 채널은 별도)을 따른다. 어댑터 레지스트리 키는 `${channel}:${provider}`.
8. **080 번호 저장 위치** — ALIGO/SOLAPI `configTemplate`에 `optOutNumber`(080 수신거부 번호, 평문) 필드를 추가한다. `SendPayload`에는 `headers?: Record<string, string>`를 추가한다 (List-Unsubscribe 전달용).
9. **AES-GCM IV** — `ENCRYPTION_IV_LENGTH`는 12(GCM 권장)로 사용한다. 저장 형식 `iv:authTag:ciphertext`(hex).
10. **전화번호 저장 형식** — 하이픈 없는 숫자열(`01012345678`)로 저장하고 표시할 때만 포맷한다.
11. **사이드바 메뉴** — "5개"라는 표기와 달리 6개(대시보드, 플랫폼, 연락처, 캠페인, 통계, 설정)로 구현한다.
12. **인터페이스 명명** — `IMessagingAdapter`만 예외로 `I` 접두사 유지, 그 외 신규 인터페이스는 접두사 없이.

새 충돌을 발견하면 임의로 해석하지 말고 이 목록에 결정을 추가한 뒤 진행한다 (사용자 판단이 필요한 경우 질문)..
