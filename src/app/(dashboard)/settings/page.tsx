'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { Button } from '@/components/ui/Button';
import { Radio, TextField } from '@/components/ui/Field';
import { Alert, PageHeader, Skeleton } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { api, errMsg } from '@/lib/client/api';
import { ACCENT_COLORS, THEME_MODES, type AccentColor, type ThemeMode } from '@/types';

interface Me { email: string; name: string; company: string; defaultSenderPhone: string; defaultSenderEmail: string; themeMode: ThemeMode; accentColor: AccentColor }

const MODE_LABEL: Record<ThemeMode, string> = { light: '라이트', dark: '다크', system: '시스템' };
const ACCENT_LABEL: Record<AccentColor, string> = { blue: 'Blue', indigo: 'Indigo', emerald: 'Emerald', violet: 'Violet', rose: 'Rose', slate: 'Slate' };
const SWATCH: Record<AccentColor, string> = { blue: 'bg-[#2563eb]', indigo: 'bg-[#4f46e5]', emerald: 'bg-[#059669]', violet: 'bg-[#7c3aed]', rose: 'bg-[#e11d48]', slate: 'bg-[#334155]' };

export default function SettingsPage(): ReactElement {
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const [me, setMe] = useState<Me | null>(null);
  const [accent, setAccent] = useState<AccentColor>('blue');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [saving, setSaving] = useState<'profile' | 'pw' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Me>('/api/me').then((m) => { setMe(m); setAccent(m.accentColor); }).catch((e: unknown) => setError(errMsg(e)));
  }, []);

  function applyMode(mode: ThemeMode): void {
    setTheme(mode);
    void api('/api/me/theme', { method: 'PATCH', json: { themeMode: mode } }).catch((e: unknown) => toast(errMsg(e), 'error'));
  }

  function applyAccent(a: AccentColor): void {
    setAccent(a);
    document.documentElement.setAttribute('data-accent', a);
    void api('/api/me/theme', { method: 'PATCH', json: { accentColor: a } }).catch((e: unknown) => toast(errMsg(e), 'error'));
  }

  async function saveProfile(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!me) return;
    setSaving('profile');
    try {
      const m = await api<Me>('/api/me', { method: 'PATCH', json: { name: me.name, company: me.company, defaultSenderPhone: me.defaultSenderPhone, defaultSenderEmail: me.defaultSenderEmail } });
      setMe(m);
      toast('프로필을 저장했습니다.', 'success');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSaving(null);
    }
  }

  async function changePw(e: FormEvent): Promise<void> {
    e.preventDefault();
    setSaving('pw');
    try {
      await api('/api/me/password', { method: 'POST', json: pw });
      setPw({ currentPassword: '', newPassword: '' });
      toast('비밀번호를 변경했습니다.', 'success');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSaving(null);
    }
  }

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!me) return <Skeleton rows={6} />;

  return (
    <div className="space-y-6">
      <PageHeader title="환경 설정" />
      <section className="card space-y-4" aria-label="테마">
        <h2 className="font-semibold">테마</h2>
        <fieldset>
          <legend className="field-label">모드</legend>
          <div className="flex flex-wrap gap-4">
            {THEME_MODES.map((m) => <Radio key={m} name="mode" label={MODE_LABEL[m]} checked={theme === m} onChange={() => applyMode(m)} />)}
          </div>
        </fieldset>
        <fieldset>
          <legend className="field-label">강조 색상 (Accent)</legend>
          <div className="flex flex-wrap gap-3">
            {ACCENT_COLORS.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={accent === a}
                aria-label={`강조 색상 ${ACCENT_LABEL[a]}`}
                onClick={() => applyAccent(a)}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${accent === a ? 'border-primary ring-2 ring-primary/40' : 'border-border'}`}
              >
                <span className={`h-4 w-4 rounded-full ${SWATCH[a]}`} aria-hidden />
                {ACCENT_LABEL[a]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center gap-2">
          <Button size="sm">미리보기 버튼</Button>
          <span className="text-sm text-primary">강조 색상 텍스트</span>
        </div>
      </section>

      <form className="card space-y-4" onSubmit={(e) => void saveProfile(e)} aria-label="기본 발신자 프로필">
        <h2 className="font-semibold">기본 발신자 프로필</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="이메일 (로그인)" value={me.email} disabled />
          <TextField label="이름" required value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} />
          <TextField label="회사명" value={me.company} onChange={(e) => setMe({ ...me, company: e.target.value })} />
          <TextField label="기본 발신 번호" value={me.defaultSenderPhone} onChange={(e) => setMe({ ...me, defaultSenderPhone: e.target.value })} placeholder="010-0000-0000" />
          <TextField label="기본 발신 이메일" type="email" value={me.defaultSenderEmail} onChange={(e) => setMe({ ...me, defaultSenderEmail: e.target.value })} />
        </div>
        <Button type="submit" loading={saving === 'profile'}>프로필 저장</Button>
      </form>

      <form className="card space-y-4" onSubmit={(e) => void changePw(e)} aria-label="비밀번호 변경">
        <h2 className="font-semibold">비밀번호 변경</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="현재 비밀번호" type="password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" />
          <TextField label="새 비밀번호" type="password" required minLength={8} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" />
        </div>
        <Button type="submit" variant="secondary" loading={saving === 'pw'}>비밀번호 변경</Button>
      </form>
    </div>
  );
}
