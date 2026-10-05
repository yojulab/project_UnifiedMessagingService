# 하네스 정합성 결정 (스킬 본문보다 우선)

`.agents/` 문서들 사이 또는 PRD와 충돌하는 지점에 대한 확정 결정이다. 구현 시 아래를 따른다.

1. **Next.js / Tailwind 버전** — `create-next-app@latest`는 Tailwind v4를 설치한다. 규칙은 v3이므로 스캐폴딩 시 `--tailwind`를 **빼고** 생성한 뒤 `tailwindcss@3 postcss autoprefixer`를 수동 설치·`npx tailwindcss init -p`한다. 인증은 `next-auth@4`(Credentials Provider, JWT 세션)로 고정한다.
2. **`any` 금지** — 스킬 코드 스니펫의 `any`(`providerResponse`, `config: Record<string, any>`, `(global as any)` 등)는 설명용이다. 구현 시 `unknown` + 타입 가드, 공급사별 Config 타입, `declare global { var mongoose: ... }`로 대체한다.
3. **테마 저장 구조** — PRD §5.6은 모드와 팔레트를 동시에 선택한다(예: dark + emerald). 단일 enum `themePreference`로는 표현 불가하므로 `User.themeMode` + `User.accentColor` 두 필드로 분리한다 (`analytics-theme` 스킬).
4. **번호/이메일 단위 수신거부** — ~~`Contact.unsubscribedRecipients[]`~~ → **#25 로 대체** (테넌트 억제 목록 `Suppression`). 발송 판정은 `isRecipientBlocked()` 하나로 통일한다. `campaign-dispatch` 스킬의 `calculateMessageCount`도 이 함수를 사용하도록 구현한다 (`unsubscribe-compliance` 스킬).
5. **수신거부 토큰** — HMAC만 반환하는 `generateUnsubToken`은 조회 불가. `payload.signature` 형태 서명 토큰(`signUnsubToken/verifyUnsubToken`)을 사용하고, GET은 확인 페이지만, 상태 변경은 POST로 한다.
6. **DispatchJob 상태** — `campaign-dispatch`의 `PARTIAL`을 `DispatchJob.status` enum에 추가한다 (CommonCode `DISPATCH_STATUS`에도 이미 존재). 규칙: 전부 성공 `COMPLETED`, 실패율 > 50% `FAILED`, 그 외 일부 실패 `PARTIAL`.
7. **CommonCode 코드 형식** — PRD 예시(`EMAIL_ZOHO`) 대신 시드 형식(`PROVIDER`=`ZOHO`, 채널은 별도)을 따른다. 어댑터 레지스트리 키는 `${channel}:${provider}`.
8. **080 번호 저장 위치** — ALIGO/SOLAPI `configTemplate`에 `optOutNumber`(080 수신거부 번호, 평문) 필드를 추가한다. `SendPayload`에는 `headers?: Record<string, string>`를 추가한다 (List-Unsubscribe 전달용).
9. **AES-GCM IV** — `ENCRYPTION_IV_LENGTH`는 12(GCM 권장)로 사용한다. 저장 형식 `iv:authTag:ciphertext`(hex).
10. **전화번호 저장 형식** — 하이픈 없는 숫자열(`01012345678`)로 저장하고 표시할 때만 포맷한다.
11. **사이드바 메뉴** — "5개"라는 표기와 달리 6개(대시보드, 플랫폼, 연락처, 캠페인, 통계, 설정)로 구현한다.
12. **인터페이스 명명** — `IMessagingAdapter`만 예외로 `I` 접두사 유지, 그 외 신규 인터페이스는 접두사 없이.

새 충돌을 발견하면 임의로 해석하지 말고 이 목록에 결정을 추가한 뒤 진행한다 (사용자 판단이 필요한 경우 질문)..

## 구현 중 추가 결정 (2026-09-28, Phase 1~5 구현 시)

