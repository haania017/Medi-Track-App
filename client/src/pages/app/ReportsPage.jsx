import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Download, Info, LineChart, Package } from 'lucide-react';
import api, { qs, downloadFile } from '../../lib/api';
import { PageHeader } from '../../components/app/PageHeader';
import { Card, CardBody, CardHeader, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Field';
import { Badge, MemberAvatar, ProgressBar } from '../../components/ui/Misc';
import { EmptyState, ErrorState, LoadingBlock, Notice } from '../../components/ui/Feedback';
import { useToast } from '../../context/ToastProvider';
import { useWorkspace } from '../../context/WorkspaceProvider';

const PERIODS = [
  { value: 'daily', label: 'Daily (last 30 days)' },
  { value: 'weekly', label: 'Weekly (last 12 weeks)' },
  { value: 'monthly', label: 'Monthly (last 12 months)' },
];

const STATUS_COLORS = {
  taken: 'rgb(var(--c-success))',
  skipped: 'rgb(var(--c-text-subtle))',
  missed: 'rgb(var(--c-danger))',
  pending: 'rgb(var(--c-info))',
};

export function ReportsPage() {
  const { activeProfile, profiles } = useWorkspace();
  const toast = useToast();
  const [period, setPeriod] = useState('weekly');
  const [profileFilter, setProfileFilter] = useState('');

  const adherenceQuery = useQuery({
    queryKey: ['reports', 'adherence', period, profileFilter],
    queryFn: () => api.data(`/reports/adherence?period=${period}${qs({ profileId: profileFilter })}`),
  });

  const stockQuery = useQuery({
    queryKey: ['reports', 'stock-history', profileFilter],
    queryFn: () => api.get(`/reports/stock-history?limit=25${qs({ profileId: profileFilter })}`),
  });

  const handleExport = async (path, filename) => {
    try {
      await downloadFile(path, filename);
      toast.success('Export started.');
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (adherenceQuery.isLoading) {
    return (
      <>
        <PageHeader title="Reports & history" />
        <LoadingBlock rows={4} />
      </>
    );
  }

  if (adherenceQuery.isError) {
    return (
      <>
        <PageHeader title="Reports & history" />
        <ErrorState error={adherenceQuery.error} onRetry={adherenceQuery.refetch} />
      </>
    );
  }

  const report = adherenceQuery.data ?? { summary: {}, buckets: [], byMedicine: [] };
  const summary = report.summary || {};
  const ledger = stockQuery.data?.data ?? [];

  const chartData = report.buckets.map((bucket) => ({
    name: bucket.bucket,
    Taken: bucket.taken,
    Skipped: bucket.skipped,
    Missed: bucket.missed,
  }));

  const pieData = [
    { name: 'Taken', value: summary.taken || 0, key: 'taken' },
    { name: 'Skipped', value: summary.skipped || 0, key: 'skipped' },
    { name: 'Missed', value: summary.missed || 0, key: 'missed' },
  ].filter((entry) => entry.value > 0);

  return (
    <>
      <PageHeader
        title="Reports & history"
        description="Summaries built from what you recorded. These are your entries — not proof that a medicine was taken, and not a medical assessment."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                handleExport(
                  `/reports/adherence?period=${period}${qs({ profileId: profileFilter })}&format=csv`,
                  `meditrack-adherence-${period}.csv`,
                )
              }
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export adherence
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                handleExport(
                  `/reports/stock-history${qs({ profileId: profileFilter })}&format=csv`,
                  'meditrack-stock-history.csv',
                )
              }
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export stock
            </Button>
          </>
        }
      />

      <Card className="mb-6">
        <CardHeader
          icon={BarChart3}
          title="Filters"
          description="Choose a period and, if you like, a single person. Only profiles you can access are listed."
        />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 sm:px-6">
          <Select label="Period" value={period} onChange={(event) => setPeriod(event.target.value)}>
            {PERIODS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select label="Person" value={profileFilter} onChange={(event) => setProfileFilter(event.target.value)}>
            <option value="">Everyone I can access</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Doses recorded" value={summary.total ?? 0} icon={BarChart3} />
        <StatCard label="Taken" value={summary.taken ?? 0} tone="success" />
        <StatCard label="Missed" value={summary.missed ?? 0} tone={summary.missed ? 'danger' : 'default'} />
        <StatCard
          label="Recorded adherence"
          value={summary.adherenceRate != null ? `${summary.adherenceRate}%` : '—'}
          hint="Taken ÷ (taken + skipped + missed)"
          tone="info"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            icon={LineChart}
            title="Recorded doses over time"
            description={`Grouped by ${period === 'daily' ? 'day' : period === 'weekly' ? 'week beginning' : 'month'}.`}
          />
          {chartData.length ? (
            <CardBody>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'rgb(var(--c-text-subtle))' }} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'rgb(var(--c-text-subtle))' }} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'rgb(var(--c-elevated))',
                        border: '1px solid rgb(var(--c-border))',
                        borderRadius: 12,
                        fontSize: 12,
                        color: 'rgb(var(--c-text))',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Taken" stackId="a" fill={STATUS_COLORS.taken} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Skipped" stackId="a" fill={STATUS_COLORS.skipped} />
                    <Bar dataKey="Missed" stackId="a" fill={STATUS_COLORS.missed} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          ) : (
            <EmptyState icon={BarChart3} title="No doses recorded in this period" />
          )}
        </Card>

        <Card>
          <CardHeader icon={BarChart3} title="Outcome split" />
          {pieData.length ? (
            <CardBody>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                      {pieData.map((entry) => (
                        <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} stroke="rgb(var(--c-surface))" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'rgb(var(--c-elevated))',
                        border: '1px solid rgb(var(--c-border))',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 space-y-1.5">
                {pieData.map((entry) => (
                  <li key={entry.key} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[entry.key] }}
                        aria-hidden="true"
                      />
                      {entry.name}
                    </span>
                    <span className="tabular-nums text-content">{entry.value}</span>
                  </li>
                ))}
              </ul>
              <p className="hint mt-3">Colours are paired with labels, so nothing depends on colour alone.</p>
            </CardBody>
          ) : (
            <EmptyState icon={BarChart3} title="Nothing recorded yet" />
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={BarChart3} title="By medicine" description="Where recorded doses were concentrated." />
          {report.byMedicine?.length ? (
            <ul className="divide-border-y">
              {report.byMedicine.slice(0, 10).map((row) => {
                const rate = row.total ? Math.round((row.taken / row.total) * 100) : 0;
                return (
                  <li key={row.medicineId} className="px-5 py-3.5 sm:px-6">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-content">
                        {row.name} {row.strength}
                      </p>
                      <Badge tone={rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'danger'}>{rate}% taken</Badge>
                    </div>
                    <ProgressBar className="mt-2" value={rate} tone={rate >= 80 ? 'success' : 'warning'} />
                    <p className="mt-1.5 text-xs text-subtle">
                      {row.taken} taken · {row.skipped} skipped · {row.missed} missed · {row.total} recorded
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={BarChart3} title="No medicine activity yet" />
          )}
        </Card>

        <Card>
          <CardHeader
            icon={Package}
            title="Recent stock changes"
            description="Refills, adjustments and dose deductions."
          />
          {ledger.length ? (
            <div className="max-h-[26rem] overflow-y-auto">
              <ul className="divide-border-y">
                {ledger.map((row) => (
                  <li key={row._id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-content">{row.medicineId?.name || 'Medicine'}</p>
                      <p className="flex items-center gap-1.5 text-xs text-subtle">
                        {row.profileId ? (
                          <>
                            <MemberAvatar name={row.profileId.name} color={row.profileId.color} size={14} />
                            {row.profileId.name} ·
                          </>
                        ) : null}
                        {new Date(row.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`text-sm tabular-nums ${row.quantityChange < 0 ? 'text-danger' : 'text-success'}`}
                    >
                      {row.quantityChange > 0 ? '+' : ''}
                      {row.quantityChange}
                    </span>
                    <Badge tone={row.type === 'dose' ? 'info' : 'muted'}>{row.type}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState icon={Package} title="No stock changes yet" />
          )}
        </Card>
      </div>

      <Notice tone="neutral" className="mt-6" icon={Info} title="How to read these numbers">
        {report.disclaimer ||
          'These summaries reflect only what was entered in MediTrack. They are not medical proof that a dose was taken, and they are not a clinical assessment.'}
        {profileFilter ? ` Filtered to ${profiles.find((p) => p.id === profileFilter)?.name || 'one person'}.` : ''}
        {activeProfile ? ' The person you are currently viewing is used for the medicine pages.' : ''}
      </Notice>
    </>
  );
}

export default ReportsPage;
