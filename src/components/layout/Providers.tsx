'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider, useTheme } from 'next-themes';
import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/Toast';
import type { ThemeMode } from '@/types';

/** DB 에 저장된 모드를 로그인 직후 1회 반영 (다른 기기에서 바꾼 설정 동기화) */
function ThemeSync({ serverMode }: { serverMode: ThemeMode | null }): null {
  const { setTheme } = useTheme();
  const applied = useRef(false);
  useEffect(() => {
    if (serverMode && !applied.current) {
      applied.current = true;
      setTheme(serverMode);
    }
  }, [serverMode, setTheme]);
  return null;
}

export function Providers({ children, serverMode }: { children: ReactNode; serverMode: ThemeMode | null }): ReactElement {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme={serverMode ?? 'system'} enableSystem disableTransitionOnChange>
        <ThemeSync serverMode={serverMode} />
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
