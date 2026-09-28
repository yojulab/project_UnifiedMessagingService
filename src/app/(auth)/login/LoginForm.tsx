'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState, type FormEvent, type ReactElement } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';

function safeCallback(url: string | null): string {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/dashboard';
}

export function LoginForm(): ReactElement {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (!res || res.error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      return;
    }
    router.replace(safeCallback(params.get('callbackUrl')));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-label="로그인">
      <h2 className="text-lg font-semibold">로그인</h2>
      {params.get('registered') && <Alert tone="success">회원가입이 완료되었습니다. 로그인하세요.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      <TextField label="이메일" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <TextField label="비밀번호" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      <Button type="submit" className="w-full" loading={loading}>
        로그인
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        계정이 없으신가요?{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          회원가입
        </Link>
      </p>
    </form>
  );
}
