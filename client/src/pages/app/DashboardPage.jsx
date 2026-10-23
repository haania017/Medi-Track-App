import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarClock,
  Check,
  ClipboardList,
  Clock3,
  Package,
  Pill,
  Plus,
  Users,
} from 'lucide-react';
import api from '../../lib/api';
import { PageHeader } from '../../components/app/PageHeader';
import { DoseRow } from '../../components/app/DoseRow';
import { MedicineFormModal } from '../../components/app/MedicineFormModal';
import { Card, CardBody, CardHeader, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, MemberAvatar, ProgressBar, StatusPill } from '../../components/ui/Misc';
import { EmptyState, ErrorState, LoadingBlock, Notice } from '../../components/ui/Feedback';
import { useWorkspace } from '../../context/WorkspaceProvider';
import { daysUntil, expiryLabel, formatDate, formatTime, fromNow } from '../../lib/format';

export function DashboardPage() {
  const { activeProfile, isLoading: workspaceLoading } = useWorkspace();
  const [addOpen, setAddOpen] = useState(false);

  const todayQuery = useQuery({
    queryKey: ['doses', 'today', activeProfile?.id],
    queryFn: () => api.get(`/doses/today${activeProfile?.id ? `?profileId=${activeProfile.id}` : ''}`),
    refetchInterval: 60 * 1000,
  });

  const stockQuery = useQuery({
    queryKey: ['stock', 'summary', activeProfile?.id],
    queryFn: () => api.data(`/stock/summary${activeProfile?.id ? `?profileId=${activeProfile.id}` : ''}`),
  });

  const expiringQuery = useQuery({
    queryKey: ['medicines', 'expiring', 30],
    queryFn: () => api.get('/medicines/expiring?days=30'),
  });

  const familyQuery = useQuery({
    queryKey: ['reports', 'family-summary'],
    queryFn: () => api.data('/reports/family-summary'),
  });

  const plansQuery = useQuery({
    queryKey: ['care-plans', 'review'],
    queryFn: () => api.data('/care-plans?status=awaiting_review'),
  });

  const activityQuery = useQuery({
    queryKey: ['notifications', 'dashboard'],
    queryFn: () => api.get('/notifications?limit=5'),
  });

  if (workspaceLoading || todayQuery.isLoading) {
    return (
      <>
        <PageHeader title="Dashboard" description="Loading today's medicines…" />
        <LoadingBlock rows={4} />
      </>
    );
  }

  if (todayQuery.isError) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <ErrorState error={todayQuery.error} onRetry={todayQuery.refetch} />
      </>
    );
  }

  const view = todayQuery.data?.data ?? { doses: [], summary: {}, next: null };
  const summary = view.summary || {};
  const stock = stockQuery.data;
  const expiring = expiringQuery.data?.data ?? [];
  const family = familyQuery.data ?? [];
  const reviewPlans = plansQuery.data ?? [];
  const activity = activityQuery.data?.data ?? activityQuery.data ?? [];

  const nextDose = view.next;
  const remaining = (summary.total || 0) - (summary.taken || 0) - (summary.skipped || 0);
  const takenPct = summary.total ? Math.round((summary.taken / summary.total) * 100) : 0;

  return (
    <>
      <PageHeader
        title={`Today · ${activeProfile?.name ?? 'your family'}`}
        description="What is due now, what is running low, and what is about to expire. Detailed medicine information lives on each medicine's page."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add medicine
          </Button>
        }
      />

      {reviewPlans.length ? (
        <Notice
          tone="warning"
          icon={ClipboardList}
          title="A care plan needs your review"
          className="mb-6"
          action={
            <Button as={Link} to="/app/care-plans" size="sm" variant="secondary">
              Review now
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          }
        >
          {reviewPlans.map((plan) => `${plan.title} — ${plan.profileId?.name || 'a profile'}`).join(', ')}. Decide
          whether the plan is complete or should continue.
        </Notice>
      ) : null}

      {/* ------------------------------ summary ------------------------------ */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Doses today"
          value={summary.total ?? 0}
          hint={remaining > 0 ? `${remaining} still to record` : 'All recorded'}
          icon={Pill}
        />
        <StatCard label="Taken" value={summary.taken ?? 0} tone="success" icon={Check} />
        <StatCard
          label="Missed"
          value={summary.missed ?? 0}
          tone={summary.missed ? 'danger' : 'default'}
          icon={AlertTriangle}
        />
        <StatCard
          label="Low stock"
          value={stock?.lowStockCount ?? 0}
          tone={stock?.lowStockCount ? 'warning' : 'default'}
          icon={Package}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* --------------------------- today's doses -------------------------- */}
        <div className="lg:col-span-2 space-y-6">
          {nextDose ? (
            <Card className="border-accent/40">
              <CardBody className="flex flex-wrap items-center gap-4">
                <MemberAvatar name={nextDose.profileId?.name} color={nextDose.profileId?.color} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">Up next</p>
                  <p className="mt-0.5 text-base font-semibold text-content">
                    {nextDose.medicineId?.name} {nextDose.medicineId?.strength || ''}{' '}
                    {nextDose.medicineId?.unit || ''}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    {nextDose.profileId?.name} · due at {formatTime(nextDose.snoozedUntil || nextDose.scheduledFor)}
                    {nextDose.snoozedUntil ? ' (snoozed)' : ''}
                  </p>
                </div>
                <Button as={Link} to="/app/doses" variant="secondary">
                  Record it
                </Button>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              icon={Clock3}
              title="Today's doses"
              description={
                summary.total
                  ? `${summary.taken ?? 0} of ${summary.total} recorded`
                  : 'Nothing is scheduled for today.'
              }
              action={
                <Button as={Link} to="/app/doses" variant="ghost" size="sm">
                  View all
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              }
            />
            {summary.total ? (
              <div className="px-5 py-3 sm:px-6">
                <ProgressBar
                  value={takenPct}
                  label={`${takenPct}% of today's doses recorded as taken`}
                  tone={takenPct === 100 ? 'success' : 'accent'}
                />
              </div>
            ) : null}
            {view.doses.length ? (
              <ul className="divide-border-y">
                {view.doses.slice(0, 6).map((dose) => (
                  <DoseRow key={dose._id} dose={dose} onChanged={todayQuery.refetch} />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Pill}
                title="No doses scheduled today"
                description="Add a medicine with a schedule and reminders will appear here."
                action={
                  <Button onClick={() => setAddOpen(true)}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add a medicine
                  </Button>
                }
              />
            )}
            {view.overdueCount ? (
              <div className="border-t border-border px-5 py-3 sm:px-6">
                <p className="text-xs text-danger">
                  {view.overdueCount} dose{view.overdueCount === 1 ? '' : 's'} still unrecorded and past their time.
                </p>
              </div>
            ) : null}
          </Card>

          {family.length > 1 ? (
            <Card>
              <CardHeader
                icon={Users}
                title="Family overview"
                description="Recorded doses today, per person."
                action={
                  <Button as={Link} to="/app/family" variant="ghost" size="sm">
                    Family hub
                  </Button>
                }
              />
              <ul className="divide-border-y">
                {family.map((row) => (
                  <li key={row.profileId} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                    <MemberAvatar name={row.name} color={row.color} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-content">{row.name}</p>
                      <p className="text-xs text-subtle">
                        {row.relationship} · {row.activeMedicines} active medicine
                        {row.activeMedicines === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge tone="success">{row.dosesToday.taken} taken</Badge>
                      {row.dosesToday.pending ? <Badge tone="info">{row.dosesToday.pending} due</Badge> : null}
                      {row.dosesToday.missed ? <Badge tone="danger">{row.dosesToday.missed} missed</Badge> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        {/* ------------------------------ side rail --------------------------- */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              icon={Package}
              title="Low stock"
              action={
                <Button as={Link} to="/app/stock" variant="ghost" size="sm">
                  Manage
                </Button>
              }
            />
            {stock?.lowStock?.length ? (
              <ul className="divide-border-y">
                {stock.lowStock.slice(0, 5).map((item) => (
                  <li key={item.medicineId} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-content">{item.name}</p>
                      <p className="text-xs text-subtle">
                        {item.quantity} {item.unit} left · alert at {item.lowStockThreshold}
                      </p>
                    </div>
                    <Badge tone="warning">Low</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted">Nothing is running low right now.</p>
            )}
          </Card>

          <Card>
            <CardHeader
              icon={CalendarClock}
              title="Expiring soon"
              action={
                <Button as={Link} to="/app/expiry" variant="ghost" size="sm">
                  All
                </Button>
              }
            />
            {expiring.length ? (
              <ul className="divide-border-y">
                {expiring.slice(0, 5).map((medicine) => {
                  const meta = expiryLabel(medicine.expiryDate);
                  return (
                    <li key={medicine.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/app/medicines/${medicine.id}`}
                          className="truncate text-sm font-medium text-content underline-offset-4 hover:underline"
                        >
                          {medicine.name}
                        </Link>
                        <p className="text-xs text-subtle">
                          {medicine.profileId?.name} · {formatDate(medicine.expiryDate)}
                        </p>
                      </div>
                      <Badge tone={meta.tone === 'danger' ? 'danger' : 'warning'}>
                        {daysUntil(medicine.expiryDate)}d
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted">No medicines expire in the next 30 days.</p>
            )}
          </Card>

          <Card>
            <CardHeader
              icon={Bell}
              title="Recent activity"
              action={
                <Button as={Link} to="/app/notifications" variant="ghost" size="sm">
                  Centre
                </Button>
              }
            />
            {activity.length ? (
              <ul className="divide-border-y">
                {activity.slice(0, 5).map((note) => (
                  <li key={note._id || note.id} className="flex items-start gap-3 px-5 py-3">
                    <MemberAvatar name={note.memberName} color={note.memberColor} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-content">{note.title}</p>
                      <p className="text-xs text-subtle">{fromNow(note.createdAt)}</p>
                    </div>
                    {!note.read ? <StatusPill status="pending" label="New" tone="accent" /> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted">No reminders or alerts yet.</p>
            )}
          </Card>
        </div>
      </div>

      <MedicineFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        defaultProfileId={activeProfile?.id}
      />
    </>
  );
}

export default DashboardPage;
