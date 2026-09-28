---
name: campaign-dispatch
description: 캠페인 발송 마법사(Step 1~4) 및 발송 엔진 구현 가이드. 채널/플랫폼 선택, 타겟 모수 설정(ALL/TOP_N/RANDOM_N), 메시지 작성(치환태그/수신거부 삽입), 최종 검토 및 발송 프로세스를 참조할 때 이 스킬을 사용한다.
---

# 캠페인 발송 구현 스킬 (Phase 4)

## 목적
PRD §5.4 발송 방식 및 수신자 대상 설정, §5.5 수신거부 자동화 체계를 구현한다.

---

## 발송 마법사 Step 구조

### Step 1: 발송 채널 & 플랫폼 선택

```
┌─────────────────────────────────────┐
│  발송 채널 선택                      │
│  ○ 이메일 (EMAIL)                   │
│  ○ SMS / LMS                        │
│  ○ 카카오 알림톡                     │
├─────────────────────────────────────┤
│  발송 플랫폼 선택                    │
│  [등록된 플랫폼 드롭다운]             │
│  (예: Zoho REST API - contact@...)  │
│                                     │
│  ⚠️ 등록된 플랫폼이 없습니다.         │
│  [플랫폼 설정 바로가기 →]             │
└─────────────────────────────────────┘
```

- 선택 가능한 플랫폼은 `PlatformConfigs`에서 `userId` + `channel` + `status: ACTIVE` 조건으로 조회.
- 미등록 시 플랫폼 설정 페이지 링크 제공.

### Step 2: 타겟 모수 설정

```
┌─────────────────────────────────────┐
│  발송 대상 설정                      │
│                                     │
│  타겟팅 모드:                        │
│  ● 전체 발송 (수신거부 제외)          │
│  ○ 상위 N명 (정렬 기준 선택)         │
│  ○ 무작위 N명 (랜덤 샘플링)          │
│  [N = ____명]                       │
│                                     │
│  필터링 조건:                        │
│  출처 파일: [____________ ▼] 복수선택 │
│  라벨:     [____________ ▼] 복수선택  │
│  키워드:   [________________]        │
│                                     │
│  ──────────────────────────────     │
│  대상 고객 수:     100 명            │
│  예상 발송 건수:   135 건            │
│  (다중 연락처 포함)                   │
│  예상 비용:       ₩2,700             │
└─────────────────────────────────────┘
```

#### 타겟팅 모드 구현

```typescript
// 서비스 레이어 의사 코드
async function resolveTargets(userId: ObjectId, filter: TargetFilter): Promise<Contact[]> {
  const query: any = {
    userId,
    isUnsubscribed: false,  // 전체 수신거부 제외
  };

  // 라벨 필터
  if (filter.labels?.length) {
    query.labels = { $in: filter.labels };
  }

  // 출처 파일 필터
  if (filter.sourceNames?.length) {
    query.sourceName = { $in: filter.sourceNames };
  }

  // 키워드 검색
  if (filter.keywords) {
    query.$text = { $search: filter.keywords };
  }

  let cursor = Contact.find(query);

  switch (filter.mode) {
    case 'TOP_N':
      cursor = cursor.sort({ createdAt: -1 }).limit(filter.limit!);
      break;
    case 'RANDOM_N':
      // MongoDB $sample 파이프라인 사용
      return Contact.aggregate([
        { $match: query },
        { $sample: { size: filter.limit! } },
      ]);
    case 'ALL':
    default:
      break;
  }

  return cursor.exec();
}
```

#### 발송 건수 계산 (다중 연락처)

```typescript
function calculateMessageCount(contacts: Contact[], channel: string): {
  targetCount: number;
  messageCount: number;
} {
  let messageCount = 0;
  for (const contact of contacts) {
    if (channel === 'EMAIL') {
      // 수신거부되지 않은 이메일 수
      const activeEmails = contact.emails.filter(
        email => !contact.unsubscribedChannels.includes('EMAIL')
        // 또는 개별 이메일 수신거부 체크 로직
      );
      messageCount += activeEmails.length;
    } else {
      // SMS/LMS/KAKAO: 수신거부되지 않은 전화번호 수
      const activePhones = contact.phones.filter(
        phone => !contact.unsubscribedChannels.includes(channel)
      );
      messageCount += activePhones.length;
    }
  }
  return { targetCount: contacts.length, messageCount };
}
```

