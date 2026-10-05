'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import type { ReactElement } from 'react';
import { ThemeToggle } from './ThemeToggle';

export function Header({ name, email }: { name: string; email: string }): ReactElement {
  return (
    <header data-ui-id="COM-SEC-001" className="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3">
      <Link data-ui-id="COM-LNK-001" href="/dashboard" className="flex items-center gap-2 font-bold">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground" aria-hidden>
          U
        </span>
        <span className="hidden sm:inline">{process.env.NEXT_PUBLIC_APP_NAME ?? '통합 메시징 서비스'}</span>
      </Link>
      <div className="flex items-center gap-3">
        <div data-ui-id="COM-SEC-002" className="hidden text-right text-xs leading-tight sm:block">
          <p className="font-medium" data-testid="header-user-name">{name}</p>
          <p className="text-muted-foreground">{email}</p>
        </div>
        <ThemeToggle />
        <button
          type="button"
          data-ui-id="COM-BTN-001"
          onClick={() => void signOut({ callbackUrl: '/login' })}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
