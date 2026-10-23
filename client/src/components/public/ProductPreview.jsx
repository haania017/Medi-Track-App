import { AlertTriangle, CalendarClock, Check, Clock3, HeartPulse, Package, Pill } from 'lucide-react';
import { MemberAvatar } from '../ui/Misc';
import { cx } from '../../lib/format';

/**
 * A static illustration of the MediTrack dashboard, drawn with the same design
 * tokens as the real app. It uses example content only — no invented metrics or
 * customer claims.
 */
export function ProductPreview({ className }) {
  return (
    <div
      className={cx(
        'overflow-hidden rounded-2xl border border-border bg-surface shadow-pop',
        className,
      )}
      role="img"
      aria-label="Preview of the MediTrack dashboard showing today's doses, stock and expiry alerts"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        </span>
        <div className="ml-2 flex items-center gap-1.5 text-xs text-subtle">
          <HeartPulse className="h-3.5 w-3.5" aria-hidden="true" />
          meditrack / dashboard
        </div>
      </div>

      <div className="space-y-3 p-4">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'Taken', value: '3', icon: Check, tone: 'text-success' },
            { label: 'Due next', value: '2', icon: Clock3, tone: 'text-info' },
            { label: 'Missed', value: '0', icon: AlertTriangle, tone: 'text-muted' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-surface-2 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-subtle">{stat.label}</p>
                <stat.icon className={cx('h-3.5 w-3.5', stat.tone)} aria-hidden="true" />
              </div>
              <p className={cx('mt-1.5 text-xl font-semibold tabular-nums', stat.tone)}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Today's doses */}
        <div className="rounded-xl border border-border">
          <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
            <Pill className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
            <p className="text-xs font-semibold text-content">Today's doses</p>
          </div>
          <ul className="divide-border-y">
            {[
              { name: 'Metformin 500 mg', time: '08:00', person: 'You', color: '#111827', status: 'taken' },
              { name: 'Amoxicillin 250 mg', time: '15:00', person: 'Ayesha', color: '#059669', status: 'due' },
              { name: 'Atorvastatin 10 mg', time: '22:00', person: 'You', color: '#111827', status: 'later' },
            ].map((dose) => (
              <li key={dose.name} className="flex items-center gap-3 px-3.5 py-2.5">
                <MemberAvatar name={dose.person} color={dose.color} size={26} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-content">{dose.name}</p>
                  <p className="text-[11px] text-subtle">
                    {dose.person} · {dose.time}
                  </p>
                </div>
                <span
                  className={cx(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    dose.status === 'taken' && 'bg-success-soft text-success',
                    dose.status === 'due' && 'bg-info-soft text-info',
                    dose.status === 'later' && 'bg-surface-2 text-subtle',
                  )}
                >
                  {dose.status === 'taken' ? 'Taken' : dose.status === 'due' ? 'Due now' : 'Later'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Alerts */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-2">
              <Package className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
              <p className="text-[11px] font-semibold text-content">Low stock</p>
            </div>
            <p className="mt-1 text-[11px] text-subtle">Atorvastatin · 8 tablets left</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full w-1/4 rounded-full bg-warning" />
            </div>
          </div>
          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
              <p className="text-[11px] font-semibold text-content">Expiring soon</p>
            </div>
            <p className="mt-1 text-[11px] text-subtle">Amoxicillin · 11 days left</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full w-2/5 rounded-full bg-danger" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductPreview;
