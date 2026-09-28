'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState, type FormEvent, type ReactElement } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { api, errMsg } from '@/lib/client/api';

export default function RegisterPage(): ReactElement {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', company: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    setLoading(true);
    try {
      await api('/api/auth/register', { method: 'POST', json: { name: form.name, company: form.company, email: form.email, password: form.password } });
      const res = await signIn('credentials', { email: form.email, password: form.password, redirect: false });
      if (res?.error) router.replace('/login?registered=1');
      else {
        router.replace('/dashboard');
        router.refresh();
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-label="회원가입">
      <h2 className="text-lg font-semibold">회원가입</h2>
      {error && <Alert tone="error">{error}</Alert>}
      <TextField label="이름" required value={form.name} onChange={set('name')} autoComplete="name" />
      <TextField label="회사명" value={form.company} onChange={set('company')} autoComplete="organization" />
      <TextField label="이메일" type="email" required value={form.email} onChange={set('email')} autoComplete="email" />
      <TextField label="비밀번호" type="password" required minLength={8} value={form.password} onChange={set('password')} hint="8자 이상" autoComplete="new-password" />
      <TextField label="비밀번호 확인" type="password" required value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
      <Button type="submit" className="w-full" loading={loading}>
        가입하기
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          로그인
        </Link>
      </p>
    </form>
  );
}
