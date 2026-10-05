'use client';

import { useCallback, useState, type ReactElement } from 'react';
import { PlatformConfigForm } from '@/components/platform/PlatformConfigForm';
import type { PlatformConfigView, ProviderCode, TestResult } from '@/components/platform/types';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert, EmptyState, PageHeader, Skeleton } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { api, errMsg } from '@/lib/client/api';
import { useApiData } from '@/lib/client/useApiData';
import { CHANNEL_LABEL, STATUS_LABEL, fmtDate } from '@/lib/client/format';

export default function PlatformConfigPage(): ReactElement {
  const toast = useToast();
  const [mode, setMode] = useState<'list' | 'new' | PlatformConfigView>('list');
  const [busyId, setBusyId] = useState<string | null>(null);
  const loader = useCallback(
    () => Promise.all([api<ProviderCode[]>('/api/common-codes?category=PROVIDER'), api<PlatformConfigView[]>('/api/platform-configs')]),
    [],
  );
  const { data, error, reload } = useApiData(loader);
  const providers = data?.[0] ?? [];
  const configs = data?.[1] ?? null;
  const load = async (): Promise<void> => reload();

  async function test(c: PlatformConfigView): Promise<void> {
    setBusyId(c.id);
    try {
      const r = await api<TestResult>(`/api/platform-configs/${c.id}/test`, { method: 'POST' });
      toast(r.message, r.connected ? 'success' : 'error');
      await load();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: PlatformConfigView): Promise<void> {
    if (!window.confirm(`${c.name} 설정을 삭제하시겠습니까?`)) return;
    try {
      await api(`/api/platform-configs/${c.id}`, { method: 'DELETE' });
      toast('삭제했습니다.', 'success');
      await load();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function makeDefault(c: PlatformConfigView): Promise<void> {
    try {
      await api(`/api/platform-configs/${c.id}`, { method: 'PUT', json: { isDefault: true } });
      await load();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  return (
    <div>
      <PageHeader
        title="플랫폼 연동 설정"
        titleUiId="PLT-TIT-001"
        description="이메일·문자 공급사 API Key 를 등록합니다. 비밀 값은 AES-256-GCM 으로 암호화되어 저장됩니다."
        descUiId="PLT-TXT-001"
        actions={mode === 'list' ? <Button data-ui-id="PLT-BTN-001" onClick={() => setMode('new')}>새 플랫폼 추가</Button> : undefined}
      />
      {error && <Alert tone="error">{error}</Alert>}
      {mode !== 'list' && (
        <div data-ui-id="PLT-SEC-001" className="mb-6">
          <PlatformConfigForm
            key={typeof mode === 'string' ? mode : mode.id}
            providers={providers}
            editing={typeof mode === 'string' ? null : mode}
            onSaved={() => { setMode('list'); void load(); }}
            onCancel={() => setMode('list')}
          />
        </div>
      )}
      {!configs && !error && <Skeleton rows={3} />}
      {configs && configs.length === 0 && mode === 'list' && (
        <EmptyState title="등록된 발송 플랫폼이 없습니다.">‘새 플랫폼 추가’로 Zoho, AWS SES, 알리고, 솔라피 등을 연동하세요.</EmptyState>
      )}
      {configs && configs.length > 0 && (
        <ul data-ui-id="PLT-SEC-002" className="grid gap-4 lg:grid-cols-2" aria-label="등록된 플랫폼">
          {configs.map((c) => (
            <li key={c.id} data-ui-id="PLT-SEC-003" className="card space-y-3" data-testid="platform-card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p data-ui-id="PLT-TXT-002" className="font-semibold">{c.name}</p>
                  <p data-ui-id="PLT-TXT-003" className="text-xs text-muted-foreground">{CHANNEL_LABEL[c.channel]} · {c.providerName}</p>
                </div>
                <div className="flex gap-1">
                  {c.isDefault && <Badge tone="primary">기본</Badge>}
                  <Badge tone={statusTone(c.status)}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
                </div>
              </div>
              <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
                {Object.entries(c.configData).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="font-mono text-muted-foreground">{k}</dt>
                    <dd className="truncate font-mono">{v}</dd>
                  </div>
                ))}
              </dl>
              {c.lastTestMessage && <p className="text-xs text-muted-foreground">최근 테스트({fmtDate(c.lastTestedAt)}): {c.lastTestMessage}</p>}
              <div className="flex flex-wrap gap-2">
                <Button data-ui-id="PLT-BTN-002" size="sm" variant="secondary" loading={busyId === c.id} onClick={() => void test(c)}>연결 테스트</Button>
                <Button data-ui-id="PLT-BTN-003" size="sm" variant="secondary" onClick={() => setMode(c)}>수정</Button>
                {!c.isDefault && <Button data-ui-id="PLT-BTN-004" size="sm" variant="ghost" onClick={() => void makeDefault(c)}>기본으로 지정</Button>}
                <Button data-ui-id="PLT-BTN-005" size="sm" variant="ghost" className="text-danger" onClick={() => void remove(c)}>삭제</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
