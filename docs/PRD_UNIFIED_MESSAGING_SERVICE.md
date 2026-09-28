# [PRD] 통합 메시징 서비스 (Unified Messaging Service) 업무지시서

- **버전**: v0.2 (인터뷰 1차 결과 반영)
- **작성일**: 2026-09-28
- **상태**: 1차 인터뷰 완료 및 아키텍처 확정
- **대상 플랫폼**: Web Application (Next.js / React, Node.js, MongoDB, TailwindCSS)

---

## 1. 프로젝트 개요 (Overview)

### 1.1 배경 및 목적
* 고객 및 보유 연락처(CSV, 엑셀, 텍스트)를 기반으로 **이메일(Email)**과 **SMS/LMS/카카오톡**을 단일 시스템에서 유연하게 발송·관리하는 **멀티 플랫폼 통합 메시징 솔루션**을 구축한다.
* 특정 발송사에 종속되지 않는 **공급사 중립적 어댑터 패턴(Provider Adapter Pattern)**을 채택하여, 회원(테넌트)별로 원하는 발송 플랫폼(Zoho, AWS SES, 알리고, 솔라피 등)의 API Key를 등록하여 독립적으로 발송 및 수신거부 관리를 수행한다.

### 1.2 핵심 가치 (Core Values)
1. **플랫폼 중립성 & 플러그인 아키텍처**: 메시징 공급사 인터페이스(`IMessagingAdapter`)를 추상화하여 어떤 SMS/Email 플랫폼이든 모듈식으로 추가·교체 가능.
2. **간편한 설정(UX)**: 플랫폼 선택 시 필요 변수 가이드 실시간 제공 및 `Textarea` 일괄 붙여넣기(JSON or KEY=VALUE) 파싱 저장.
3. **유연한 데이터 수용**: 업로드된 파일의 형태에 구애받지 않고 사용자가 컬럼(이름, 다중 연락처, 다중 이메일)을 직접 매핑.
4. **다중 연락처 완벽 도달**: 한 연락처에 복수의 번호/이메일이 등록된 경우 모든 채널로 각각 발송하여 도달률 극대화 (개별 수신거부 검증).
5. **법적 규제 및 수신거부 완벽 준수**: 080 수신거부, 이메일 Unsubscribe 자동 동기화 및 Master-Detail 상세 관리.
6. **테넌트 격리**: 회원별 연락처, 발송 이력, 플랫폼 연동 정보의 완전 분리.

---

## 2. 시스템 아키텍처 & 기술 스택 (Tech Stack)

| 구분 | 기술 스택 | 설명 |
| :--- | :--- | :--- |
| **Framework** | **Next.js (App Router) + Node.js** | Fullstack React 프레임워크 (API Routes + Server/Client Components) |
| **Database** | **MongoDB** (Mongoose ODM) | 비정형 메타데이터, 다중 전화/이메일 배열 구조, 커스텀 필드 처리에 최적화 |
| **Frontend / UI** | **React + TailwindCSS** | 컴포넌트 기반 반응형 UI, 테마 커스텀(Dark/Light & Color Palette 지원) |
| **디자인 패턴** | **Provider Adapter Pattern** | `EmailAdapter` & `SmsAdapter` 인터페이스 기반 플랫폼 독립적 구현 |
| **설정 관리** | `.env` & `CommonCode Table` | 시스템 고정 변수는 `.env`, 업무/상태 코드는 DB `CommonCode`로 관리 |
| **보안** | AES-256-GCM / bcrypt | 회원 비밀번호 단방향 암호화, 공급사 API Key/Secret 양방향 암호화 저장 |

---

## 3. 데이터베이스 모델링 (MongoDB Collections)

### 3.1 `Users` (회원 정보)
```json
{
  "_id": "ObjectId",
  "email": "user@example.com",
  "passwordHash": "string",
  "name": "홍길동",
  "company": "Axfoundly",
  "defaultSenderPhone": "010-XXXX-XXXX",
  "defaultSenderEmail": "contact@axfoundly.com",
  "themePreference": "light | dark | blue | emerald",
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}
```

