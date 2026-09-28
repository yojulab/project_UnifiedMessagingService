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
