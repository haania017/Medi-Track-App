import { forwardRef, useId } from 'react';
import { AlertCircle } from 'lucide-react';
import { cx } from '../../lib/format';

function FieldShell({ id, label, hint, error, required, children, className }) {
  return (
    <div className={cx('w-full', className)}>
      {label ? (
        <label htmlFor={id} className="label">
          {label}
          {required ? (
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs text-danger">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="hint mt-1.5">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input(
  { label, hint, error, required, className, id, suffix, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id || `input-${autoId}`;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required}>
      <div className="relative">
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={cx('field', suffix && 'pr-11', error && 'border-danger', className)}
          {...rest}
        />
        {suffix ? <div className="absolute inset-y-0 right-0 flex items-center pr-2">{suffix}</div> : null}
      </div>
    </FieldShell>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, hint, error, required, className, id, rows = 3, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id || `textarea-${autoId}`;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cx('field resize-y', error && 'border-danger', className)}
        {...rest}
      />
    </FieldShell>
  );
});

export const Select = forwardRef(function Select(
  { label, hint, error, required, className, id, options = [], children, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id || `select-${autoId}`;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required}>
      <select
        ref={ref}
        id={fieldId}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cx('field appearance-none bg-no-repeat pr-9', error && 'border-danger', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundPosition: 'right 0.6rem center',
          backgroundSize: '1rem',
        }}
        {...rest}
      >
        {children ||
          options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
      </select>
    </FieldShell>
  );
});

export const Checkbox = forwardRef(function Checkbox({ label, hint, className, id, ...rest }, ref) {
  const autoId = useId();
  const fieldId = id || `checkbox-${autoId}`;
  return (
    <div className={cx('flex items-start gap-2.5', className)}>
      <input
        ref={ref}
        id={fieldId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-border-strong text-primary accent-[rgb(var(--c-primary))] focus:ring-2 focus:ring-ring/40"
        {...rest}
      />
      {label ? (
        <div className="min-w-0">
          <label htmlFor={fieldId} className="cursor-pointer text-sm text-content">
            {label}
          </label>
          {hint ? <p className="hint mt-0.5">{hint}</p> : null}
        </div>
      ) : null}
    </div>
  );
});

/** Reusable wrapper for custom controls (toggle rows, segmented pickers). */
export function FieldRow({ label, hint, children, htmlFor, className }) {
  return (
    <div className={cx('flex items-start justify-between gap-4 py-3', className)}>
      <div className="min-w-0">
        {label ? (
          <label htmlFor={htmlFor} className="text-sm font-medium text-content">
            {label}
          </label>
        ) : null}
        {hint ? <p className="hint mt-0.5">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default Input;