### 3.2 `CommonCodes` (공통 코드 테이블)
시스템 설정, 발송 유형, 제공자 목록, 상태값을 중앙 관리.
```json
{
  "_id": "ObjectId",
  "category": "MSG_CHANNEL | PROVIDER | DISPATCH_STATUS | UNSUB_REASON",
  "code": "EMAIL_ZOHO | SMS_ALIGO | STATUS_SUCCESS ...",
  "name": "Zoho Mail REST API | 알리고 SMS ...",
  "sortOrder": 1,
  "isActive": true,
  "configTemplate": "JSON 템플릿 (플랫폼별 필요 파라미터 정의)",
  "createdAt": "ISODate"
}
```

### 3.3 `PlatformConfigs` (회원별 플랫폼 연동 키 설정)
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId (Users ref)",
  "channel": "EMAIL | SMS | KAKAO",
  "provider": "ZOHO | AWS_SES | ALIGO | SOLAPI",
  "configData": {
    "clientId": "encrypted_string",
    "clientSecret": "encrypted_string",
    "apiKey": "encrypted_string",
    "senderAddress": "contact@axfoundly.com",
    "senderNumber": "01024058735",
    "extra": {}
  },
  "isDefault": true,
  "status": "ACTIVE | ERROR",
  "updatedAt": "ISODate"
}
```

### 3.4 `Contacts` (연락처 정보)
다중 연락처/이메일 및 출처 파일 추적 지원.
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "uploadBatchId": "ObjectId (UploadHistory ref)",
  "sourceName": "구글_연락처_명단_20260917.csv",
  "name": "이관열",
  "phones": ["010-4788-3936", "02-123-4567"],
  "emails": ["kylee@lemonit.co.kr"],
  "company": "LEMON.IT",
  "department": "대표",
  "labels": ["KoreaITAgency", "VIP"],
  "notes": "하이텍 사장 소개",
  "isUnsubscribed": false,
  "unsubscribedChannels": [],
  "unsubscribedAt": null,
  "customFields": {},
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}
```

### 3.5 `DispatchJobs` & `DispatchLogs` (발송 작업 및 로그)
* **`DispatchJobs`**: 캠페인명, 대상 조건, 발송 채널, 본문 템플릿, 예약/즉시 실행 정보.
* **`DispatchLogs`**: 수신자 번호/이메일, 발송 결과(성공/실패), 공급사 응답 코드, 에러 메시지, 과금 단가.

---

## 4. 프로세스 및 메뉴 구조 (Information Architecture)

메뉴는 실제 사용자의 작업 동선에 맞춰 직관적으로 구성한다.

```
[통합 메시징 대시보드]
  │
  ├── 1. 플랫폼 연동 설정 (Platform Config)
  │     ├── 공급사 선택 (Zoho, AWS SES, 알리고, 솔라피 등)
  │     ├── 변수 가이드 및 Textarea 일괄 입력
  │     └── 연결 테스트 (Ping / Test Send)
  │
  ├── 2. 연락처 관리 (Contacts Hub)
  │     ├── 파일 업로드 (엑셀 / CSV / TXT Drag & Drop)
  │     ├── 스마트 컬럼 매핑 (이름, 전화번호 복수, 이메일 복수 지정)
  │     └── 연락처 탐색기 (Master-Detail 뷰, 출처/수신거부 필터)
  │
  ├── 3. 메시지 발송 (Campaign Dispatcher)
  │     ├── Step 1: 발송 채널 & 플랫폼 선택 (Email / SMS / LMS / 카카오)
  │     ├── Step 2: 타겟 모수 설정 (필터링, 발송 명수 및 성격 지정)
  │     ├── Step 3: 메시지 작성 (080 수신거부 자동삽입, 치환태그 {name})
  │     └── Step 4: 발송 전 최종 검토 및 즉시/예약 발송
  │
  ├── 4. 발송 결과 & 통계 (Analytics & Logs)
  │     ├── 발송 이력 상세 로그 (성공/실패/반송)
  │     └── 수신 거부(080 / Unsubscribe) 목록 관리
  │
  └── 5. 환경 설정 (Settings)
        ├── 기본 발신자 프로필 (회원정보 연동)
        └── Tailwind 테마 커스텀 (Primary Color, Dark/Light 모드)
```

