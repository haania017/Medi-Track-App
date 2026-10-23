import { cx, contrastText, initials } from '../../lib/format';

const TONES = {
  default: 'border-border bg-surface-2 text-muted',
  primary: 'border-transparent bg-primary/10 text-primary',
  accent: 'border-transparent bg-accent-soft text-accent',
  success: 'border-transparent bg-success-soft text-success',
  warning: 'border-transparent bg-warning-soft text-warning',
  danger: 'border-transparent bg-danger-soft text-danger',
  info: 'border-transparent bg-info-soft text-info',
  muted: 'border-border bg-surface-2 text-subtle',
};

export function Badge({ children, tone = 'default', className, icon: Icon, ...rest }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        TONES[tone] || TONES.default,
        className,
      )}
      {...rest}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/**
 * Status pill that always pairs colour with a text label, so status is never
 * communicated by colour alone (WCAG 1.4.1).
 */
export function StatusPill({ status, label, tone, className }) {
  const meta = STATUS_META[status] || { label: status, tone: 'default' };
  return (
    <Badge tone={tone || meta.tone} className={className}>
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-current opacity-80"
      />
      {label || meta.label}
    </Badge>
  );
}

export const STATUS_META = {
  taken: { label: 'Taken', tone: 'success' },
  pending: { label: 'Pending', tone: 'info' },
  skipped: { label: 'Skipped', tone: 'muted' },
  missed: { label: 'Missed', tone: 'danger' },
  active: { label: 'Active', tone: 'success' },
  paused: { label: 'Paused', tone: 'warning' },
  finished: { label: 'Finished', tone: 'info' },
  archived: { label: 'Archived', tone: 'muted' },
  awaiting_review: { label: 'Awaiting review', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
  invited: { label: 'Invited', tone: 'info' },
  revoked: { label: 'Access revoked', tone: 'danger' },
  uploaded: { label: 'Uploaded', tone: 'info' },
  processing: { label: 'Processing', tone: 'info' },
  extracted: { label: 'Needs review', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  deleted: { label: 'Deleted', tone: 'muted' },
  draft: { label: 'Draft', tone: 'info' },
};

export function ProgressBar({ value = 0, max = 100, tone = 'accent', label, className }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const barTone = {
    accent: 'bg-accent',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
  }[tone];

  return (
    <div className={className}>
      {label ? <p className="mb-1.5 text-xs text-muted">{label}</p> : null}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
      >
        <div className={cx('h-full rounded-full transition-all duration-500', barTone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Circular avatar used for family members, tinted with their identity colour. */
export function MemberAvatar({ name = '', color = '#111827', size = 36, className, ring = false }) {
  const dimension = typeof size === 'number' ? `${size}px` : size;
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        ring && 'ring-2 ring-surface',
        className,
      )}
      style={{
        width: dimension,
        height: dimension,
        backgroundColor: color,
        color: contrastText(color),
        fontSize: `calc(${dimension} * 0.4)`,
      }}
      aria-hidden="true"
    >
      {initials(name) || '?'}
    </span>
  );
}

export function Tabs({ tabs, value, onChange, className, size = 'md' }) {
  return (
    <div
      role="tablist"
      aria-label="Sections"
      className={cx(
        'flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface-2 p-1',
        className,
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            className={cx(
              'inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors',
              size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
              selected
                ? 'bg-surface text-content shadow-sm'
                : 'text-muted hover:text-content',
            )}
          >
            {tab.icon ? <tab.icon className="h-4 w-4" aria-hidden="true" /> : null}
            {tab.label}
            {tab.count !== undefined ? (
              <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] tabular-nums text-subtle">
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label, id, disabled = false }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-border-strong',
      )}
    >
      <span
        className={cx(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

export function DefinitionList({ items, className }) {
  return (
    <dl className={cx('grid gap-x-6 gap-y-4 sm:grid-cols-2', className)}>
      {items.filter(Boolean).map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-subtle">{item.label}</dt>
          <dd className="mt-1 text-sm text-content">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export default Badge;
