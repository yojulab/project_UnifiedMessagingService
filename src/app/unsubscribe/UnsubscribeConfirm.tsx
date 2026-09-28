'use client';

import { useState, type ReactElement } from 'react';
import { Button } from '@/components/ui/Button';

export function UnsubscribeConfirm({ token, maskedEmail }: { token: string; maskedEmail: string }): ReactElement {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  async function confirm(): Promise<void> {
    setState('loading');
    const res = await fetch('/api/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).catch(() => null);
    setState(res?.ok ? 'done' : 'error');
  }
  if (state === 'done') {
    return <p role="status" className="text-sm">수신거부가 완료되었습니다. <strong>{maskedEmail}</strong> 주소로 더 이상 마케팅 이메일이 발송되지 않습니다.</p>;
  }
  return (
    <>
      <p className="text-sm"><strong>{maskedEmail}</strong> 주소의 이메일 수신을 거부하시겠습니까?</p>
      {state === 'error' && <p role="alert" className="text-sm text-danger">처리 중 오류가 발생했습니다. 다시 시도해 주세요.</p>}
      <Button onClick={() => void confirm()} loading={state === 'loading'} className="w-full">수신거부</Button>
    </>
  );
}
