import type { ReactElement, ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold text-primary">Unified Messaging</p>
          <h1 className="mt-1 text-2xl font-bold">{process.env.NEXT_PUBLIC_APP_NAME ?? '통합 메시징 서비스'}</h1>
        </div>
        <div className="card">{children}</div>
      </div>
    </main>
  );
}
