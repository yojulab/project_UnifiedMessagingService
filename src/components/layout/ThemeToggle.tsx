'use client';

import { useTheme } from 'next-themes';
import type { ReactElement } from 'react';
import { useIsClient } from '@/lib/client/useApiData';

/** 헤더 라이트/다크 토글 — 변경 즉시 반영 후 DB 저장 */
export function ThemeToggle(): ReactElement {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useIsClient();
  const isDark = mounted && resolvedTheme === 'dark';
  const next = isDark ? 'light' : 'dark';
  return (
    <button
      type="button"
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      title={isDark ? '라이트 모드' : '다크 모드'}
      onClick={() => {
        setTheme(next);
        void fetch('/api/me/theme', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ themeMode: next }) });
      }}
      className="rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-muted"
    >
      <span aria-hidden>{isDark ? '☀' : '☾'}</span>
    </button>
  );
}
