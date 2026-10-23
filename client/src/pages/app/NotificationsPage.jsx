import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  CalendarClock,
  Check,
  ClipboardList,
  Clock,
  Info,
  Package,
  Pill,
  Trash2,
} from 'lucide-react';
import api, { qs } from '../../lib/api';
import { PageHeader } from '../../components/app/PageHeader';
import { Card, CardHeader, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, MemberAvatar, Tabs } from '../../components/ui/Misc';
import { EmptyState, ErrorState, LoadingBlock, Notice } from '../../components/ui/Feedback';
import { useToast } from '../../context/ToastProvider';
import { NOTIFICATION_TYPE_META, URGENCY_META, cx, fromNow } from '../../lib/format';

const TYPE_ICONS = {
  dose_reminder: Pill,
  missed_dose: AlertTriangle,
  low_stock: Package,
  expiry: CalendarClock,
  care_plan_review: ClipboardList,
  system: Info,
};

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'dose_reminder,missed_dose', label: 'Doses' },
  { value: 'low_stock,expiry', label: 'Stock & expiry' },
  { value: 'care_plan_review', label: 'Care plans' },
];

export function NotificationsPage() {
  const client = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState('all');

  const listQuery = useQuery({
    queryKey: ['notifications', 'page', tab],
    queryFn: () =>
      api.get(
        `/notifications${qs({
          limit: 50,
          unreadOnly: tab === 'unread' ? 'true' : undefined,
          type: tab === 'all' || tab === 'unread' ? undefined : tab,
        })}`,
      ),
  });

  const invalidate = () => {
    client.invalidateQueries({ queryKey: ['notifications'] });
    client.invalidateQueries({ queryKey: ['doses'] });
    client.invalidateQueries({ queryKey: ['medicines'] });
  };

  const readMutation = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: invalidate,
  });

  const readAllMutation = useMutation({
    mutationFn: () => api.post('/notifications/mark-all-read'),
    onSuccess: () => {
      invalidate();
      toast.success('All notifications marked as read.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/notifications/${id}`),
    onSuccess: invalidate,
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }) => api.post(`/notifications/${id}/action`, { action }),
    onSuccess: (payload) => {
      invalidate();
      if (payload.data.action === 'mark_taken') {
        toast.success(payload.data.alreadyProcessed ? 'Already recorded as taken.' : 'Dose recorded as taken.');
      } else if (payload.data.action === 'remind_later') {
        toast.info('Reminder pushed back by 15 minutes.');
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const notifications = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta ?? {};
  const unread = meta.unread ?? 0;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Reminders and alerts, with who each one is about. Actions here use the same safe endpoints as the rest of the app."
        actions={
          <>
            <Button variant="secondary" onClick={() => readAllMutation.mutate()} disabled={!unread}>
              <Check className="h-4 w-4" aria-hidden="true" />
              Mark all read
            </Button>
            <Button variant="ghost" onClick={() => listQuery.refetch()}>
              Refresh
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Unread" value={unread} tone={unread ? 'info' : 'default'} icon={unread ? BellRing : BellOff} />
        <StatCard label="Total shown" value={notifications.length} icon={Bell} />
        <StatCard
          label="External push"
          value={meta.pushConfigured ? 'Configured' : 'Not configured'}
          hint={meta.pushConfigured ? 'Device notifications are active' : 'In-app notifications still work fully'}
          tone={meta.pushConfigured ? 'success' : 'default'}
        />
      </div>

      {!meta.pushConfigured ? (
        <Notice tone="neutral" icon={Bell} className="mt-6" title="In-app notifications only">
          This server has no Web Push keys configured, so alerts appear here inside MediTrack. Every action on
          them — including marking a dose taken — works exactly the same. See the README to enable push.
        </Notice>
      ) : null}

      <Card className="mt-6">
        <CardHeader icon={Bell} title="Notification centre" description="Filter by what you want to see." />
        <div className="px-5 py-3 sm:px-6">
          <Tabs tabs={TABS} value={tab} onChange={setTab} size="sm" />
        </div>

        {listQuery.isLoading ? (
          <div className="p-5">
            <LoadingBlock rows={3} />
          </div>
        ) : listQuery.isError ? (
          <ErrorState error={listQuery.error} onRetry={listQuery.refetch} />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Nothing here"
            description="Dose reminders, missed doses, low stock, expiring medicines and care-plan reviews all appear here."
          />
        ) : (
          <ul className="divide-border-y">
            {notifications.map((note) => {
              const Icon = TYPE_ICONS[note.type] || Info;
              const urgency = URGENCY_META[note.urgency] || URGENCY_META.normal;
              return (
                <li
                  key={note._id}
                  className={cx('flex gap-3 px-5 py-4 sm:px-6', !note.read && 'bg-accent-soft/40')}
                >
                  <MemberAvatar name={note.memberName || 'MediTrack'} color={note.memberColor} size={38} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-content">{note.title}</p>
                        <p className="mt-0.5 text-sm text-muted">{note.body}</p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-subtle">
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        {NOTIFICATION_TYPE_META[note.type]?.label || note.type}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone={urgency.tone}>
                        {urgency.label} priority
                      </Badge>
                      {note.memberName ? (
                        <Badge tone="muted">
                          {note.memberName}
                        </Badge>
                      ) : null}
                      <span className="inline-flex items-center gap-1 text-[11px] text-subtle">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {fromNow(note.createdAt)}
                      </span>
                      {note.pushSent ? <Badge tone="success">Pushed to device</Badge> : null}
                      {!note.read ? <Badge tone="accent">Unread</Badge> : null}
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {note.actions?.includes('mark_taken') ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 px-2.5 text-xs"
                          loading={actionMutation.isPending}
                          onClick={() => actionMutation.mutate({ id: note._id, action: 'mark_taken' })}
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          Mark taken
                        </Button>
                      ) : null}
                      {note.actions?.includes('remind_later') ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2.5 text-xs"
                          onClick={() => actionMutation.mutate({ id: note._id, action: 'remind_later' })}
                        >
                          Remind me later
                        </Button>
                      ) : null}
                      {note.medicineId ? (
                        <Button
                          as={Link}
                          to={`/app/medicines/${note.medicineId}`}
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2.5 text-xs"
                        >
                          Open medicine
                        </Button>
                      ) : null}
                      {note.actions?.includes('review_plan') ? (
                        <Button as={Link} to="/app/care-plans" size="sm" variant="secondary" className="h-8 px-2.5 text-xs">
                          Review plan
                        </Button>
                      ) : null}
                      {!note.read ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2.5 text-xs"
                          onClick={() => readMutation.mutate(note._id)}
                        >
                          Mark read
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="danger-ghost"
                        className="h-8 px-2.5 text-xs"
                        aria-label="Delete notification"
                        onClick={() => deleteMutation.mutate(note._id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Notice tone="neutral" className="mt-6" icon={Info}>
        Each notification names the person it is about, with their colour and initials, and shows urgency as
        text as well as colour. Nothing is ever delivered twice for the same dose or window.
      </Notice>
    </>
  );
}

export default NotificationsPage;
