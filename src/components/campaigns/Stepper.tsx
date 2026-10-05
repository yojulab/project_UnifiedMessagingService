import type { ReactElement } from 'react';

export function Stepper({ steps, current }: { steps: string[]; current: number }): ReactElement {
  return (
    <ol className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="발송 단계" data-ui-id="CMP-SEC-STEPPER">
      {steps.map((s, i) => {
        const n = i + 1;
        const state = n < current ? 'done' : n === current ? 'current' : 'todo';
        return (
          <li key={s} data-ui-id={`CMP-STP-00${n}`} aria-current={state === 'current' ? 'step' : undefined} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${state === 'current' ? 'border-primary bg-primary/5 font-medium' : 'border-border'} ${state === 'todo' ? 'text-muted-foreground' : ''}`}>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${state === 'todo' ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>{state === 'done' ? '✓' : n}</span>
            <span>Step {n}. {s}</span>
          </li>
        );
      })}
    </ol>
  );
}
