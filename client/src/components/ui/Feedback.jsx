import { AlertTriangle, Loader2, PackageOpen, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from './Button';
import { cx } from '../../lib/format';

export function Spinner({ className, label = 'Loading' }) {
  return (
    <span role="status" aria-label={label} className={cx('inline-flex', className)}>
      <Loader2 className="h-5 w-5 animate-spin text-muted" aria-hidden="true" />
    </span>
  );
}

export function Skeleton({ className }) {
  return <div className={cx('skeleton', className)} aria-hidden="true" />;
}

export function LoadingBlock({ label = 'Loading…', rows = 3, className }) {
  return (
    <div className={cx('space-y-3', className)} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className={cx('h-16 w-full', index === rows - 1 && 'w-3/4')} />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = PackageOpen, title, description, action, className }) {
  return (
    <div className={cx('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-subtle">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-content">{title}</h3>
      {description ? <p className="mt-1.5 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry, className, title = 'Something went wrong' }) {
  const offline = error?.status === 0;
  return (
    <div className={cx('flex flex-col items-center justify-center px-6 py-12 text-center', className)} role="alert">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        {offline ? <WifiOff className="h-6 w-6" aria-hidden="true" /> : <AlertTriangle className="h-6 w-6" aria-hidden="true" />}
      </span>
      <h3 className="mt-4 text-base font-semibold text-content">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted">
        {error?.message || 'An unexpected error occurred.'}
      </p>
      {onRetry ? (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Small inline notice used for the many "this integration is not configured"
 * and "review required" states throughout the product.
 */
export function Notice({ tone = 'info', icon: Icon, title, children, className, action }) {
  const toneClass = {
    info: 'border-info/30 bg-info-soft',
    success: 'border-success/30 bg-success-soft',
    warning: 'border-warning/30 bg-warning-soft',
    danger: 'border-danger/30 bg-danger-soft',
    neutral: 'border-border bg-surface-2',
  }[tone];

  const iconClass = {
    info: 'text-info',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    neutral: 'text-subtle',
  }[tone];

  return (
    <div className={cx('flex items-start gap-3 rounded-xl border p-3.5 text-sm', toneClass, className)}>
      {Icon ? <Icon className={cx('mt-0.5 h-4.5 w-4.5 shrink-0', iconClass)} style={{ width: 18, height: 18 }} aria-hidden="true" /> : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold text-content">{title}</p> : null}
        <div className={cx('text-content/90', title && 'mt-0.5')}>{children}</div>
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}

export default EmptyState;
