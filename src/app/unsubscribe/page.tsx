import type { ReactElement } from 'react';
import { verifyUnsubToken } from '@/lib/unsubscribe/token';
import { UnsubscribeConfirm } from './UnsubscribeConfirm';

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

/** 공개 수신거부 확인 페이지 — GET 으로는 상태를 바꾸지 않는다 */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }): Promise<ReactElement> {
  const { token } = await searchParams;
  const payload = verifyUnsubToken(token);
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="card w-full max-w-md space-y-4 text-center">
        <h1 className="text-xl font-bold">이메일 수신거부</h1>
        {payload && token ? (
          <UnsubscribeConfirm token={token} maskedEmail={maskEmail(payload.email)} />
        ) : (
          <p role="alert" className="text-sm text-danger">유효하지 않거나 만료된 수신거부 링크입니다.</p>
        )}
      </div>
    </main>
  );
}
