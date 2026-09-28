'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';

export const NAV_ITEMS = [
  { href: '/dashboard', label: '대시보드', icon: '◧' },
  { href: '/platform-config', label: '플랫폼 연동', icon: '⚙' },
  { href: '/contacts', label: '연락처', icon: '☰' },
  { href: '/campaigns', label: '캠페인 발송', icon: '✉' },
  { href: '/analytics', label: '발송 통계', icon: '▤' },
  { href: '/settings', label: '환경 설정', icon: '◐' },
] as const;

export function Sidebar(): ReactElement {
  const pathname = usePathname();
  return (
    <nav aria-label="주 메뉴" className="border-b border-border bg-surface md:w-56 md:shrink-0 md:border-b-0 md:border-r">
      <ul className="flex gap-1 overflow-x-auto p-2 md:flex-col md:p-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
                }`}
              >
                <span aria-hidden className="w-4 text-center">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
