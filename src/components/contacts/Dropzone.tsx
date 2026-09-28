'use client';

import { useRef, useState, type DragEvent, type ReactElement } from 'react';

interface Props {
  accept: string;
  label: string;
  hint?: string;
  onFile: (file: File) => void;
  disabled?: boolean;
}

/** 드래그앤드롭 + 클릭 선택 파일 입력 */
export function Dropzone({ accept, label, hint, onFile, disabled }: Props): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const onDrop = (e: DragEvent): void => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && !disabled) onFile(f);
  };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${over ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}
    >
      <p className="font-medium">{label}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className="mt-4 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">
        파일 선택
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        aria-label={label}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
