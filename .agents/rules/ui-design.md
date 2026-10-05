# UI & TailwindCSS 디자인 규칙

## 테마 시스템

이 프로젝트는 `next-themes` + TailwindCSS CSS 변수 기반의 **동적 테마 커스텀**을 지원한다.

### 지원 모드
- Light / Dark / System (OS 연동)

### Accent Color Palette
- Blue (Default), Indigo, Emerald, Violet, Rose, Slate
- 선택된 팔레트는 `Users.themePreference`에 저장되고, CSS 변수(`--primary`, `--primary-foreground` 등)로 런타임 적용된다.

## TailwindCSS 규칙

- TailwindCSS **v3** 기준으로 구현한다.
- `globals.css`에 CSS 변수 기반 컬러 토큰을 정의하고, `tailwind.config.ts`에서 `theme.extend.colors`로 참조한다.
- **인라인 스타일 금지**: 모든 스타일링은 Tailwind 유틸리티 클래스로 처리한다.
- 반복되는 컴포넌트 스타일은 `@apply` 디렉티브로 추상화한다.
- 반응형 디자인: `sm → md → lg → xl` 브레이크포인트를 일관되게 사용한다.

## 레이아웃 구조

```
┌──────────────────────────────────────────────┐
│  Header (로고, 사용자 프로필, 테마 토글)       │
├──────────┬───────────────────────────────────┤
│ Sidebar  │  Main Content Area               │
│ (Nav)    │  (page.tsx 렌더링 영역)            │
│          │                                   │
│ • 대시보드 │                                   │
│ • 플랫폼  │                                   │
│ • 연락처  │                                   │
│ • 캠페인  │                                   │
│ • 통계    │                                   │
│ • 설정    │                                   │
└──────────┴───────────────────────────────────┘
```

## UI 컴포넌트 규칙

- 기본 원자 컴포넌트(Button, Input, Select, Modal, Badge, Table 등)는 `src/components/ui/`에 정의한다.
- 도메인 전용 컴포넌트는 `src/components/{domain}/`에 위치한다.
- Master-Detail 뷰 (연락처 등)는 좌측 리스트 + 우측 상세 패널 구조를 사용한다.
- 캠페인 발송 마법사는 **Step 1~4 Stepper UI**로 구현한다.

## 접근성 & UX

- 모든 인터랙티브 요소에 `aria-label` 또는 시맨틱 HTML 태그를 사용한다.
- 로딩 상태에 Skeleton UI 또는 Spinner를 표시한다.
- 에러 상태에 토스트 또는 인라인 에러 메시지를 표시한다.
- 파일 업로드는 **Drag & Drop** + 클릭 선택 모두 지원한다.

## 의뢰자 소통용 UI 식별 태그 (`data-ui-id`)

의뢰자/이해관계자와의 원활한 피드백 소통 및 E2E 테스트 신뢰성 확보를 위해, **모든 중요 HTML 태그에 고유 식별자(`data-ui-id`)를 의무적으로 부여**한다.

### 1. 채번 체계 (Unique ID Scheme)
- 형식: `[도메인]-[TYPE]-[일련번호 3자리]` (프로젝트 전체에서 유니크해야 함)
- **도메인(DOMAIN)**:
  - `COM`: 공통 레이아웃 (Header, Sidebar, ThemeToggle, Footer 등)
  - `AUTH`: 인증 (로그인, 회원가입 등)
  - `PLT`: 플랫폼 연동 설정
  - `CNT`: 연락처 관리 허브 (업로드, 매핑, 조회 등)
  - `CMP`: 캠페인 발송 마법사 (Step 1~4)
  - `ALT`: 발송 결과 분석 / 통계
  - `SET`: 환경 설정 / 수신거부 관리
- **요소 유형(TYPE)**:
  - `TIT`: 페이지 대제목(`h1`), 섹션 소제목(`h2`, `h3`)
  - `TXT`: 본문 주요 설명 텍스트, 안내 문구, 폼 범례/라벨(`legend`, `p`, `span`)
  - `SEC`: 주요 구역, 카드 컨테이너, 섹션
  - `BTN`: 버튼 (발송, 업로드, 저장, 취소, 옵션 선택 등)
  - `INP`: 입력 필드 (텍스트박스, 텍스트에어리어 등)
  - `SEL`: 드롭다운 셀렉트 박스
  - `TBL`: 데이터 테이블
  - `MOD`: 팝업 모달, 다이얼로그
  - `LNK`: 주요 네비게이션 링크, 탭

### 2. 중요 태그 부여 기준
- **필수 부여**:
  - **본문 텍스트 및 제목**: 페이지 대제목(`<h1 data-ui-id="...-TIT-...">`), 섹션 소제목(`<h2>`, `<h3>`), 주요 안내/설명 문구(`TXT`) — 의뢰자의 문구 수정 요청 대응
  - **인터랙션 요소**: 모든 버튼(`<button>`, `<Link role="button">`), 라디오/체크박스 옵션
  - **입력 양식**: 모든 폼 입력 필드(`<input>`, `<select>`, `<textarea>`)
  - **컨테이너**: 핵심 컨텐츠 카드 및 섹션 컨테이너(`<div data-ui-id="...-SEC-...">`)
  - **데이터/팝업**: 주요 테이블 및 모달 창
- **부여 제외**:
  - 단순 장식용 SVG 아이콘, 시각 보조용 구분선(`<hr>`) 등 피드백 대상이 아닌 순수 스타일링 말단 태그만 제외.

### 3. 운영 환경 비노출 원칙
- `data-ui-id`는 HTML 표준 데이터 속성이므로 일반 화면 렌더링에 영향을 주지 않는다.
- 화면에 번호 뱃지를 띄우는 `UiInspectorOverlay`는 **개발 환경 또는 `NEXT_PUBLIC_ENABLE_INSPECTOR=true`에서만 동작**하며, 프로덕션 빌드에서는 컴포넌트 자체가 `null`을 반환하여 완전히 격리·은폐된다.
- 화면 검토 토글:
  - 버튼: 화면 우하단 `[🏷️ UI 태그 숨김 / 보기]` 플로팅 버튼
  - **macOS 단축키**: `Option + U` (`⌥U`) 또는 `Cmd + Shift + U` (`⌘⇧U`)
  - **Windows / Linux 단축키**: `Alt + U` 또는 `Ctrl + Shift + U`
  - **ID 복사**: 화면 위 번호 뱃지 직접 클릭 또는 `Option / Cmd + 요소 클릭` (Windows는 `Alt + 요소 클릭`)


