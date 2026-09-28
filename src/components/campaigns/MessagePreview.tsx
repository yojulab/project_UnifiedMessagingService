import type { ReactElement } from 'react';
import { smsByteLength } from '@/lib/dispatch/template';

export interface Sample {
  recipient: string;
  contactName: string;
  subject?: string;
  body: string;
  html?: string;
  headers?: Record<string, string>;
}

export function MessagePreview({ sample, channel }: { sample: Sample; channel: string }): ReactElement {
  return (
    <div className="space-y-2" aria-label="샘플 미리보기" data-testid="message-preview">
      <p className="text-xs text-muted-foreground">To: <span className="font-mono">{sample.recipient}</span> ({sample.contactName})</p>
      {channel === 'EMAIL' ? (
        <>
          <p className="text-sm"><span className="text-muted-foreground">제목:</span> <strong>{sample.subject}</strong></p>
          <iframe title="이메일 미리보기" sandbox="" srcDoc={sample.html ?? ''} className="h-72 w-full rounded border border-border bg-white" />
          {sample.headers && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">메일 헤더</summary>
              <ul className="mt-1 space-y-0.5 font-mono">
                {Object.entries(sample.headers).map(([k, v]) => <li key={k} className="break-all">{k}: {v}</li>)}
              </ul>
            </details>
          )}
        </>
      ) : (
        <div className="max-w-sm rounded-2xl border border-border bg-muted p-4">
          <p className="whitespace-pre-wrap text-sm" data-testid="sms-preview-body">{sample.body}</p>
          <p className="mt-2 text-right text-xs text-muted-foreground">{smsByteLength(sample.body)} byte</p>
        </div>
      )}
    </div>
  );
}
