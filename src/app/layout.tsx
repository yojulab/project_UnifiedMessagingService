import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import { Providers } from '@/components/layout/Providers';
import { getSessionUser } from '@/lib/auth';
import { getThemePref } from '@/lib/theme';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? '통합 메시징 서비스',
  description: '이메일 · SMS/LMS · 카카오 알림톡 통합 발송 및 수신거부 관리',
};

export default async function RootLayout({ children }: { children: ReactNode }): Promise<ReactElement> {
  const [user, pref] = await Promise.all([getSessionUser(), getThemePref()]);
  return (
    <html lang="ko" data-accent={pref.accentColor} suppressHydrationWarning>
      <body className="min-h-screen">
        <Providers serverMode={user ? pref.themeMode : null}>{children}</Providers>
      </body>
    </html>
  );
}
