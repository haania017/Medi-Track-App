import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bell, BellRing, CalendarClock, Check, ClipboardList, Info, Package, Pill } from 'lucide-react';
import api from '../../lib/api';
import { Popover, MenuLabel } from '../ui/Popover';
import { MemberAvatar, Badge } from '../ui/Misc';
import { Button } from '../ui/Button';
import { EmptyState, Skeleton } from '../ui/Feedback';
import { useToast } from '../../context/ToastProvider';
import { URGENCY_META, cx, fromNow } from '../../lib/format';

const TYPE_ICONS = {
  dose_reminder: Pill,
  missed_dose: AlertTriangle,
  low_stock: Package,
  expiry: CalendarClock,
  care_plan_review: ClipboardList,
  system: Info,
};

export function NotificationBell() {
  const client = useQueryClient();
  const toast = useToast();

  const listQuery = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => api.get('/notifications?limit=8'),
    refetchInterval: 60 * 1000,
  });

  const items = listQuery.data?.data ?? [];
  const unread = listQuery.data?.meta?.unread ?? 0;

  const invalidate = () => {
    client.invalidateQueries({ queryKey: ['notifications'] });
  };

  const readMutation = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: invalidate,
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }) => api.post(`/notifications/${id}/action`, { action }),
    onSuccess: (payload) => {
      invalidate();
      client.invalidateQueries({ queryKey: ['doses'] });
      client.invalidateQueries({ queryKey: ['medicines'] });
      if (payload?.data?.action === 'mark_taken') {
        toast.success(
          payload.data.alreadyProcessed
            ? 'That dose was already recorded as taken.'
            : 'Dose recorded as taken.',
        );
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.post('/notifications/mark-all-read'),
    onSuccess: () => {
      invalidate();
      toast.success('All notifications marked as read.');
    },
  });

  return (
    <Popover
      label="Notifications"
      panelClassName="w-[22rem] p-0"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-muted transition-colors hover:bg-surface-2 hover:text-content"
        >
          {unread ? <BellRing className="h-4 w-4" aria-hidden="true" /> : <Bell className="h-4 w-4" aria-hidden="true" />}
          {unread ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      )}
    >
      {({ close }) => (
        <div className="flex max-h-[28rem] flex-col">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <p className="text-sm font-semibold text-content">Notifications</p>
            {unread ? (
              <button
                type="button"
                onClick={() => markAllMutation.mutate()}
                className="text-xs text-accent transition-opacity hover:opacity-80"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {listQuery.isLoading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="You're all caught up"
                description="Reminders and alerts about your family's medicines appear here."
                className="py-8"
              />
            ) : (
              <ul className="divide-border-y">
                {items.map((note) => {
                  const Icon = TYPE_ICONS[note.type] || Info;
                  const urgency = URGENCY_META[note.urgency] || URGENCY_META.normal;
                  return (
                    <li key={note.id || note._id} className={cx('px-3 py-3', !note.read && 'bg-accent-soft/40')}>
                      <div className="flex gap-2.5">
                        <MemberAvatar name={note.memberName || 'MediTrack'} color={note.memberColor} size={32} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-snug text-content">{note.title}</p>
                            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted">{note.body}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge tone={urgency.tone}>
                              {urgency.label} priority
                            </Badge>
                            <span className="text-[11px] text-subtle">{fromNow(note.createdAt)}</span>
                          </div>

                          {note.actions?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {note.actions.includes('mark_taken') ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 px-2 text-xs"
                                  loading={actionMutation.isPending}
                                  onClick={() => actionMutation.mutate({ id: note.id || note._id, action: 'mark_taken' })}
                                >
                                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                  Mark taken
                                </Button>
                              ) : null}
                              {note.actions.includes('remind_later') ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => actionMutation.mutate({ id: note.id || note._id, action: 'remind_later' })}
                                >
                                  Remind later
                                </Button>
                              ) : null}
                              {!note.read ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => readMutation.mutate(note.id || note._id)}
                                >
                                  Mark read
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-border p-2">
            <Link
              to="/app/notifications"
              onClick={close}
              className="block rounded-lg px-3 py-2 text-center text-sm font-medium text-accent transition-colors hover:bg-surface-2"
            >
              Open notification centre
            </Link>
          </div>
        </div>
      )}
    </Popover>
  );
}

export { MenuLabel };
export default NotificationBell;
