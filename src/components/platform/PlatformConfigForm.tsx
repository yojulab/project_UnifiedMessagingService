'use client';

import { useMemo, useState, type ReactElement } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { api, errMsg } from '@/lib/client/api';
import { CHANNEL_LABEL } from '@/lib/client/format';
import { checkAgainstTemplate, parseConfigText } from '@/lib/parsers/configTextParser';
import type { PlatformConfigView, ProviderCode, TestResult } from './types';

interface Props {
  providers: ProviderCode[];
  editing: PlatformConfigView | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function PlatformConfigForm({ providers, editing, onSaved, onCancel }: Props): ReactElement {
  const toast = useToast();
  const [channel, setChannel] = useState(editing?.channel ?? 'EMAIL');
  const [provider, setProvider] = useState(editing?.provider ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [values, setValues] = useState<Record<string, string>>(editing?.configData ?? {});
  const [isDefault, setIsDefault] = useState(editing?.isDefault ?? false);
  const [bulk, setBulk] = useState('');
  const [bulkMsg, setBulkMsg] = useState<{ tone: 'error' | 'warning' | 'success'; text: string } | null>(null);
  const [test, setTest] = useState<TestResult | null>(null);
  const [busy, setBusy] = useState<'test' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const channelProviders = providers.filter((p) => p.channels.includes(channel));
  const current = providers.find((p) => p.code === provider);
  const template = useMemo(() => current?.configTemplate ?? {}, [current]);
  const missing = Object.entries(template).filter(([k, f]) => f.required && !values[k]?.trim()).map(([k]) => k);

  function applyBulk(text: string): void {
    setBulk(text);
    if (!text.trim()) {
      setBulkMsg(null);
      return;
    }
    try {
      const parsed = parseConfigText(text);
      const check = checkAgainstTemplate(parsed, template);
      const known = Object.fromEntries(Object.entries(parsed).filter(([k]) => k in template));
      setValues((v) => ({ ...v, ...known }));
      const parts = [`${Object.keys(known).length}개 항목을 채웠습니다.`];
      if (check.missing.length) parts.push(`누락된 필수 항목: ${check.missing.map((k) => template[k]?.label ?? k).join(', ')}`);
      if (check.unknown.length) parts.push(`알 수 없는 키(무시됨): ${check.unknown.join(', ')}`);
      setBulkMsg({ tone: check.missing.length || check.unknown.length ? 'warning' : 'success', text: parts.join(' · ') });
    } catch (err) {
      setBulkMsg({ tone: 'error', text: errMsg(err) });
    }
  }

  async function runTest(): Promise<void> {
    setBusy('test');
    setError(null);
    try {
      const r = await api<TestResult>('/api/platform-configs/test', { method: 'POST', json: { id: editing?.id, channel, provider, configData: values } });
      setTest(r);
    } catch (err) {
      setTest({ connected: false, message: errMsg(err) });
    } finally {
      setBusy(null);
    }
  }

  async function save(): Promise<void> {
    setBusy('save');
    setError(null);
    try {
      const r = editing
        ? await api<{ test: TestResult | null }>(`/api/platform-configs/${editing.id}`, { method: 'PUT', json: { name, configData: values, isDefault } })
        : await api<{ test: TestResult }>('/api/platform-configs', { method: 'POST', json: { name, channel, provider, configData: values, isDefault } });
      if (r.test && !r.test.connected) toast(`저장했지만 연결 테스트에 실패했습니다: ${r.test.message}`, 'error');
      else toast('플랫폼 설정을 저장했습니다.', 'success');
      onSaved();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card space-y-5" aria-label={editing ? '플랫폼 설정 수정' : '새 플랫폼 추가'}>
      <h2 className="text-lg font-semibold">{editing ? `${editing.providerName} 설정 수정` : '새 플랫폼 추가'}</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="발송 채널" value={channel} disabled={Boolean(editing)} onChange={(e) => { setChannel(e.target.value); setProvider(''); setValues({}); setTest(null); }}>
          {['EMAIL', 'SMS', 'LMS', 'KAKAO'].map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
        </SelectField>
        <SelectField label="공급사" value={provider} disabled={Boolean(editing)} onChange={(e) => { setProvider(e.target.value); setValues({}); setTest(null); setBulk(''); setBulkMsg(null); }} required>
          <option value="">선택하세요</option>
          {channelProviders.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </SelectField>
        <TextField label="표시 이름" value={name} onChange={(e) => setName(e.target.value)} placeholder={current?.name ?? ''} />
      </div>

      {current && (
        <>
          <div className="rounded-md border border-border bg-surface p-4" aria-label="변수 가이드">
            <h3 className="mb-2 text-sm font-semibold">변수 가이드 — {current.name}</h3>
            <table className="table-base">
              <thead><tr><th>키</th><th>항목</th><th>필수</th><th>설명</th></tr></thead>
              <tbody>
                {Object.entries(template).map(([k, f]) => (
                  <tr key={k}>
                    <td className="font-mono text-xs">{k}</td>
                    <td>{f.label}</td>
                    <td>{f.required ? <span className="text-danger">필수</span> : '선택'}</td>
                    <td className="text-xs text-muted-foreground">{f.help ?? (f.default ? `기본값 ${f.default}` : '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {current.code === 'ZOHO' && (
            <Alert tone="warning">Zoho Mail API 는 List-Unsubscribe 헤더를 붙일 수 없어 원클릭 수신거부 버튼이 표시되지 않습니다 (본문 링크는 삽입됨). 대량 광고 메일은 AWS SES 를 권장합니다.</Alert>
          )}
          <TextAreaField
            label="일괄 입력 (JSON 또는 KEY=VALUE)"
            rows={5}
            className="font-mono text-xs"
            placeholder={'{"apiKey": "...", "userId": "..."}\n또는\nAPI_KEY=xxx\nUSER_ID=yyy'}
            value={bulk}
            onChange={(e) => applyBulk(e.target.value)}
            hint="붙여넣으면 자동으로 파싱되어 아래 항목이 채워집니다."
          />
          {bulkMsg && <Alert tone={bulkMsg.tone}>{bulkMsg.text}</Alert>}

          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(template).map(([k, f]) => (
              <TextField
                key={k}
                label={f.label}
                required={f.required}
                type={f.secret ? 'password' : 'text'}
                autoComplete="off"
                value={values[k] ?? ''}
                placeholder={f.default ?? ''}
                error={missing.includes(k) && (bulk || values[k] !== undefined) ? '필수 항목입니다.' : null}
                onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                hint={f.help}
              />
            ))}
          </div>

          <Checkbox label="이 채널의 기본 플랫폼으로 사용" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />

          {test && <Alert tone={test.connected ? 'success' : 'error'}>{test.connected ? '✓ ' : '✗ '}{test.message}</Alert>}
          {error && <Alert tone="error">{error}</Alert>}

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void runTest()} loading={busy === 'test'} disabled={missing.length > 0}>
              연결 테스트
            </Button>
            <Button onClick={() => void save()} loading={busy === 'save'} disabled={missing.length > 0}>
              저장
            </Button>
            <Button variant="ghost" onClick={onCancel}>취소</Button>
          </div>
        </>
      )}
    </section>
  );
}