---

## 5. 핵심 기능별 상세 명세

### 5.1 플랫폼 Key 설정 및 Textarea 일괄 입력
* **변수 가이드 제공**: 플랫폼(예: `알리고`, `Zoho REST API`) 선택 시 필요한 필수 필드 목록을 UI에 실시간 안내.
* **Textarea 일괄 입력 지원**:
  * `JSON` 형태 (`{"apiKey": "...", "userId": "..."}`) 또는
  * `KEY=VALUE` 형태 (`API_KEY=xxx\nUSER_ID=yyy`)로 Textarea에 붙여넣으면 백엔드/프론트엔드에서 자동 파싱하여 저장.
* **즉시 연결 테스트**: 저장 전 '테스트 발송' 버튼을 통해 설정 키의 유효성을 1건 즉각 검증.

### 5.2 연락처 파일 업로드 & 동적 컬럼 매핑
1. **파일 파싱**: `.xlsx`, `.xls`, `.csv`, `.tsv`, `.txt` 지원.
2. **컬럼 선택 인터페이스**:
   * 업로드된 파일의 상위 3개 행(샘플 데이터)을 미리보기로 표출.
   * 사용자가 각 항목에 매핑할 컬럼을 드롭다운으로 선택:
     * `성명/이름 컬럼`: 1개 선택 (필수)
     * `연락처(전화번호) 컬럼`: 복수 선택 가능 (예: `연락처 1`, `연락처 2`)
     * `이메일 컬럼`: 복수 선택 가능 (예: `이메일 1`, `이메일 2`)
     * `회사/직책/메모 등 커스텀 컬럼`: 선택적 매핑
3. **데이터 정제 & 중복 처리**:
   * 전화번호 하이픈 정규화 (`010-1234-5678` or `01012345678`)
   * 이메일 유효성 검사
   * 기존 DB 내 중복 처리 옵션 (덮어쓰기 / 건너뛰기 / 신규 추가)

### 5.3 연락처 리스트 (Master-Detail UI)
* **Master (좌측/상단)**:
  * 연락처 목록 테이블 (이름, 대표번호, 대표이메일, 출처 파일명, 수신 거부 뱃지).
  * 검색(이름, 번호, 회사) 및 필터(출처별, 수신거부 제외, 라벨별).
* **Detail (우측/하단)**:
  * 특정 연락처 클릭 시 상세 슬라이드/패널 오픈.
  * 모든 다중 전화번호/이메일, 메모, 원본 메타데이터 표시.
  * 과거 발송 이력(어떤 채널로 언제 무엇을 보냈는지 타임라인) 표시.
  * 수신거부 수동 토글(해제/등록) 기능.

### 5.4 발송 방식 및 수신자 대상(명수/성격) 설정
1. **발송 대상 타겟팅 모드 (3대 모드 지원)**:
   * **모드 A: 전체 발송 (All Active Contacts)**: 수신거부자를 제외한 조건 부합 전체 대상 발송.
   * **모드 B: 상위 N명 발송 (Top-N Limit)**: 정렬 기준(최신 등록순, 이름순 등)에 따라 상위 N명만 발송 (테스트 및 분할 발송용).
   * **모드 C: 무작위 샘플링 N명 (Random N Sampling)**: 전체 모수 중 랜덤으로 N명을 무작위 추출하여 발송 (A/B 테스트용).
2. **타겟 성격(속성) 필터링**:
   * 출처 파일별 (예: `[통합] 구글_연락처_명단_20260917.csv` 업로드 건만)
   * 라벨/그룹별 (예: `KoreaITAgency`, `WIZnetAcademy`, `정보제공대상자` 등 다중 선택)
   * 회사/소속 및 키워드 검색 필터
