import { cx } from '../../lib/format';

export function Card({ children, className, as: Component = 'div', ...rest }) {
  return (
    <Component className={cx('card', className)} {...rest}>
      {children}
    </Component>
  );
}

export function CardHeader({ title, description, action, icon: Icon, className, children }) {
  return (
    <div className={cx('flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} aria-hidden="true" />
          </span>
        ) : null}
        <div className="min-w-0">
          {title ? <h3 className="text-base font-semibold text-content">{title}</h3> : null}
          {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
          {children}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ children, className, ...rest }) {
  return (
    <div className={cx('px-5 py-4 sm:px-6 sm:py-5', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className }) {
  return (
    <div className={cx('flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4 sm:px-6', className)}>
      {children}
    </div>
  );
}

/** Compact metric tile used on the dashboard and reports. */
export function StatCard({ label, value, hint, icon: Icon, tone = 'default', className }) {
  const toneClass = {
    default: 'text-content',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    info: 'text-info',
  }[tone];

  return (
    <div className={cx('card p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</p>
        {Icon ? <Icon className="h-4 w-4 text-subtle" aria-hidden="true" /> : null}
      </div>
      <p className={cx('mt-2 text-2xl font-semibold tabular-nums', toneClass)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function SectionTitle({ title, description, action, className }) {
  return (
    <div className={cx('mb-4 flex flex-wrap items-end justify-between gap-3', className)}>
      <div>
        <h2 className="text-lg font-semibold text-content">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export default Card;