### Step 3: 메시지 작성

```
┌─────────────────────────────────────┐
│  메시지 작성                         │
│                                     │
│  [이메일인 경우] 제목:               │
│  [____________________________]     │
│                                     │
│  본문:                              │
│  ┌─────────────────────────────┐    │
│  │ {name}님 안녕하세요,          │    │
│  │                             │    │
│  │ ...메시지 내용...             │    │
│  │                             │    │
│  │ ⚡ 자동 삽입 영역:            │    │
│  │ [080 수신거부 / Unsub 링크]   │    │
│  └─────────────────────────────┘    │
│                                     │
│  치환 태그: {name} {company}        │
│  [미리보기 →]                       │
└─────────────────────────────────────┘
```

#### 치환 태그 처리

```typescript
function resolveTemplate(template: string, contact: Contact): string {
  return template
    .replace(/\{name\}/g, contact.name)
    .replace(/\{company\}/g, contact.company || '')
    .replace(/\{department\}/g, contact.department || '');
}
```

#### 수신거부 자동 삽입

- **SMS/LMS**: 본문 끝에 `\n(무료수신거부: 080-XXX-XXXX)` 자동 추가
- **이메일**: HTML 하단에 수신거부 링크 삽입 + `List-Unsubscribe` 헤더

```typescript
// 이메일 수신거부 토큰 생성
import crypto from 'crypto';

function generateUnsubToken(contactId: string, email: string): string {
  const hmac = crypto.createHmac('sha256', process.env.NEXTAUTH_SECRET!);
  hmac.update(`${contactId}:${email}`);
  return hmac.digest('hex');
}
```

### Step 4: 최종 검토 & 발송

```
┌─────────────────────────────────────┐
│  발송 전 최종 검토                    │
│                                     │
│  채널:     이메일 (Zoho REST API)    │
│  대상:     100명 → 135건 발송       │
│  모드:     전체 발송                  │
│  필터:     라벨 "VIP", "Partner"     │
│  예상 비용: ₩2,700                  │
│                                     │
│  [샘플 미리보기 (1건)]               │
│  ┌──────────────────────────────┐   │
│  │ To: kylee@lemonit.co.kr      │   │
│  │ Subject: 이관열님 안녕하세요    │   │
│  │ Body: (미리보기 렌더링)        │   │
│  └──────────────────────────────┘   │
│                                     │
│  발송 시점:                          │
│  ● 즉시 발송                        │
│  ○ 예약 발송 [__날짜__] [__시간__]   │
│                                     │
│  [← 이전] [취소]        [🚀 발송]    │
└─────────────────────────────────────┘
```

---

## 발송 엔진 흐름 (서버 사이드)

```
1. DispatchJob 생성 (status: PENDING)
2. resolveTargets() → 대상 연락처 목록 확보
3. 각 연락처의 모든 phones[] / emails[] 순회
   3-1. 개별 번호/이메일 수신거부 체크
   3-2. 치환태그 처리
   3-3. 수신거부 푸터 삽입
   3-4. AdapterFactory.create() → 어댑터 인스턴스 획득
   3-5. adapter.send() 호출
   3-6. DispatchLog 생성 (결과 기록)
4. Fallback 처리 (카카오 실패 → LMS 전환)
5. DispatchJob 상태 업데이트 (COMPLETED / FAILED / PARTIAL)
6. sentCount / failedCount 집계
```

## 에러 핸들링

- 개별 발송 실패 시 해당 `DispatchLog`만 FAILED로 기록하고, 다음 건으로 진행.
- 전체 실패율이 50%를 초과하면 `DispatchJob.status = 'FAILED'`로 변경.
- 일부 성공 + 일부 실패 = `PARTIAL` 상태.
