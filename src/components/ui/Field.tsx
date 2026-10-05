import { useId, type InputHTMLAttributes, type Ref, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface FieldWrapProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: (id: string) => ReactNode;
  className?: string;
}

function FieldWrap({ label, hint, error, required, children, className = '' }: FieldWrapProps): ReactElement {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
      </label>
      {children(id)}
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}

type Common = { label: string; hint?: ReactNode; error?: string | null; wrapClassName?: string };

export function TextField({ label, hint, error, wrapClassName, className = '', required, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>): ReactElement {
  return (
    <FieldWrap label={label} hint={hint} error={error} required={required} className={wrapClassName}>
      {(id) => <input id={id} required={required} aria-invalid={Boolean(error) || undefined} className={`input-base ${className}`} {...rest} />}
    </FieldWrap>
  );
}

export function TextAreaField({ label, hint, error, wrapClassName, className = '', required, ref, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }): ReactElement {
  return (
    <FieldWrap label={label} hint={hint} error={error} required={required} className={wrapClassName}>
      {(id) => <textarea ref={ref} id={id} required={required} aria-invalid={Boolean(error) || undefined} className={`input-base ${className}`} {...rest} />}
    </FieldWrap>
  );
}

export function SelectField({ label, hint, error, wrapClassName, className = '', required, children, ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement>): ReactElement {
  return (
    <FieldWrap label={label} hint={hint} error={error} required={required} className={wrapClassName}>
      {(id) => (
        <select id={id} required={required} className={`input-base ${className}`} {...rest}>
          {children}
        </select>
      )}
    </FieldWrap>
  );
}

export function Checkbox({ label, className = '', 'data-ui-id': uiId, ...rest }: { label: ReactNode; 'data-ui-id'?: string } & InputHTMLAttributes<HTMLInputElement>): ReactElement {
  return (
    <label data-ui-id={uiId} className={`inline-flex cursor-pointer items-center gap-2 text-sm ${className}`}>
      <input type="checkbox" className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]" {...rest} />
      <span>{label}</span>
    </label>
  );
}

export function Radio({ label, className = '', 'data-ui-id': uiId, ...rest }: { label: ReactNode; 'data-ui-id'?: string } & InputHTMLAttributes<HTMLInputElement>): ReactElement {
  return (
    <label data-ui-id={uiId} className={`inline-flex cursor-pointer items-center gap-2 text-sm ${className}`}>
      <input type="radio" className="h-4 w-4 accent-[hsl(var(--primary))]" {...rest} />
      <span>{label}</span>
    </label>
  );
}
