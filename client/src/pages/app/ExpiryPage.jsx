import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, CalendarOff, CalendarX, Plus } from 'lucide-react';
import api, { qs } from '../../lib/api';
import { PageHeader } from '../../components/app/PageHeader';
import { MedicineFormModal } from '../../components/app/MedicineFormModal';
import { PronounceButton } from '../../components/app/PronounceButton';
import { Card, CardHeader, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Field';
import { Badge, MemberAvatar, Tabs } from '../../components/ui/Misc';
import { EmptyState, ErrorState, LoadingBlock, Notice } from '../../components/ui/Feedback';
import { useWorkspace } from '../../context/WorkspaceProvider';
import { daysUntil, expiryLabel, formatDate } from '../../lib/format';

const WINDOWS = [
  { value: '7', label: 'Next 7 days' },
  { value: '30', label: 'Next 30 days' },
  { value: '90', label: 'Next 90 days' },
];

export function ExpiryPage() {
  const { activeProfile, profiles } = useWorkspace();
  const [tab, setTab] = useState('expiring');
  const [days, setDays] = useState('30');
  const [profileFilter, setProfileFilter] = useState(activeProfile?.id || '');
  const [addOpen, setAddOpen] = useState(false);

  const reportQuery = useQuery({
    queryKey: ['reports', 'expiry', days, profileFilter],
    queryFn: () => api.data(`/reports/expiry?days=${days}${qs({ profileId: profileFilter })}`),
  });

  if (reportQuery.isLoading) {
    return (
      <>
        <PageHeader title="Expiry" />
        <LoadingBlock rows={4} />
      </>
    );
  }

  if (reportQuery.isError) {
    return (
      <>
        <PageHeader title="Expiry" />
        <ErrorState error={reportQuery.error} onRetry={reportQuery.refetch} />
      </>
    );
  }

  const report = reportQuery.data ?? { expiring: [], expired: [], missingExpiry: [], counts: {} };
  const lists = {
    expiring: report.expiring ?? [],
    missing: report.missingExpiry ?? [],
    expired: report.expired ?? [],
  };
  const list = lists[tab] ?? [];

  return (
    <>
      <PageHeader
        title="Expiry tracking"
        description="Warnings at 30, 7 and 1 day before an expiry date you recorded, a separate list of missing dates, and what has already expired."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add medicine
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`Expiring in ${days} days`}
          value={report.counts.expiring ?? 0}
          tone={report.counts.expiring ? 'warning' : 'default'}
          icon={CalendarClock}
        />
        <StatCard
          label="Missing expiry date"
          value={report.counts.missingExpiry ?? 0}
          tone={report.counts.missingExpiry ? 'warning' : 'default'}
          icon={CalendarOff}
        />
        <StatCard
          label="Already expired"
          value={report.counts.expired ?? 0}
          tone={report.counts.expired ? 'danger' : 'default'}
          icon={CalendarX}
        />
        <StatCard label="Profiles covered" value={profiles.length} icon={AlertTriangle} />
      </div>

      <Card className="mt-6">
        <CardHeader
          icon={CalendarClock}
          title="Medicines by expiry"
          description="Filter by person, and choose how far ahead to look."
        />
        <div className="grid gap-4 border-b border-border px-5 py-4 sm:px-6 sm:grid-cols-2">
          <Select label="Person" value={profileFilter} onChange={(event) => setProfileFilter(event.target.value)}>
            <option value="">Everyone</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </Select>
          <Select label="Window" value={days} onChange={(event) => setDays(event.target.value)}>
            {WINDOWS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="px-5 py-3 sm:px-6">
          <Tabs
            tabs={[
              { value: 'expiring', label: 'Expiring soon', count: lists.expiring.length },
              { value: 'missing', label: 'Missing expiry', count: lists.missing.length },
              { value: 'expired', label: 'Expired', count: lists.expired.length },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>

        {list.length ? (
          <ul className="divide-border-y">
            {list.map((medicine) => {
              const isMissing = !medicine.expiryDate;
              const remaining = daysUntil(medicine.expiryDate);
              const meta = expiryLabel(medicine.expiryDate);
              return (
                <li key={medicine.id} className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <Link
                        to={`/app/medicines/${medicine.id}`}
                        className="text-sm font-medium text-content underline-offset-4 hover:underline"
                      >
                        {medicine.name} {medicine.strength}
                      </Link>
                      <PronounceButton text={medicine.name} />
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-subtle">
                      {medicine.profileId ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MemberAvatar
                            name={medicine.profileId.name}
                            color={medicine.profileId.color}
                            size={14}
                          />
                          {medicine.profileId.name}
                        </span>
                      ) : null}
                      <span>
                        {isMissing ? '· no expiry date recorded' : `· expires ${formatDate(medicine.expiryDate)}`}
                      </span>
                      <span>· {medicine.stock.quantity} {medicine.stock.unit} on hand</span>
                    </p>
                  </div>
                  {isMissing ? (
                    <Badge tone="warning">No expiry date</Badge>
                  ) : (
                    <Badge tone={remaining < 0 ? 'danger' : remaining <= 7 ? 'danger' : 'warning'}>
                      {remaining < 0 ? `${Math.abs(remaining)} days ago` : meta.label}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={tab === 'expiring' ? CalendarClock : tab === 'missing' ? CalendarOff : CalendarX}
            title={
              tab === 'expiring'
                ? 'Nothing expiring soon'
                : tab === 'missing'
                  ? 'Every medicine has an expiry date'
                  : 'Nothing has expired'
            }
            description={
              tab === 'expiring'
                ? `No medicines with a recorded expiry date fall within the next ${days} days.`
                : tab === 'missing'
                  ? 'Medicines you save without an expiry date appear here until you record one. A missing date is never treated as expired.'
                  : 'Expired medicines appear here so you can set them aside.'
            }
          />
        )}
      </Card>

      <Notice tone="warning" className="mt-6" icon={AlertTriangle} title="Please do not rely on an expiry date alone">
        {report.guidance ||
          'MediTrack does not decide whether an expired medicine is still safe. Ask a pharmacist or healthcare professional how to handle it.'}
        {' '}MediTrack never guesses a missing expiry date — if it is blank, it stays blank until you record it.
      </Notice>

      <MedicineFormModal open={addOpen} onClose={() => setAddOpen(false)} defaultProfileId={activeProfile?.id} />
    </>
  );
}

export default ExpiryPage;
