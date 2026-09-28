---
name: unsubscribe-compliance
description: 수신거부 자동화 체계(PRD §5.5) 구현 가이드. SMS 080 무료수신거부 문구 자동 삽입, 080 거부 목록 CSV 업로드/웹훅 동기화, 이메일 HMAC 토큰 원클릭 수신거부 페이지, RFC 8058 List-Unsubscribe / List-Unsubscribe-Post 헤더, 번호·이메일 단위 수신거부 검증을 구현할 때 이 스킬을 사용한다.
---

# 수신거부 자동화 스킬 (Phase 4~5 — PRD §5.5)

## 핵심 원칙
1. 수신거부 검증은 **개별 번호/이메일 단위**로 수행한다 (연락처 전체가 아닌 특정 값만 핀포인트 제외).
2. 수신거부 상태는 어떤 업로드/덮어쓰기로도 **자동 해제되지 않는다**. 해제는 관리자 수동 토글(`MANUAL`)만 가능.
3. 광고성 메시지에는 수신거부 수단이 **반드시** 포함된다. 누락 시 발송 엔진이 발송을 거부해야 한다.

---

## 데이터 모델 — 테넌트 억제 목록 (harness-decisions #25)

```typescript
// src/lib/db/models/Suppression.ts — 번호/이메일 단위 거부의 단일 기준 (연락처와 독립)
{ userId, channel: 'SMS' | 'EMAIL' | 'KAKAO', value /* 정규화 번호 또는 소문자 이메일 */, reason: 'OPT_OUT_080' | 'OPT_OUT_EMAIL' | 'MANUAL', contactId?, at }
SuppressionSchema.index({ userId: 1, channel: 1, value: 1 }, { unique: true });
```
- `Contact.isUnsubscribed` 는 관리자가 연락처 **전체**를 거부한 경우만, `unsubscribedChannels` 는 채널 전체 거부.
- 연락처 삭제·재업로드·중복 생성에도 억제 목록은 유지된다 → 거부한 사람에게 재발송 불가.

```typescript
// src/lib/unsubscribe/isBlocked.ts — 발송 판정 단일 진입점
isRecipientBlocked(contact, channel, value, suppressed /* Set<`${channel}:${value}`> */): boolean
// 서비스: suppress / unsuppress / suppressedForContacts / blockRecipients (src/lib/unsubscribe/service.ts)
```

## SMS — 080 무료수신거부

- 080 번호는 `PlatformConfig.configData.optOutNumber`(평문)에 저장한다. SMS/LMS 광고 발송 시 설정이 없으면 **발송 차단 + 설정 안내**.
- 본문 끝 삽입 문구: `\n(무료수신거부: 080-XXX-XXXX)` — 이미 포함돼 있으면 중복 삽입하지 않는다.
- 광고 문자 규정상 본문 앞 `(광고)` 표기 옵션을 Step 3 UI에 제공한다 (기본 ON).
- 삽입 후 바이트 수(EUC-KR 기준 90byte)로 SMS/LMS를 재판정하고 Step 2 견적에 반영한다.

### 080 거부 목록 동기화
- **수동**: `POST /api/unsubscribe/sms/import` — CSV/엑셀 업로드 → 모든 셀에서 번호 추출·정규화 → `Suppression` 에 upsert(`OPT_OUT_080`). 일치하는 연락처가 없어도 저장.
- **자동**: `POST /api/webhooks/{provider}/opt-out?uid=..&sig=..` — 공급사 웹훅. URL 의 HMAC 서명으로 테넌트 인증(harness-decisions #21), 페이로드는 범용 파서 `extractPhones` 로 번호 추출. 회원별 URL 은 `GET /api/me/webhook`.

## 이메일 — 원클릭 수신거부

### 토큰 (상태 없는 서명 토큰)
```typescript
// src/lib/unsubscribe/token.ts
// token = base64url(JSON{ c: contactId, e: email, u: userId }) + '.' + base64url(HMAC-SHA256(payload))
// 비밀키: UNSUBSCRIBE_SECRET (없으면 NEXTAUTH_SECRET fallback)
export function signUnsubToken(p: { contactId: string; email: string; userId: string }): string;
export function verifyUnsubToken(token: string): { contactId: string; email: string; userId: string } | null;
// 검증은 crypto.timingSafeEqual 사용
```
> campaign-dispatch 스킬의 `generateUnsubToken`(HMAC만 반환)은 페이로드가 없어 조회가 불가능하므로 위 형식으로 대체한다.

### 엔드포인트
| Method | Path | 동작 |
|---|---|---|
| GET | `/unsubscribe?token=...` (페이지) | 토큰 검증 → "수신거부 하시겠습니까?" 확인 페이지 (GET으로 상태 변경 금지 — 메일 스캐너 프리패치 방지) |
| POST | `/api/unsubscribe` | 폼 제출 또는 RFC 8058 원클릭(`List-Unsubscribe=One-Click` body) → 토큰의 (userId, email) 을 `Suppression` 에 upsert(`OPT_OUT_EMAIL`) → 200 |

- `/api/unsubscribe`, `/unsubscribe`는 **인증 미들웨어 예외 경로**다. 테넌트는 토큰의 `u`로 식별한다.
- 이미 거부된 경우에도 200 (멱등).

### 헤더 (RFC 8058)
```
List-Unsubscribe: <https://{BASE_URL}/api/unsubscribe?token={token}>, <mailto:{senderAddress}?subject=unsubscribe>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```
- 어댑터 `SendPayload`에 `headers?: Record<string, string>`를 추가하여 전달한다 (Zoho/SES 각 API 형식으로 매핑).
- HTML 본문 하단 푸터에는 확인 페이지 URL(`/unsubscribe?token=`)을 링크한다.

## 수신거부 관리 화면 (Analytics 메뉴 하위)
- 채널/사유/기간 필터, 수동 해제(사유 기록), CSV 내보내기.

## 완료 조건
- [ ] 080 번호 미설정 SMS 광고 발송이 차단됨
- [ ] 080 CSV 업로드 후 해당 번호만 발송 대상에서 제외(같은 연락처의 다른 번호는 발송)
- [ ] 토큰 위변조 시 400, 정상 토큰은 확인 페이지 → POST 후 거부 반영
- [ ] 발송 메일 원본에 `List-Unsubscribe`, `List-Unsubscribe-Post` 헤더 존재
- [ ] 재업로드(overwrite)로 거부 상태가 해제되지 않음
- [ ] 연락처 삭제 후 재업로드 / `create_new` 중복 연락처 / 연락처 없는 번호의 080 웹훅 — 모두 이후 발송에서 제외

## 완료 조건

- [ ] Playwright headless E2E `e2e/phase4-campaign`, `phase5-analytics.spec.ts` 통과 (`e2e-playwright` 스킬 §6 필수 시나리오)
