import { redirect } from 'next/navigation';
import type { ReactElement, ReactNode } from 'react';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { getSessionUser } from '@/lib/auth';

export default async function DashboardLayout({ children }: { children: ReactNode }): Promise<ReactElement> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return (
    <div className="flex min-h-screen flex-col">
      <Header name={user.name} email={user.email} />
      <div className="flex flex-1 flex-col md:flex-row">
        <Sidebar />
        <main className="min-w-0 flex-1 bg-surface p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