3. **다중 연락처/이메일 발송 정책**:
   * 한 명의 회원에게 복수의 전화번호나 이메일이 등록된 경우, **등록된 모든 번호/이메일로 각각 발송 (중복 도달 허용)**.
   * 단, 수신거부 검증은 각 개별 번호/이메일 단위로 엄격히 수행(080 거부된 특정 번호만 핀포인트 제외).
   * UI 상에서 "대상 고객 수(예: 100명)"와 "예상 발송 메시지 건수(예: 135건)"를 명확히 구분하여 견적 및 예상 비용 사전 표출.
4. **발송 채널 및 플랫폼 선택**:
   * 이메일(Zoho / SES / 기타) or 문자(LMS / SMS / 카카오 알림톡) 선택.
   * 복수 플랫폼 키가 등록되어 있을 경우 우선순위 공급사 선택.
   * Fallback 옵션: 카카오 알림톡 발송 실패 시 LMS로 자동 전환 발송 지원.

### 5.5 수신 거부(Unsubscribe) 자동화 체계
1. **문자 메시지 080 수신거부 체계**:
   * 문자(광고) 발송 시 본문 하단에 `(무료수신거부: 080-XXX-XXXX)` 자동 삽입.
   * 080 수신거부 번호는 회원별 플랫폼 설정(`PlatformConfigs`)에서 지정.
   * 080 등록 데이터는 수동 파일 업로드(CSV) 또는 공급사 웹훅/API 폴링을 통해 DB `Contacts.isUnsubscribed = true` 및 `unsubscribedChannels: ['SMS']`로 자동 동기화.
2. **이메일 원클릭 수신 거부 체계**:
   * 발송되는 모든 마케팅 이메일 하단에 고유 토큰이 포함된 수신거부 링크 자동 삽입:
     * `https://[서비스도메인]/api/unsubscribe?token=[HMAC_TOKEN]`
   * 수신자가 링크 클릭 시 확인 페이지 표출 후, DB에서 즉시 해당 이메일의 수신거부 플래그 업데이트.
   * RFC 8058 준수 `List-Unsubscribe` 및 `List-Unsubscribe-Post` 헤더 자동 탑재 (Gmail/네이버 메일 상단 수신거부 버튼 활성화).

### 5.6 TailwindCSS 기반 동적 테마 커스텀
* **설정 옵션**:
  * Mode: Light / Dark / System
  * Accent Color Palette: Blue (Default), Indigo, Emerald, Violet, Rose, Slate
* **구현 방식**:
  * TailwindCSS CSS 변수 (`--primary`, `--primary-foreground` 등)와 `next-themes`를 활용하여 새로고침 없이 즉시 테마 반영 및 회원 DB 저장.

---

## 6. 개발 단계별 구현 로드맵 (Milestones)

| 단계 | 주요 작업 내용 | 산출물 |
| :---: | :--- | :--- |
| **Phase 1** | • Next.js + MongoDB 프로젝트 세팅<br>• 회원가입/로그인 (NextAuth/JWT)<br>• CommonCode 시드 데이터 및 `.env` 환경 구축 | 기본 인증 및 인프라 |
| **Phase 2** | • 플랫폼 설정 관리 (공급사 가이드 + Textarea 일괄 입력)<br>• Zoho REST API 및 알리고/솔라피 등 메시징 어댑터 추상화 | 플랫폼 Key 매니저 |
| **Phase 3** | • 엑셀/CSV 드래그앤드롭 업로드 파서<br>• 인터랙티브 컬럼 매핑 UI (이름, 다중전화, 다중이메일)<br>• 연락처 Master-Detail 뷰어 및 검색/필터 | 연락처 허브 |
| **Phase 4** | • 캠페인 발송 마법사 (Step 1~4)<br>• 모수 타겟팅 (상위 N, 랜덤 N, 라벨 필터)<br>• 080 번호 및 이메일 수신거부 토큰 자동 부착 및 발송 엔진 | 통합 발송 엔진 |
| **Phase 5** | • 발송 결과 모니터링 & 로그 대시보드<br>• 수신거부 웹훅/엔드포인트 처리<br>• Tailwind 테마 설정 기능 | 최종 검증 및 오픈 |

