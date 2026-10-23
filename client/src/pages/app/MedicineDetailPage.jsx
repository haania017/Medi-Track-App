import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Archive,
  BookOpen,
  CalendarClock,
  History,
  Info,
  Package,
  Pencil,
  Plus,
  ShieldAlert,
  Sparkles,
  TrendingDown,
} from 'lucide-react';
import api from '../../lib/api';
import { PageHeader } from '../../components/app/PageHeader';
import { MedicineFormModal } from '../../components/app/MedicineFormModal';
import { PronounceButton } from '../../components/app/PronounceButton';
import { Card, CardBody, CardHeader, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { Badge, DefinitionList, MemberAvatar, StatusPill, Tabs } from '../../components/ui/Misc';
import { ConfirmDialog } from '../../components/ui/Overlay';
import { EmptyState, ErrorState, LoadingBlock, Notice, Skeleton } from '../../components/ui/Feedback';
import { useToast } from '../../context/ToastProvider';
import { formatDate, formatDateTime, dayjs, expiryLabel } from '../../lib/format';

const TABS = [
  { value: 'overview', label: 'Overview', icon: Info },
  { value: 'schedule', label: 'Schedule', icon: CalendarClock },
  { value: 'stock', label: 'Stock', icon: Package },
  { value: 'history', label: 'History', icon: History },
  // Deliberately last and never pre-selected: medicine information is opt-in.
  { value: 'info', label: 'Medicine Information', icon: BookOpen },
];

function describeSchedule(schedule) {
  if (!schedule) return 'No schedule set';
  switch (schedule.type) {
    case 'daily':
      return `Every day at ${(schedule.times || []).join(', ') || '—'}`;
    case 'weekdays': {
      const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return `Every ${(schedule.weekdays || []).map((d) => names[d]).join(', ')} at ${(schedule.times || []).join(', ')}`;
    }
    case 'interval':
      return `Every ${schedule.intervalDays} day${schedule.intervalDays === 1 ? '' : 's'} at ${(schedule.times || []).join(', ')}`;
    case 'specific-dates':
      return `On ${(schedule.specificDates || []).join(', ')}`;
    case 'as-needed':
      return 'Only when needed — no reminders are generated';
    default:
      return schedule.type;
  }
}

export function MedicineDetailPage() {
  const { medicineId } = useParams();
  const client = useQueryClient();
  const toast = useToast();

  const [tab, setTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [refill, setRefill] = useState({ type: 'refill', quantityChange: '', reason: '' });

  const detailQuery = useQuery({
    queryKey: ['medicines', medicineId],
    queryFn: () => api.data(`/medicines/${medicineId}`),
  });

  // Fetched only once the user opens the Medicine Information tab.
  const infoQuery = useQuery({
    queryKey: ['medicine-info', medicineId],
    queryFn: () => api.data(`/medicine-info/${medicineId}`),
    enabled: tab === 'info',
    staleTime: 10 * 60 * 1000,
  });

  const stockMutation = useMutation({
    mutationFn: (payload) => api.post(`/medicines/${medicineId}/stock-transactions`, payload),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['medicines'] });
      client.invalidateQueries({ queryKey: ['stock'] });
      client.invalidateQueries({ queryKey: ['dashboard'] });
      setRefill({ type: 'refill', quantityChange: '', reason: '' });
      toast.success('Stock updated and recorded in the ledger.');
    },
    onError: (error) => toast.error(error.message),
  });

  const archiveMutation = useMutation({
    mutationFn: () => api.post(`/medicines/${medicineId}/archive`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['medicines'] });
      client.invalidateQueries({ queryKey: ['doses'] });
      toast.success('Medicine archived. History preserved.');
      setArchiveOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  if (detailQuery.isLoading) {
    return (
      <>
        <PageHeader title="Medicine" />
        <LoadingBlock rows={4} />
      </>
    );
  }

  if (detailQuery.isError) {
    return (
      <>
        <PageHeader title="Medicine" />
        <ErrorState
          error={detailQuery.error}
          onRetry={detailQuery.refetch}
          title={detailQuery.error.status === 404 ? 'Medicine not available' : 'Could not load this medicine'}
        />
      </>
    );
  }

  const { medicine, upcomingDoses = [], stockHistory = [], doseHistory = [], history = {}, profile } =
    detailQuery.data;
  const expiry = expiryLabel(medicine.expiryDate);
  const low = medicine.stock.quantity <= (medicine.stock.lowStockThreshold ?? 0);

  const handleStockSubmit = (event) => {
    event.preventDefault();
    const value = Number(refill.quantityChange);
    if (!Number.isFinite(value) || value === 0) {
      toast.error('Enter a non-zero quantity.');
      return;
    }
    stockMutation.mutate({
      type: refill.type,
      quantityChange: refill.type === 'refill' ? Math.abs(value) : value,
      reason: refill.reason || undefined,
    });
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Medicines', to: '/app/medicines' }, { label: medicine.name }]}
        title={
          <span className="inline-flex items-center gap-1.5">
            {`${medicine.name}${medicine.strength ? ` ${medicine.strength} ${medicine.unit}` : ''}`}
            <PronounceButton text={medicine.name} size="md" />
          </span>
        }
        description={medicine.instructions || `${medicine.form} · ${describeSchedule(medicine.schedule)}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit
            </Button>
            {medicine.status !== 'archived' ? (
              <Button variant="danger-ghost" onClick={() => setArchiveOpen(true)}>
                <Archive className="h-4 w-4" aria-hidden="true" />
                Archive
              </Button>
            ) : null}
          </>
        }
      >
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusPill status={medicine.status} />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs text-muted">
            <MemberAvatar name={profile.name} color={profile.color} size={16} />
            {profile.name}
          </span>
          <Badge tone={low ? 'warning' : 'muted'} icon={Package}>
            {medicine.stock.quantity} {medicine.stock.unit}
            {low ? ' · low' : ''}
          </Badge>
          <Badge tone={expiry.tone === 'danger' ? 'danger' : expiry.tone === 'warning' ? 'warning' : 'muted'} icon={CalendarClock}>
            {medicine.expiryDate ? expiry.label : 'No expiry date recorded'}
          </Badge>
          {medicine.source !== 'manual' ? (
            <Badge tone="info" icon={Sparkles}>
              Added from a {medicine.source === 'package-scan' ? 'package' : 'prescription'} scan
            </Badge>
          ) : null}
        </div>
      </PageHeader>

      <div className="mb-6">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </div>

      {/* ------------------------------- overview ------------------------------ */}
      {tab === 'overview' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader icon={Info} title="Overview" description="What you recorded for this medicine." />
            <CardBody>
              <DefinitionList
                items={[
                  { label: 'Name', value: medicine.name },
                  { label: 'Strength', value: medicine.strength ? `${medicine.strength} ${medicine.unit}` : '—' },
                  { label: 'Form', value: medicine.form },
                  { label: 'Units per dose', value: medicine.schedule?.doseQuantity ?? 1 },
                  { label: 'Start date', value: formatDate(medicine.startDate) },
                  { label: 'End date', value: medicine.endDate ? formatDate(medicine.endDate) : 'Ongoing' },
                  { label: 'Manufacturer', value: medicine.manufacturer || '—' },
                  { label: 'Batch number', value: medicine.batchNumber || '—' },
                ]}
              />
              {medicine.instructions ? (
                <div className="mt-5 rounded-xl border border-border bg-surface-2 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Instructions</p>
                  <p className="mt-1 text-sm text-content">{medicine.instructions}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <div className="space-y-3">
            <StatCard label="Recorded taken" value={history.taken ?? 0} tone="success" />
            <StatCard label="Missed" value={history.missed ?? 0} tone={history.missed ? 'danger' : 'default'} />
            <StatCard label="Skipped" value={history.skipped ?? 0} />
            <StatCard label="Still pending" value={history.pending ?? 0} tone="info" />
          </div>
        </div>
      ) : null}

      {/* ------------------------------- schedule ----------------------------- */}
      {tab === 'schedule' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader icon={CalendarClock} title="Current schedule" />
            <CardBody>
              <p className="text-sm font-medium text-content">{describeSchedule(medicine.schedule)}</p>
              <ul className="mt-3 space-y-1.5 text-sm text-muted">
                <li>Pattern: {medicine.schedule?.type}</li>
                <li>Times: {(medicine.schedule?.times || []).join(', ') || '—'}</li>
                <li>
                  Active window: {formatDate(medicine.startDate)} →{' '}
                  {medicine.endDate ? formatDate(medicine.endDate) : 'no end date'}
                </li>
              </ul>
              <p className="hint mt-4">
                Times are interpreted in your account timezone. Editing the schedule recalculates upcoming
                doses without touching past history.
              </p>
            </CardBody>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader icon={CalendarClock} title="Upcoming doses" description="The next scheduled reminders." />
            {upcomingDoses.length ? (
              <ul className="divide-border-y">
                {upcomingDoses.map((dose) => (
                  <li key={dose._id} className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-content">
                        {formatDate(dose.scheduledFor, 'ddd, D MMM')} · {dose.scheduleTime || ''}
                      </p>
                      <p className="text-xs text-subtle">
                        {dose.quantity} unit{dose.quantity === 1 ? '' : 's'}
                      </p>
                    </div>
                    <StatusPill status={dose.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={CalendarClock}
                title="No upcoming doses"
                description="This medicine has no future reminders — it may be as-needed, paused or finished."
              />
            )}
          </Card>
        </div>
      ) : null}

      {/* -------------------------------- stock -------------------------------- */}
      {tab === 'stock' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6">
            <Card>
              <CardHeader icon={Package} title="On hand" />
              <CardBody>
                <p className="text-3xl font-semibold tabular-nums text-content">
                  {medicine.stock.quantity}
                  <span className="ml-2 text-base font-normal text-subtle">{medicine.stock.unit}</span>
                </p>
                <p className="mt-2 text-sm text-muted">
                  Low-stock alert at {medicine.stock.lowStockThreshold} {medicine.stock.unit}
                </p>
                {low ? (
                  <Notice tone="warning" className="mt-4" icon={TrendingDown}>
                    This is at or below your threshold. Record a refill when you buy more.
                  </Notice>
                ) : null}
              </CardBody>
            </Card>

            <Card>
              <CardHeader icon={Plus} title="Record a stock change" />
              <CardBody>
                <form className="space-y-3" onSubmit={handleStockSubmit}>
                  <Select
                    label="Type"
                    value={refill.type}
                    onChange={(event) => setRefill((prev) => ({ ...prev, type: event.target.value }))}
                  >
                    <option value="refill">Refill / purchase (+)</option>
                    <option value="adjustment">Correction (± from a count)</option>
                    <option value="correction">Data-error correction</option>
                    <option value="expired-removal">Remove expired stock (−)</option>
                  </Select>
                  <Input
                    label={refill.type === 'refill' ? 'Quantity added' : 'Quantity change (negative removes)'}
                    type="number"
                    step="0.5"
                    placeholder="20"
                    value={refill.quantityChange}
                    onChange={(event) => setRefill((prev) => ({ ...prev, quantityChange: event.target.value }))}
                  />
                  <Textarea
                    label="Reason (optional)"
                    rows={2}
                    placeholder="e.g. Picked up from the pharmacy"
                    value={refill.reason}
                    onChange={(event) => setRefill((prev) => ({ ...prev, reason: event.target.value }))}
                  />
                  <Button type="submit" fullWidth loading={stockMutation.isPending}>
                    Save stock change
                  </Button>
                </form>
                <p className="hint mt-3">
                  Stock can never go below zero, and dose deductions are recorded automatically.
                </p>
              </CardBody>
            </Card>
          </div>

          <Card className="lg:col-span-2">
            <CardHeader
              icon={History}
              title="Stock ledger"
              description="Every change, newest first, with the quantity after each entry."
            />
            {stockHistory.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle">
                      <th className="px-5 py-2.5 font-medium sm:px-6">When</th>
                      <th className="px-3 py-2.5 font-medium">Type</th>
                      <th className="px-3 py-2.5 text-right font-medium">Change</th>
                      <th className="px-3 py-2.5 text-right font-medium">After</th>
                      <th className="px-5 py-2.5 font-medium sm:px-6">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border-y">
                    {stockHistory.map((row) => (
                      <tr key={row._id}>
                        <td className="whitespace-nowrap px-5 py-2.5 text-muted sm:px-6">
                          {formatDateTime(row.createdAt)}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge tone={row.type === 'dose' ? 'info' : row.quantityChange > 0 ? 'success' : 'muted'}>
                            {row.type}
                          </Badge>
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right tabular-nums ${row.quantityChange < 0 ? 'text-danger' : 'text-success'}`}
                        >
                          {row.quantityChange > 0 ? '+' : ''}
                          {row.quantityChange}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-content">{row.resultingQuantity}</td>
                        <td className="px-5 py-2.5 text-subtle sm:px-6">{row.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={Package} title="No stock changes yet" />
            )}
          </Card>
        </div>
      ) : null}

      {/* ------------------------------- history ------------------------------- */}
      {tab === 'history' ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <StatCard label="Taken" value={history.taken ?? 0} tone="success" />
            <StatCard label="Skipped" value={history.skipped ?? 0} />
            <StatCard label="Missed" value={history.missed ?? 0} tone={history.missed ? 'danger' : 'default'} />
            <StatCard label="Pending" value={history.pending ?? 0} tone="info" />
          </div>

          <Card>
            <CardHeader
              icon={History}
              title="Dose history"
              description="What you recorded for this medicine. This is a record of your entries, not proof of ingestion."
              action={
                <Button as={Link} to="/app/reports" variant="ghost" size="sm">
                  Full reports
                </Button>
              }
            />
            {doseHistory?.length ? (
              <ul className="divide-border-y">
                {doseHistory.map((dose) => (
                  <li key={dose._id} className="flex items-center justify-between px-5 py-3 sm:px-6">
                    <span className="text-sm text-content">{formatDateTime(dose.scheduledFor)}</span>
                    <StatusPill status={dose.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={History}
                title="No doses recorded yet"
                description="Dose entries appear here once you start recording them from the Doses page."
                action={
                  <Button as={Link} to="/app/doses" variant="secondary">
                    Go to doses
                  </Button>
                }
              />
            )}
          </Card>
        </div>
      ) : null}

      {/* --------------------------- medicine information ---------------------- */}
      {tab === 'info' ? (
        <div className="space-y-6">
          <Notice tone="neutral" icon={Info} title="Reference information only">
            This section is reference material about the medicine itself. It is not a diagnosis, a
            prescription, or a recommendation for you. Always check with a pharmacist or doctor.
          </Notice>

          {infoQuery.isLoading ? (
            <Card>
              <CardBody className="space-y-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </CardBody>
            </Card>
          ) : infoQuery.isError ? (
            <ErrorState error={infoQuery.error} onRetry={infoQuery.refetch} />
          ) : (
            <>
              {infoQuery.data.info.available ? (
                <Card>
                  <CardHeader
                    icon={BookOpen}
                    title="Composition & details"
                    description={
                      infoQuery.data.info.source
                        ? `Source: ${infoQuery.data.info.source}`
                        : undefined
                    }
                    action={
                      infoQuery.data.info.sourceUrl ? (
                        <Button
                          as="a"
                          href={infoQuery.data.info.sourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          variant="ghost"
                          size="sm"
                        >
                          View source
                        </Button>
                      ) : null
                    }
                  />
                  <CardBody>
                    <DefinitionList
                      items={[
                        { label: 'Generic name', value: infoQuery.data.info.genericName || '—' },
                        { label: 'Matched as', value: infoQuery.data.info.matchedName || '—' },
                        {
                          label: 'Match confidence',
                          value:
                            infoQuery.data.info.matchConfidence != null
                              ? `${Math.round(infoQuery.data.info.matchConfidence * 100)}%`
                              : '—',
                        },
                        {
                          label: 'Active ingredients',
                          value: infoQuery.data.info.ingredients.length
                            ? infoQuery.data.info.ingredients.join(', ')
                            : 'Not available from the configured source',
                        },
                        {
                          label: 'Brand / related names',
                          value: infoQuery.data.info.brandNames.length
                            ? infoQuery.data.info.brandNames.join(', ')
                            : 'Not available from the configured source',
                        },
                        {
                          label: 'Common side effects',
                          value: infoQuery.data.info.commonSideEffects.length
                            ? infoQuery.data.info.commonSideEffects.join(', ')
                            : 'Not published by the configured source',
                        },
                        { label: 'Retrieved', value: formatDateTime(infoQuery.data.info.retrievedAt) },
                      ]}
                    />
                    {infoQuery.data.info.unavailableFields?.length ? (
                      <p className="hint mt-4">
                        Not available from this source: {infoQuery.data.info.unavailableFields.join(', ')}.
                        MediTrack does not fill gaps with guesswork.
                      </p>
                    ) : null}
                  </CardBody>
                </Card>
              ) : (
                <Card>
                  <CardBody>
                    <Notice tone="neutral" icon={Info} title="No reliable information available">
                      {infoQuery.data.info.unavailableReason ||
                        'MediTrack could not find a trustworthy match for this medicine.'}
                    </Notice>
                  </CardBody>
                </Card>
              )}

              {infoQuery.data.allergyMatches?.length ? (
                <Card className="border-warning/40">
                  <CardHeader
                    icon={ShieldAlert}
                    title="Matches an allergy you recorded"
                    description="This is your own record being echoed back — it is not a diagnosis or a prediction."
                  />
                  <ul className="divide-border-y">
                    {infoQuery.data.allergyMatches.map((match) => (
                      <li key={match.allergyId} className="px-5 py-4 sm:px-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-content">{match.allergen}</p>
                          <Badge tone={match.severity === 'severe' ? 'danger' : 'warning'}>
                            You recorded: {match.severity}
                          </Badge>
                          {match.reaction ? <Badge tone="muted">{match.reaction}</Badge> : null}
                        </div>
                        <p className="mt-2 text-sm text-muted">{match.guidance}</p>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              <Card>
                <CardHeader icon={AlertTriangle} title="What MediTrack will not do" />
                <ul className="space-y-2.5 px-5 py-4 text-sm text-muted sm:px-6">
                  {Object.entries(infoQuery.data.disclaimers || {}).map(([key, text]) => (
                    <li key={key} className="flex gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-subtle" aria-hidden="true" />
                      {text}
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </div>
      ) : null}

      <MedicineFormModal open={editOpen} onClose={() => setEditOpen(false)} medicine={medicine} />

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => archiveMutation.mutate()}
        loading={archiveMutation.isPending}
        title={`Archive ${medicine.name}?`}
        description="Future reminders stop immediately. All dose history, stock entries and reports are kept."
        confirmLabel="Archive medicine"
      />

      <p className="mt-8 text-xs text-subtle">
        Last updated {dayjs(medicine.updatedAt).fromNow?.() ?? formatDate(medicine.updatedAt)}
      </p>
    </>
  );
}

export default MedicineDetailPage;
