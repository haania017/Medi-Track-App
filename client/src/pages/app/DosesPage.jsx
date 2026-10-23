import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, Clock3, RefreshCw, X } from 'lucide-react';
import api from '../../lib/api';
import { PageHeader } from '../../components/app/PageHeader';
import { DoseRow } from '../../components/app/DoseRow';
import { Card, CardBody, CardHeader, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Tabs, Badge, ProgressBar } from '../../components/ui/Misc';
import { EmptyState, ErrorState, LoadingBlock, Notice } from '../../components/ui/Feedback';
import { useWorkspace } from '../../context/WorkspaceProvider';
import { dayjs, formatDate } from '../../lib/format';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Due' },
  { value: 'taken', label: 'Taken' },
  { value: 'missed', label: 'Missed' },
  { value: 'skipped', label: 'Skipped' },
];

export function DosesPage() {
  const { activeProfile, profiles } = useWorkspace();
  const client = useQueryClient();
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [filter, setFilter] = useState('all');

  const isToday = date === dayjs().format('YYYY-MM-DD');

  const todayQuery = useQuery({
    queryKey: ['doses', 'today', activeProfile?.id, date],
    queryFn: () =>
      api.get(`/doses/today?date=${date}${activeProfile?.id ? `&profileId=${activeProfile.id}` : ''}`),
    enabled: isToday,
  });

  const rangeQuery = useQuery({
    queryKey: ['doses', 'range', activeProfile?.id, date],
    queryFn: () =>
      api.get(
        `/doses?date=${date}&limit=200${activeProfile?.id ? `&profileId=${activeProfile.id}` : ''}${filter !== 'all' ? `&status=${filter}` : ''}`,
      ),
    enabled: !isToday,
  });

  // Materialise doses for the coming week on demand (the scheduler also does this).
  const generateMutation = useMutation({
    mutationFn: () => api.post('/doses/generate', { days: 7 }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['doses'] });
    },
  });

  const query = isToday ? todayQuery : rangeQuery;
  const doses = useMemo(
    () => (isToday ? todayQuery.data?.data?.doses ?? [] : rangeQuery.data?.data ?? []),
    [isToday, todayQuery.data, rangeQuery.data],
  );
  const summary = useMemo(
    () =>
      isToday
        ? todayQuery.data?.data?.summary ?? {}
        : doses.reduce(
            (acc, dose) => {
              acc[dose.status] = (acc[dose.status] || 0) + 1;
              acc.total += 1;
              return acc;
            },
            { total: 0, taken: 0, pending: 0, missed: 0, skipped: 0 },
          ),
    [isToday, todayQuery.data, doses],
  );

  const visible = useMemo(
    () => (isToday && filter !== 'all' ? doses.filter((dose) => dose.status === filter) : doses),
    [doses, filter, isToday],
  );

  const groupByProfile = useMemo(() => {
    const map = new Map();
    for (const dose of visible) {
      const key = dose.profileId?._id || 'unknown';
      if (!map.has(key)) map.set(key, { profile: dose.profileId, doses: [] });
      map.get(key).doses.push(dose);
    }
    return [...map.values()];
  }, [visible]);

  const recorded = (summary.taken || 0) + (summary.skipped || 0) + (summary.missed || 0);
  const takenPct = recorded ? Math.round(((summary.taken || 0) / recorded) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Doses"
        description="Everything scheduled for a day, with what you recorded against each dose."
        actions={
          <>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              aria-label="Choose a date"
              className="field w-auto"
            />
            <Button
              variant="secondary"
              loading={generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Scheduled" value={summary.total ?? 0} icon={CalendarDays} hint={formatDate(date, 'ddd, D MMM YYYY')} />
        <StatCard label="Taken" value={summary.taken ?? 0} tone="success" icon={Check} />
        <StatCard label="Still due" value={summary.pending ?? 0} tone="info" icon={Clock3} />
        <StatCard
          label="Missed / skipped"
          value={(summary.missed ?? 0) + (summary.skipped ?? 0)}
          tone={summary.missed ? 'danger' : 'default'}
          icon={X}
        />
      </div>

      <Card className="mt-6">
        <CardHeader
          icon={Clock3}
          title={isToday ? "Today's doses" : formatDate(date, 'dddd, D MMMM YYYY')}
          description="Reminders are generated from each medicine's schedule in your account timezone."
        />
        <CardBody className="pb-0">
          <Tabs tabs={FILTERS} value={filter} onChange={setFilter} />
          {recorded ? (
            <ProgressBar
              className="mt-4"
              value={takenPct}
              label={`${takenPct}% of recorded doses were taken — this is your own record, not medical proof of ingestion`}
              tone={takenPct >= 80 ? 'success' : takenPct >= 50 ? 'accent' : 'warning'}
            />
          ) : null}
        </CardBody>

        {query.isLoading ? (
          <div className="p-5">
            <LoadingBlock rows={3} />
          </div>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={query.refetch} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={filter === 'all' ? 'Nothing scheduled' : `No ${filter} doses`}
            description={
              isToday
                ? 'No doses are scheduled for this date and profile.'
                : 'Try another date, or record doses from today.'
            }
          />
        ) : (
          groupByProfile.map((group) => (
            <div key={group.profile?._id || 'unknown'}>
              {profiles.length > 1 ? (
                <div className="flex items-center gap-2 border-y border-border bg-surface-2/60 px-5 py-2 sm:px-6">
                  <span className="text-xs font-semibold uppercase tracking-wide text-subtle">
                    {group.profile?.name || 'Profile'}
                  </span>
                  <Badge tone="muted">{group.doses.length}</Badge>
                </div>
              ) : null}
              <ul className="divide-border-y">
                {group.doses.map((dose) => (
                  <DoseRow key={dose._id} dose={dose} showProfile={profiles.length > 1} onChanged={query.refetch} />
                ))}
              </ul>
            </div>
          ))
        )}
      </Card>

      <Notice tone="neutral" className="mt-6">
        MediTrack records the actions you enter. Marking a dose as taken deducts stock once and is not
        evidence that the medicine was actually swallowed. Skipped and missed doses never change stock.
      </Notice>
    </>
  );
}

export default DosesPage;
