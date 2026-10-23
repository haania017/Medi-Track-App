import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardList, Clock3, History, Plus, RefreshCw } from 'lucide-react';
import api, { qs } from '../../lib/api';
import { PageHeader } from '../../components/app/PageHeader';
import { Card, CardHeader, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea, Checkbox } from '../../components/ui/Field';
import { Badge, MemberAvatar, StatusPill, Tabs } from '../../components/ui/Misc';
import { Modal, ConfirmDialog } from '../../components/ui/Overlay';
import { EmptyState, ErrorState, LoadingBlock, Notice } from '../../components/ui/Feedback';
import { useToast } from '../../context/ToastProvider';
import { useWorkspace } from '../../context/WorkspaceProvider';
import { dayjs, formatDate, formatDateTime } from '../../lib/format';

const TABS = [
  { value: 'active', label: 'Active' },
  { value: 'awaiting_review', label: 'Needs review' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function CarePlansPage() {
  const { profiles, activeProfile } = useWorkspace();
  const client = useQueryClient();
  const toast = useToast();

  const [tab, setTab] = useState('active');
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const [closing, setClosing] = useState(null);
  const [form, setForm] = useState({ decision: 'continue', outcome: '', extendedReviewDate: '' });
  const [createForm, setCreateForm] = useState({
    profileId: activeProfile?.id || profiles[0]?.id || '',
    title: '',
    purpose: '',
    startDate: dayjs().format('YYYY-MM-DD'),
    reviewDate: dayjs().add(5, 'day').format('YYYY-MM-DD'),
    notes: '',
    medicineIds: [],
  });

  const plansQuery = useQuery({
    queryKey: ['care-plans'],
    queryFn: () => api.data('/care-plans'),
  });

  const medicinesQuery = useQuery({
    queryKey: ['medicines', 'for-plan', createForm.profileId],
    queryFn: () => api.get(`/medicines${qs({ profileId: createForm.profileId, status: 'active,paused', limit: 100 })}`),
    enabled: createOpen && Boolean(createForm.profileId),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/care-plans', payload),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['care-plans'] });
      toast.success('Care plan created.');
      setCreateOpen(false);
      setTab('active');
    },
    onError: (error) => toast.error(error.message),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, payload }) => api.post(`/care-plans/${id}/review`, payload),
    onSuccess: (payload) => {
      client.invalidateQueries({ queryKey: ['care-plans'] });
      client.invalidateQueries({ queryKey: ['medicines'] });
      client.invalidateQueries({ queryKey: ['doses'] });
      client.invalidateQueries({ queryKey: ['dashboard'] });
      if (payload.data.pausedMedicines?.length) {
        toast.success(
          `Plan completed. Reminders stopped for ${payload.data.pausedMedicines.length} medicine(s); history preserved.`,
        );
      } else {
        toast.success('Plan continued with a new review date.');
      }
      setReviewing(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const closeMutation = useMutation({
    mutationFn: (id) => api.post(`/care-plans/${id}/close`, {}),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['care-plans'] });
      client.invalidateQueries({ queryKey: ['medicines'] });
      client.invalidateQueries({ queryKey: ['doses'] });
      toast.success('Care plan cancelled. History was kept.');
      setClosing(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const plans = plansQuery.data ?? [];
  const visible = plans.filter((plan) => plan.status === tab);
  const counts = plans.reduce((acc, plan) => {
    acc[plan.status] = (acc[plan.status] || 0) + 1;
    return acc;
  }, {});

  const submitReview = (event) => {
    event.preventDefault();
    const payload = { decision: form.decision, outcome: form.outcome || undefined };
    if (form.decision === 'continue') {
      if (!form.extendedReviewDate) {
        toast.error('Choose the next review date.');
        return;
      }
      payload.extendedReviewDate = new Date(form.extendedReviewDate).toISOString();
    }
    reviewMutation.mutate({ id: reviewing.id, payload });
  };

  const openReview = (plan) => {
    setReviewing(plan);
    setForm({
      decision: 'continue',
      outcome: '',
      extendedReviewDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
    });
  };

  if (plansQuery.isLoading) {
    return (
      <>
        <PageHeader title="Care plans" />
        <LoadingBlock rows={3} />
      </>
    );
  }

  if (plansQuery.isError) {
    return (
      <>
        <PageHeader title="Care plans" />
        <ErrorState error={plansQuery.error} onRetry={plansQuery.refetch} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Care plans"
        description="Short courses for a temporary illness, with a planned review date. MediTrack asks you what to do when the date arrives — it never assumes recovery."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New care plan
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Active plans" value={counts.active ?? 0} icon={ClipboardList} />
        <StatCard
          label="Awaiting review"
          value={counts.awaiting_review ?? 0}
          tone={counts.awaiting_review ? 'warning' : 'default'}
          icon={Clock3}
        />
        <StatCard label="Completed" value={counts.completed ?? 0} tone="success" icon={CheckCircle2} />
      </div>

      <Card className="mt-6">
        <CardHeader icon={ClipboardList} title="Plans" description="Filter by status." />
        <div className="px-5 py-3 sm:px-6">
          <Tabs
            tabs={TABS.map((t) => ({ ...t, count: counts[t.value] || 0 }))}
            value={tab}
            onChange={setTab}
            size="sm"
          />
        </div>

        {visible.length ? (
          <ul className="divide-border-y">
            {visible.map((plan) => {
              const dueForReview = plan.status === 'awaiting_review';
              return (
                <li key={plan.id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-content">{plan.title}</h3>
                        <StatusPill status={plan.status} />
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-subtle">
                        {plan.profileId ? (
                          <span className="inline-flex items-center gap-1.5">
                            <MemberAvatar name={plan.profileId.name} color={plan.profileId.color} size={14} />
                            {plan.profileId.name}
                          </span>
                        ) : null}
                        <span>· started {formatDate(plan.startDate)}</span>
                        <span>· review {formatDate(plan.reviewDate)}</span>
                        {plan.endDate ? <span>· ended {formatDate(plan.endDate)}</span> : null}
                      </p>
                      {plan.purpose ? <p className="mt-2 text-sm text-muted">{plan.purpose}</p> : null}
                      {plan.medicineIds?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {plan.medicineIds.map((medicine) => (
                            <Badge key={medicine._id || medicine} tone="muted">
                              {medicine.name || 'Medicine'}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {dueForReview || plan.status === 'active' ? (
                        <Button size="sm" variant={dueForReview ? 'primary' : 'secondary'} onClick={() => openReview(plan)}>
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                          {dueForReview ? 'Answer review' : 'Review'}
                        </Button>
                      ) : null}
                      {['active', 'awaiting_review'].includes(plan.status) ? (
                        <Button size="sm" variant="ghost" onClick={() => setClosing(plan)}>
                          Cancel plan
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {plan.history?.length ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-subtle hover:text-content">
                        <span className="inline-flex items-center gap-1.5">
                          <History className="h-3.5 w-3.5" aria-hidden="true" />
                          {plan.history.length} history entr{plan.history.length === 1 ? 'y' : 'ies'}
                        </span>
                      </summary>
                      <ul className="mt-2 space-y-1.5 border-l border-border pl-3">
                        {plan.history.map((entry, index) => (
                          <li key={index} className="text-xs text-subtle">
                            <span className="font-medium text-muted">{entry.action}</span> ·{' '}
                            {formatDateTime(entry.at)}
                            {entry.note ? ` · ${entry.note}` : ''}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={ClipboardList}
            title={`No ${tab.replace('_', ' ')} plans`}
            description="Create a care plan when someone starts a short course that needs a review date."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New care plan
              </Button>
            }
          />
        )}
      </Card>

      <Notice tone="neutral" className="mt-6" icon={ClipboardList}>
        Completing or cancelling a plan stops that plan's future reminders but never deletes dose history,
        stock records or the person's profile. If nobody answers the review, the plan simply stays as it is.
      </Notice>

      {/* ------------------------------ create plan ----------------------------- */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New care plan"
        description="Give the course a review date so it does not quietly run forever."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button
              loading={createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  profileId: createForm.profileId,
                  title: createForm.title,
                  purpose: createForm.purpose || undefined,
                  startDate: new Date(createForm.startDate).toISOString(),
                  reviewDate: new Date(createForm.reviewDate).toISOString(),
                  notes: createForm.notes || undefined,
                  medicineIds: createForm.medicineIds,
                })
              }
              disabled={!createForm.title.trim()}
            >
              Create plan
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Who is this plan for?"
            value={createForm.profileId}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, profileId: event.target.value, medicineIds: [] }))
            }
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} ({profile.relationship})
              </option>
            ))}
          </Select>

          <Input
            label="Title"
            placeholder="e.g. Chest infection — antibiotic course"
            value={createForm.title}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
            required
          />

          <Textarea
            label="Purpose (optional)"
            rows={2}
            placeholder="What is this course treating?"
            value={createForm.purpose}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, purpose: event.target.value }))}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Start date"
              type="date"
              value={createForm.startDate}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, startDate: event.target.value }))}
            />
            <Input
              label="Review / end date"
              type="date"
              value={createForm.reviewDate}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, reviewDate: event.target.value }))}
              hint="We will ask you on this date whether to continue."
            />
          </div>

          <div>
            <p className="label">Linked medicines</p>
            {medicinesQuery.isLoading ? (
              <p className="hint">Loading medicines…</p>
            ) : medicinesQuery.data?.data?.length ? (
              <div className="space-y-1.5 rounded-xl border border-border p-3">
                {medicinesQuery.data.data.map((medicine) => (
                  <Checkbox
                    key={medicine.id}
                    label={`${medicine.name} ${medicine.strength || ''}`}
                    checked={createForm.medicineIds.includes(medicine.id)}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        medicineIds: event.target.checked
                          ? [...prev.medicineIds, medicine.id]
                          : prev.medicineIds.filter((id) => id !== medicine.id),
                      }))
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="hint">This profile has no active medicines yet.</p>
            )}
            <p className="hint mt-2">
              When the plan is completed, linked medicines are paused so their reminders stop — the records stay.
            </p>
          </div>

          <Textarea
            label="Notes (optional)"
            rows={2}
            value={createForm.notes}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
        </div>
      </Modal>

      {/* ------------------------------ review plan ----------------------------- */}
      <Modal
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title={`Review: ${reviewing?.title || ''}`}
        description={`The planned review date (${formatDate(reviewing?.reviewDate)}) has arrived. Is this course complete, or should it continue?`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReviewing(null)} disabled={reviewMutation.isPending}>
              Decide later
            </Button>
            <Button onClick={submitReview} loading={reviewMutation.isPending}>
              {form.decision === 'complete' ? 'Complete plan' : 'Continue plan'}
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={submitReview}>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'continue', label: 'Continue', icon: RefreshCw, hint: 'Extend the review date' },
              { value: 'complete', label: 'Complete', icon: CheckCircle2, hint: 'Stop reminders' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, decision: option.value }))}
                aria-pressed={form.decision === option.value}
                className={
                  form.decision === option.value
                    ? 'rounded-xl border border-accent/50 bg-accent-soft p-3 text-left'
                    : 'rounded-xl border border-border p-3 text-left transition-colors hover:bg-surface-2'
                }
              >
                <option.icon className="h-4 w-4 text-accent" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium text-content">{option.label}</p>
                <p className="text-xs text-subtle">{option.hint}</p>
              </button>
            ))}
          </div>

          {form.decision === 'continue' ? (
            <Input
              label="New review date"
              type="date"
              value={form.extendedReviewDate}
              onChange={(event) => setForm((prev) => ({ ...prev, extendedReviewDate: event.target.value }))}
            />
          ) : (
            <Notice tone="neutral" icon={CheckCircle2}>
              Completing stops future reminders for the linked medicines and keeps every dose, stock and history
              record. The profile itself is never deleted.
            </Notice>
          )}

          <Textarea
            label="Outcome or note (optional)"
            rows={3}
            placeholder="e.g. Symptoms cleared, no further doses needed."
            value={form.outcome}
            onChange={(event) => setForm((prev) => ({ ...prev, outcome: event.target.value }))}
          />

          {reviewing?.history?.length ? (
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-subtle">History</p>
              <ul className="mt-2 space-y-1">
                {reviewing.history.map((entry, index) => (
                  <li key={index} className="text-xs text-muted">
                    {entry.action} · {formatDateTime(entry.at)}
                    {entry.note ? ` · ${entry.note}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(closing)}
        onClose={() => setClosing(null)}
        onConfirm={() => closeMutation.mutate(closing.id)}
        loading={closeMutation.isPending}
        title={`Cancel "${closing?.title}"?`}
        description="Future reminders for linked medicines stop. All history is preserved and the profile is untouched."
        confirmLabel="Cancel plan"
        tone="danger"
      />
    </>
  );
}

export default CarePlansPage;
