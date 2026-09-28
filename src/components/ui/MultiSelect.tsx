'use client';

import { useEffect, useId, useRef, useState, type ReactElement } from 'react';

interface Props {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}

/** 체크박스 드롭다운 다중 선택 */
export function MultiSelect({ label, options, value, onChange, placeholder = '전체' }: Props): ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const close = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const toggle = (o: string): void => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
  return (
    <div ref={ref} className="relative">
      <span id={id} className="field-label">{label}</span>
      <button
        type="button"
        aria-labelledby={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="input-base flex items-center justify-between text-left"
      >
        <span className="truncate">{value.length ? value.join(', ') : placeholder}</span>
        <span aria-hidden className="ml-2 text-muted-foreground">▾</span>
      </button>
      {open && (
        <div role="listbox" aria-label={label} aria-multiselectable className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-background p-1 shadow-lg">
          {options.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">항목 없음</p>}
          {options.map((o) => (
            <label key={o} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
              <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} className="accent-[hsl(var(--primary))]" />
              <span className="truncate">{o}</span>
            </label>
          ))}
          {value.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="mt-1 w-full rounded px-2 py-1 text-left text-xs text-primary hover:bg-muted">
              선택 해제
            </button>
          )}
        </div>
      )}
    </div>
  );
}
