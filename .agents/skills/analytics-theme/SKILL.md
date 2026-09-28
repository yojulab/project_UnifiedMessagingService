---
name: analytics-theme
description: Phase 5 구현 가이드. 발송 결과 대시보드(캠페인별 성공/실패/반송 집계, 비용, 상세 로그 필터·CSV 내보내기), 환경 설정(기본 발신자 프로필), next-themes + CSS 변수 기반 Light/Dark/System 모드와 Accent Color 팔레트 저장·즉시 반영을 구현할 때 이 스킬을 사용한다.
---

# 발송 분석 & 테마 설정 스킬 (Phase 5 — PRD §4.4, §4.5, §5.6)

---

## 1. 발송 결과 & 통계

### 집계 (DispatchLog aggregation — 반드시 `userId` $match 선행)
```typescript
DispatchLog.aggregate([
  { $match: { userId, dispatchJobId } },
  { $group: { _id: '$resultCode', count: { $sum: 1 }, cost: { $sum: '$unitCost' } } },
]);
```
- 대시보드 KPI: 기간 내 총 발송 건수 / 성공률 / 실패·반송 건수 / 총 비용 / 신규 수신거부 수.
- 추이 차트: `sentAt` 일 단위 `$dateTrunc` (timezone `Asia/Seoul`), 채널별 시리즈.
- `DispatchJob.sentCount/failedCount`는 발송 엔진이 갱신하는 캐시 값이며, 상세 화면 수치는 로그 집계 기준으로 표시한다.

### 화면
| 경로 | 내용 |
|---|---|
| `/analytics` | KPI 카드 + 일별 추이 + 최근 캠페인 목록 |
| `/analytics/campaigns/[id]` | 캠페인 요약(채널/플랫폼/필터/템플릿) + 결과 분포 + 로그 테이블 |
| `/analytics/unsubscribes` | 수신거부 목록 관리 (unsubscribe-compliance 스킬) |

- 로그 테이블: resultCode/채널/수신자 검색 필터, 커서 페이지네이션, CSV 내보내기(스트리밍 응답).
- 진행 중(SENDING) 캠페인은 5초 폴링으로 진행률 갱신.

### API
| Method | Path |
|---|---|
| GET | `/api/analytics/summary?from&to` |
| GET | `/api/analytics/timeseries?from&to&channel` |
| GET | `/api/campaigns/[id]/logs?cursor&resultCode&q` |
| GET | `/api/campaigns/[id]/logs/export` |

## 2. 환경 설정

- 기본 발신자 프로필: `User.name`, `company`, `defaultSenderPhone`, `defaultSenderEmail` 수정 (`PATCH /api/me`).
- 비밀번호 변경: 현재 비밀번호 확인 후 bcrypt(12) 재해시.

## 3. 테마 (PRD §5.6)

모드와 팔레트는 **독립된 두 축**이다 (`.agents/rules/harness-decisions.md` 참조):
```typescript
// User 스키마
themeMode:   { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
accentColor: { type: String, enum: ['blue', 'indigo', 'emerald', 'violet', 'rose', 'slate'], default: 'blue' },
```

### 구현
- 모드: `next-themes` `ThemeProvider attribute="class"` + Tailwind `darkMode: 'class'`.
- 팔레트: `<html data-accent="emerald">` 속성으로 전환. `globals.css`에 팔레트별 CSS 변수 정의:
```css
:root { --primary: 221 83% 53%; --primary-foreground: 0 0% 100%; }          /* blue */
[data-accent='emerald'] { --primary: 160 84% 39%; --primary-foreground: 0 0% 100%; }
/* indigo, violet, rose, slate 동일 패턴, .dark 조합에서 대비 확인 */
```
```typescript
// tailwind.config.ts
colors: { primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' } }
```
- 초기 렌더 깜빡임 방지: 서버 컴포넌트 `layout.tsx`에서 세션 사용자의 `accentColor`를 읽어 `<html data-accent>`에 SSR로 주입.
- 변경 시: 클라이언트에서 즉시 `document.documentElement.dataset.accent` / `setTheme()` 반영 → `PATCH /api/me/theme` 비동기 저장 (새로고침 없음).

## 완료 조건
- [ ] 캠페인 상세 수치 = DispatchLog 집계와 일치
- [ ] 다른 회원의 캠페인 id 접근 시 404
- [ ] 로그 CSV 내보내기 (한글 깨짐 없음 — UTF-8 BOM)
- [ ] 모드 3종 × 팔레트 6종 전환이 새로고침 없이 반영되고 재로그인 후 유지
- [ ] 다크 모드에서 primary 버튼 텍스트 대비 확보
