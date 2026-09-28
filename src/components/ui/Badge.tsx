import type { ReactElement, ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'primary';

const TONES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-success/15 text-success',
  danger: 'bg-danger/15 text-danger',
  warning: 'bg-warning/15 text-warning',
  primary: 'bg-primary/15 text-primary',
};

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }): ReactElement {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}>{children}</span>;
}

export function statusTone(status: string): Tone {
  if (['COMPLETED', 'SUCCESS', 'ACTIVE'].includes(status)) return 'success';
  if (['FAILED', 'ERROR', 'BOUNCED'].includes(status)) return 'danger';
  if (['PARTIAL', 'PENDING', 'SKIPPED'].includes(status)) return 'warning';
  if (status === 'SENDING') return 'primary';
  return 'neutral';
}
