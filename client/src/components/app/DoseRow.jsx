import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlarmClock, Check, Clock, MoreHorizontal, Pill, SkipForward } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastProvider';
import { Button } from '../ui/Button';
import { MemberAvatar, StatusPill } from '../ui/Misc';
import { Popover, MenuItem } from '../ui/Popover';
import { PronounceButton } from './PronounceButton';
import { cx, formatTime, dayjs } from '../../lib/format';

/**
 * One dose line: medicine, who it is for, when, and the actions available.
 * Actions reuse the same idempotent endpoints the notification centre uses.
 */
export function DoseRow({ dose, showProfile = true, onChanged, compact = false }) {
  const client = useQueryClient();
  const toast = useToast();

  const medicine = dose.medicineId || {};
  const profile = dose.profileId || {};
  const due = dayjs(dose.snoozedUntil || dose.scheduledFor);
  const isOverdue = dose.status === 'pending' && due.isBefore(dayjs());
  const canAct = dose.status === 'pending' || dose.status === 'missed';

  const invalidate = () => {
    client.invalidateQueries({ queryKey: ['doses'] });
    client.invalidateQueries({ queryKey: ['medicines'] });
    client.invalidateQueries({ queryKey: ['stock'] });
    client.invalidateQueries({ queryKey: ['reports'] });
    client.invalidateQueries({ queryKey: ['dashboard'] });
    onChanged?.();
  };

  const takenMutation = useMutation({
    mutationFn: () => api.post(`/doses/${dose._id}/mark-taken`, {}),
    onSuccess: (payload) => {
      invalidate();
      if (payload.data.alreadyProcessed) toast.info('That dose was already recorded.');
      else if (payload.data.stockChanged) toast.success('Recorded as taken and stock updated.');
      else toast.success('Recorded as taken.');
    },
    onError: (error) => toast.error(error.message),
  });

  const skippedMutation = useMutation({
    mutationFn: () => api.post(`/doses/${dose._id}/mark-skipped`, {}),
    onSuccess: () => {
      invalidate();
      toast.info('Marked as skipped. Stock was not changed.');
    },
    onError: (error) => toast.error(error.message),
  });

  const snoozeMutation = useMutation({
    mutationFn: (minutes) => api.post(`/doses/${dose._id}/snooze`, { minutes }),
    onSuccess: (_payload, minutes) => {
      invalidate();
      toast.info(`Reminder pushed back by ${minutes} minutes.`);
    },
    onError: (error) => toast.error(error.message),
  });

  const busy = takenMutation.isPending || skippedMutation.isPending || snoozeMutation.isPending;

  return (
    <li className={cx('flex items-start gap-3 px-4 py-3 sm:px-5', compact && 'py-2.5')}>
      {showProfile ? (
        <MemberAvatar name={profile.name} color={profile.color} size={compact ? 28 : 34} />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-subtle">
          <Pill className="h-4 w-4" aria-hidden="true" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            to={`/app/medicines/${medicine._id || dose.medicineId}`}
            className="truncate text-sm font-medium text-content underline-offset-4 hover:underline"
          >
            {medicine.name || 'Medicine'}
            {medicine.strength ? ` ${medicine.strength}${medicine.unit ? ` ${medicine.unit}` : ''}` : ''}
          </Link>
          <PronounceButton text={medicine.name} />
          <StatusPill status={dose.status} />
          {isOverdue ? (
            <span className="text-[11px] font-medium text-danger">Overdue</span>
          ) : null}
        </div>

        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-subtle">
          {showProfile ? <span className="font-medium text-muted">{profile.name}</span> : null}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {formatTime(dose.snoozedUntil || dose.scheduledFor)}
          </span>
          {dose.snoozedUntil ? <span>· snoozed</span> : null}
          {dose.quantity > 1 ? <span>· {dose.quantity} units</span> : null}
          {dose.status === 'taken' && dose.takenAt ? <span>· taken {formatTime(dose.takenAt)}</span> : null}
        </p>
      </div>

      {canAct ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 px-2.5 text-xs"
            loading={takenMutation.isPending && !busy}
            disabled={busy && !takenMutation.isPending}
            onClick={() => takenMutation.mutate()}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Taken</span>
          </Button>

          <Popover
            label="More dose actions"
            panelClassName="w-48"
            trigger={({ toggle, open }) => (
              <button
                type="button"
                onClick={toggle}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="More dose actions"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-subtle transition-colors hover:bg-surface-2 hover:text-content"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          >
            {({ close }) => (
              <>
                <MenuItem
                  icon={AlarmClock}
                  onClick={() => {
                    snoozeMutation.mutate(15);
                    close();
                  }}
                >
                  Remind me in 15 min
                </MenuItem>
                <MenuItem
                  icon={AlarmClock}
                  onClick={() => {
                    snoozeMutation.mutate(60);
                    close();
                  }}
                >
                  Remind me in 1 hour
                </MenuItem>
                <MenuItem
                  icon={SkipForward}
                  onClick={() => {
                    skippedMutation.mutate();
                    close();
                  }}
                >
                  Mark as skipped
                </MenuItem>
              </>
            )}
          </Popover>
        </div>
      ) : (
        <span className="shrink-0 text-xs text-subtle">{formatTime(dose.takenAt || dose.scheduledFor)}</span>
      )}
    </li>
  );
}

export default DoseRow;
