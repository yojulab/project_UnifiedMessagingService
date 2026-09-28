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

## 데이터 모델 (db-schema 보강 — `.agents/rules/harness-decisions.md` 참조)

```typescript
// Contact 스키마에 추가
unsubscribedRecipients: [{
  value:   { type: String, required: true },   // 정규화된 번호 또는 소문자 이메일
  channel: { type: String, enum: ['SMS', 'EMAIL', 'KAKAO'], required: true },
  reason:  { type: String, enum: ['OPT_OUT_080', 'OPT_OUT_EMAIL', 'MANUAL'], required: true },
  at:      { type: Date, default: Date.now },
}],
// 인덱스
ContactSchema.index({ userId: 1, 'unsubscribedRecipients.value': 1 });
```
- `isUnsubscribed`는 "연락처의 **모든** 수단이 거부됨" 또는 관리자가 연락처 전체 거부 시 `true`로 유지하는 요약 플래그다.
- `unsubscribedChannels`는 채널 전체 거부 시 사용(요약). 발송 판정은 아래 함수 하나로 통일한다.

```typescript
// src/lib/unsubscribe/isBlocked.ts
export function isRecipientBlocked(contact: ContactDoc, channel: Channel, value: string): boolean {
  if (contact.isUnsubscribed) return true;
  const ch = channel === 'LMS' ? 'SMS' : channel;           // LMS는 SMS 거부를 따름
  if (contact.unsubscribedChannels.includes(ch)) return true;
  return contact.unsubscribedRecipients.some((r) => r.channel === ch && r.value === value);
}
```

## SMS — 080 무료수신거부

- 080 번호는 `PlatformConfig.configData.optOutNumber`(평문)에 저장한다. SMS/LMS 광고 발송 시 설정이 없으면 **발송 차단 + 설정 안내**.
- 본문 끝 삽입 문구: `\n(무료수신거부: 080-XXX-XXXX)` — 이미 포함돼 있으면 중복 삽입하지 않는다.
- 광고 문자 규정상 본문 앞 `(광고)` 표기 옵션을 Step 3 UI에 제공한다 (기본 ON).
- 삽입 후 바이트 수(EUC-KR 기준 90byte)로 SMS/LMS를 재판정하고 Step 2 견적에 반영한다.

### 080 거부 목록 동기화
- **수동**: `POST /api/unsubscribe/sms/import` — CSV(번호 1열) 업로드 → 정규화 → 해당 `userId`의 `phones`에 일치하는 Contact들에 `unsubscribedRecipients` push(`OPT_OUT_080`).
- **자동**: `POST /api/webhooks/{provider}/opt-out` — 공급사 웹훅. 서명 검증 필수, 공급사별 페이로드 파싱은 어댑터의 선택 메서드 `parseOptOutWebhook?(req)`로 위임.

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
| POST | `/api/unsubscribe` | 폼 제출 또는 RFC 8058 원클릭(`List-Unsubscribe=One-Click` body) → 해당 email을 `unsubscribedRecipients`에 추가(`OPT_OUT_EMAIL`) → 200 |

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
