import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Package, PackageCheck, Plus, TrendingDown } from 'lucide-react';
import api, { qs } from '../../lib/api';
import { PageHeader } from '../../components/app/PageHeader';
import { Card, CardBody, CardHeader, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { Badge, MemberAvatar, ProgressBar, Tabs } from '../../components/ui/Misc';
import { Modal } from '../../components/ui/Overlay';
import { EmptyState, ErrorState, LoadingBlock, Notice } from '../../components/ui/Feedback';
import { useToast } from '../../context/ToastProvider';
import { useWorkspace } from '../../context/WorkspaceProvider';

export function StockPage() {
  const { activeProfile } = useWorkspace();
  const client = useQueryClient();
  const toast = useToast();

  const [tab, setTab] = useState('low');
  const [refilling, setRefilling] = useState(null);
  const [form, setForm] = useState({ quantityChange: '', reason: '', type: 'refill' });

  const summaryQuery = useQuery({
    queryKey: ['stock', 'summary', activeProfile?.id],
    queryFn: () => api.data(`/stock/summary${qs({ profileId: activeProfile?.id })}`),
  });

  const ledgerQuery = useQuery({
    queryKey: ['reports', 'stock-history', activeProfile?.id],
    queryFn: () => api.get(`/reports/stock-history?limit=50${activeProfile?.id ? `&profileId=${activeProfile.id}` : ''}`),
  });

  const refillMutation = useMutation({
    mutationFn: ({ medicineId, payload }) => api.post(`/medicines/${medicineId}/stock-transactions`, payload),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['stock'] });
      client.invalidateQueries({ queryKey: ['reports'] });
      client.invalidateQueries({ queryKey: ['medicines'] });
      client.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Stock updated.');
      setRefilling(null);
      setForm({ quantityChange: '', reason: '', type: 'refill' });
    },
    onError: (error) => toast.error(error.message),
  });

  const openRefill = (item) => {
    setRefilling(item);
    setForm({ quantityChange: '', reason: '', type: 'refill' });
  };

  const submitRefill = (event) => {
    event.preventDefault();
    const value = Number(form.quantityChange);
    if (!Number.isFinite(value) || value === 0) {
      toast.error('Enter a non-zero quantity.');
      return;
    }
    refillMutation.mutate({
      medicineId: refilling.medicineId,
      payload: {
        type: form.type,
        quantityChange: form.type === 'refill' ? Math.abs(value) : value,
        reason: form.reason || undefined,
      },
    });
  };

  if (summaryQuery.isLoading) {
    return (
      <>
        <PageHeader title="Stock & refills" />
        <LoadingBlock rows={4} />
      </>
    );
  }

  if (summaryQuery.isError) {
    return (
      <>
        <PageHeader title="Stock & refills" />
        <ErrorState error={summaryQuery.error} onRetry={summaryQuery.refetch} />
      </>
    );
  }

  const summary = summaryQuery.data ?? { lowStock: [], adequate: [], totalMedicines: 0, lowStockCount: 0 };
  const ledger = ledgerQuery.data?.data ?? [];
  const list = tab === 'low' ? summary.lowStock : summary.adequate;

  return (
    <>
      <PageHeader
        title="Stock & refills"
        description="How much is left, what needs buying, and every change that produced the current count."
        actions={
          <Button as={Link} to="/app/medicines" variant="secondary">
            All medicines
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Tracked medicines" value={summary.totalMedicines} icon={Package} />
        <StatCard
          label="Running low"
          value={summary.lowStockCount}
          tone={summary.lowStockCount ? 'warning' : 'default'}
          icon={TrendingDown}
        />
        <StatCard label="Healthy stock" value={summary.adequate.length} tone="success" icon={PackageCheck} />
      </div>

      <Card className="mt-6">
        <CardHeader
          icon={Package}
          title="Stock levels"
          description="Low-stock alerts are separate from expiry alerts."
        />
        <CardBody className="pb-0">
          <Tabs
            tabs={[
              { value: 'low', label: 'Needs attention', count: summary.lowStock.length },
              { value: 'ok', label: 'Healthy', count: summary.adequate.length },
            ]}
            value={tab}
            onChange={setTab}
          />
        </CardBody>

        {list.length ? (
          <ul className="divide-border-y">
            {list.map((item) => {
              const threshold = item.lowStockThreshold || 1;
              const pct = Math.min(100, Math.round((item.quantity / Math.max(threshold * 3, 1)) * 100));
              return (
                <li key={item.medicineId} className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/app/medicines/${item.medicineId}`}
                      className="text-sm font-medium text-content underline-offset-4 hover:underline"
                    >
                      {item.name} {item.strength}
                    </Link>
                    <p className="mt-0.5 text-xs text-subtle">
                      {item.quantity} {item.unit} on hand · alert at {threshold}
                    </p>
                    <ProgressBar
                      className="mt-2 max-w-xs"
                      value={pct}
                      tone={item.quantity <= threshold ? 'warning' : 'success'}
                      label=""
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={item.quantity <= threshold ? 'warning' : 'success'}>
                      {item.quantity <= threshold ? 'Low' : 'OK'}
                    </Badge>
                    <Button size="sm" variant="secondary" onClick={() => openRefill(item)}>
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Record refill
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={tab === 'low' ? PackageCheck : Package}
            title={tab === 'low' ? 'Nothing is running low' : 'No medicines with healthy stock'}
            description={
              tab === 'low'
                ? 'Every active medicine is above its low-stock threshold.'
                : 'Add stock to a medicine and it will appear here.'
            }
          />
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader
          icon={Package}
          title="Recent stock activity"
          description="Every refill, adjustment and dose deduction, newest first."
        />
        {ledger.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle">
                  <th className="px-5 py-2.5 font-medium sm:px-6">When</th>
                  <th className="px-3 py-2.5 font-medium">Medicine</th>
                  <th className="px-3 py-2.5 font-medium">For</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 text-right font-medium">Change</th>
                  <th className="px-5 py-2.5 text-right font-medium sm:px-6">After</th>
                </tr>
              </thead>
              <tbody className="divide-border-y">
                {ledger.map((row) => (
                  <tr key={row._id}>
                    <td className="whitespace-nowrap px-5 py-2.5 text-muted sm:px-6">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-content">{row.medicineId?.name || '—'}</td>
                    <td className="px-3 py-2.5">
                      {row.profileId ? (
                        <span className="inline-flex items-center gap-1.5 text-muted">
                          <MemberAvatar name={row.profileId.name} color={row.profileId.color} size={16} />
                          {row.profileId.name}
                        </span>
                      ) : (
                        '—'
                      )}
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
                    <td className="px-5 py-2.5 text-right tabular-nums text-content sm:px-6">
                      {row.resultingQuantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Package} title="No stock changes yet" description="Refills and adjustments appear here." />
        )}
      </Card>

      <Notice tone="neutral" className="mt-6">
        Low-stock warnings and expiry warnings are always handled separately, so a full but nearly-expired
        medicine still gets the right alert.
      </Notice>

      <Modal
        open={Boolean(refilling)}
        onClose={() => setRefilling(null)}
        title={`Stock change · ${refilling?.name || ''}`}
        description={`Currently ${refilling?.quantity} ${refilling?.unit} on hand.`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefilling(null)} disabled={refillMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={submitRefill} loading={refillMutation.isPending}>
              Save change
            </Button>
          </>
        }
      >
        <form className="space-y-3" onSubmit={submitRefill}>
          <Select
            label="Type"
            value={form.type}
            onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
          >
            <option value="refill">Refill / purchase (+)</option>
            <option value="adjustment">Correction (± from a count)</option>
            <option value="expired-removal">Remove expired stock (−)</option>
          </Select>
          <Input
            label={form.type === 'refill' ? 'Quantity added' : 'Quantity change'}
            type="number"
            step="0.5"
            value={form.quantityChange}
            onChange={(event) => setForm((prev) => ({ ...prev, quantityChange: event.target.value }))}
          />
          <Textarea
            label="Reason (optional)"
            rows={2}
            value={form.reason}
            onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
          />
        </form>
      </Modal>
    </>
  );
}

export default StockPage;