13. **Next.js 16 규약** — `middleware.ts` 대신 `src/proxy.ts`(Node 런타임), `params`/`searchParams`/`cookies()`는 모두 `await`, `next lint` 대신 ESLint CLI(`npm run lint`), 빌드는 Turbopack 기본. API 작성 전 `node_modules/next/dist/docs/`의 해당 문서를 확인한다.
14. **`next dev` 사용 금지 (에이전트 환경)** — Next 16 의 `next dev` 는 AI 에이전트를 감지하면 루트 `CLAUDE.md`/`AGENTS.md` 에 관리 블록을 자동 삽입한다. 검증은 `npm run build` + `next start` 로 한다. 사람이 로컬에서 쓰는 것은 무방.
15. **연락처 업로드는 stateless** — preview 와 commit 이 같은 파일을 각각 업로드한다 (서버 임시 저장·TTL 없음). 대용량이어도 10MB/50,000행 제한 내에서 재파싱 비용이 작다.
16. **연락처 검색은 정규식** — 한글 이름·회사 부분 일치가 필요하므로 `$text` 대신 이스케이프한 정규식을 쓴다 (text 인덱스 제거). 캠페인 키워드 필터도 동일한 `buildContactFilter` 를 공유한다.
17. **발송 로그 멱등성** — `DispatchLog` 에 `(dispatchJobId, recipient)` 유니크 인덱스. 같은 캠페인에서 같은 번호/이메일은 1회만 발송하고, 워커 재시작·중복 실행 시에도 재발송하지 않는다. 발송 시점에 수신거부된 수신자는 `resultCode: 'SKIPPED'` 로 기록한다 (성공률 계산에서 제외).
18. **`isUnsubscribed` 의미** — 관리자가 연락처 **전체**를 거부한 경우에만 true (자동 요약 플래그로 쓰지 않음). 080/이메일/수동 거부는 항상 `Suppression` 에 값 단위로 기록한다 (#25). 카카오 알림톡은 SMS 번호 거부도 존중하고 휴대폰 번호(01X)에만 발송한다.
19. **Zoho 헤더 제약 — ⚠ 사용자 승인 대기 (PRD §5.5-2 미충족)** — Zoho Mail REST API 는 사용자 정의 헤더를 지원하지 않아 `List-Unsubscribe` 를 붙일 수 없다. 현재: 본문 하단 수신거부 링크는 항상 삽입, 플랫폼 설정·캠페인 Step 3 에서 Zoho 선택 시 "헤더 미지원" 경고 표시, RFC 8058 이 필요한 광고 메일은 AWS SES 권장. 대안(사용자 결정 필요): (a) 현 상태 승인, (b) Zoho SMTP 어댑터 추가로 헤더 지원, (c) Zoho 광고성 이메일 발송 차단. Zoho 도메인은 공식 데이터센터 허용 목록만 허용하고, 토큰 요청은 form body 로 보낸다.
20. **서버 측 URL** — 수신거부·웹훅 링크는 런타임 변수 `NEXTAUTH_URL` 기준(`src/lib/baseUrl.ts`). `NEXT_PUBLIC_*` 는 빌드 시 고정되므로 서버 로직에 쓰지 않는다.
21. **080 웹훅 인증** — URL 에 `uid` + `sig=HMAC(WEBHOOK_SECRET, uid)` 를 포함 (`/api/me/webhook` 에서 회원별 URL 제공). 페이로드는 공급사 무관 범용 파서(`extractPhones`)로 번호를 추출한다.
22. **SMS/LMS 자동 판정** — 광고 표기·080 문구 삽입 후 EUC-KR 90byte 초과 시 SMS 채널이어도 LMS 로 발송·과금한다. 기본 단가(원): EMAIL 1, SMS 20, LMS 50, KAKAO 15 — 플랫폼 설정 `unitCost` 로 재정의.
23. **차트 색상** — 통계 차트는 강조색 테마와 무관한 고정 토큰(`--chart-success` 파랑, `--chart-fail` 빨강)을 쓴다. 초록/주황/빨강 상태색 조합은 색각이상 검증(protan/deutan)에서 실패하므로 성공 vs 실패·반송 2계열로 표시하고, 실패/반송 구분은 툴팁·표로 제공한다.
24. **캠페인 대상 스냅샷** — 발송 확정 시 대상 연락처 ID 를 `DispatchJob.targetContactIds` 에 저장한다 (RANDOM_N 재현성, 예약 발송 중 연락처 변경 영향 차단). 수신거부는 발송 시점에 다시 검증한다.
25. **테넌트 억제 목록 (Suppression)** — 번호/이메일 단위 수신거부의 **단일 기준**은 `suppressions` 컬렉션 `{userId, channel, value, reason, contactId?, at}` (`(userId, channel, value)` 유니크). 080 CSV·웹훅·이메일 원클릭·관리자 수동 차단 모두 여기에 기록하며, 연락처가 없어도 저장한다. 연락처 삭제·재업로드·`create_new` 중복 생성과 무관하게 유지되어 거부한 사람에게 재발송되지 않는다 (정보통신망법 §50). 발송·견적은 청크마다 `suppressedForContacts()` 로 불러와 `isRecipientBlocked(contact, channel, value, suppressed)` 로 판정한다. 해제는 `DELETE /api/unsubscribes` 또는 연락처 상세의 번호별 해제.
26. **DRY_RUN fail-safe** — `DRY_RUN=false` 를 명시한 경우에만 실제 공급사 API 를 호출한다. 미설정·오타는 모두 시뮬레이션.

### Zoho 실발송 검증에서 확정 (2026-09-28)

27. **수신거부 링크 공개 주소 강제** — 수신거부·웹훅 링크의 기준 주소는 `PUBLIC_BASE_URL` → `NEXTAUTH_URL` → `NEXT_PUBLIC_BASE_URL` 순(`src/lib/baseUrl.ts`). 실발송(`DRY_RUN=false`) 이메일 캠페인은 이 주소가 localhost·사설 IP·`.local`/`.internal` 이면 **생성 자체를 거부**한다(`UNSUBSCRIBE_URL_NOT_PUBLIC`, 견적 `warnings` 에도 표시). 수신자가 열 수 없는 수신거부 링크로 광고를 보내면 수신거부 수단 미제공이 되기 때문. 내부 테스트용 예외는 `ALLOW_PRIVATE_UNSUBSCRIBE_URL=true` — 운영에서는 설정 금지.
28. **광고성 이메일 표기** — 이메일도 `messageTemplate.isAd`(기본 true)를 따른다. 광고성이면 제목 앞 `(광고)` 자동 표기(중복 방지)와 푸터에 발신자 명칭(회원 회사명, 없으면 이름)·발신 주소를 넣는다(정보통신망법 시행령). 정보성(`isAd=false`)이어도 수신거부 링크는 항상 넣는다. 캠페인 Step 3 에서 이메일에도 "광고성 메일" 체크박스를 표시한다.
29. **실발송 검증 절차** — 실제 공급사로 보내는 검증은 사용자가 지정한 테스트 주소로만 한다. 자격증명은 저장소 파일·커밋에 쓰지 않고 앱 UI/API 로 등록(DB AES 암호화)하며, 작업용 임시 파일은 스크래치 영역에 두고 끝나면 삭제한다. 검증용 서버는 `DRY_RUN=false` 를 해당 프로세스에만 지정해 띄우고 끝나면 내린다.
30. **의뢰자 소통용 UI 식별 태그(`data-ui-id`) 및 인스펙터 체계 확정** — 의뢰자와의 원활한 피드백 소통 및 E2E 테스트 locator 일원화를 위해 모든 중요 HTML 태그(버튼, 입력 필드, 주요 컨테이너 등)에 `data-ui-id="<DOMAIN>-<TYPE>-<NUM>"`(예: `CNT-BTN-001`)를 필수 부여한다. 개발 환경 및 검토 모드(`NEXT_PUBLIC_ENABLE_INSPECTOR=true`)에서만 `UiInspectorOverlay` 토글(Alt+U) 및 화면 뱃지가 활성화되며, 프로덕션 빌드에서는 컴포넌트가 null 을 반환하여 완전히 은폐된다. E2E 테스트 locator 도 `[data-ui-id="..."]`를 최우선 사용한다.
