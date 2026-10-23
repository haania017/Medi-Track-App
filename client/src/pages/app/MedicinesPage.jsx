import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Filter, Package, Pencil, Pill, Plus, Search, SlidersHorizontal } from 'lucide-react';
import api, { qs } from '../../lib/api';
import { PageHeader } from '../../components/app/PageHeader';
import { MedicineFormModal } from '../../components/app/MedicineFormModal';
import { PronounceButton } from '../../components/app/PronounceButton';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Checkbox } from '../../components/ui/Field';
import { Badge, MemberAvatar, StatusPill, Tabs } from '../../components/ui/Misc';
import { EmptyState, ErrorState, LoadingBlock, Notice } from '../../components/ui/Feedback';
import { ConfirmDialog } from '../../components/ui/Overlay';
import { useToast } from '../../context/ToastProvider';
import { useWorkspace } from '../../context/WorkspaceProvider';
import { expiryLabel, formatDate, MEDICINE_FORMS } from '../../lib/format';

const STATUS_TABS = [
  { value: 'active,paused', label: 'Current' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'finished', label: 'Finished' },
  { value: 'archived', label: 'Archived' },
];

export function MedicinesPage() {
  const { activeProfile, profiles } = useWorkspace();
  const client = useQueryClient();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active,paused');
  const [form, setForm] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [profileFilter, setProfileFilter] = useState(activeProfile?.id || '');
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [archiving, setArchiving] = useState(null);

  const listQuery = useQuery({
    queryKey: ['medicines', { profileFilter, status, search, form, lowStockOnly }],
    queryFn: () =>
      api.get(
        `/medicines${qs({
          profileId: profileFilter,
          status,
          q: search || undefined,
          lowStock: lowStockOnly ? 'true' : undefined,
          limit: 100,
          sort: 'name',
        })}`,
      ),
  });

  const archiveMutation = useMutation({
    mutationFn: (id) => api.post(`/medicines/${id}/archive`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['medicines'] });
      client.invalidateQueries({ queryKey: ['doses'] });
      toast.success('Medicine archived. Past dose history was kept.');
      setArchiving(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const medicines = listQuery.data?.data ?? [];
  const visible = form ? medicines.filter((m) => m.form === form) : medicines;
  const showProfileColumn = !profileFilter;

  return (
    <>
      <PageHeader
        title="Medicines"
        description="Every medicine you track, with its schedule, stock and expiry. Open one to see its full history."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add medicine
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader
          icon={SlidersHorizontal}
          title="Filters"
          description="Narrow the list by person, status, form or stock level."
        />
        <div className="grid gap-4 px-5 py-4 sm:px-6 lg:grid-cols-4">
          <Input
            label="Search"
            placeholder="Name, strength or instructions"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            suffix={<Search className="h-4 w-4 text-subtle" aria-hidden="true" />}
          />
          <Select
            label="Person"
            value={profileFilter}
            onChange={(event) => setProfileFilter(event.target.value)}
          >
            <option value="">Everyone</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </Select>
          <Select label="Form" value={form} onChange={(event) => setForm(event.target.value)}>
            <option value="">Any form</option>
            {MEDICINE_FORMS.map((option) => (
              <option key={option} value={option}>
                {option[0].toUpperCase() + option.slice(1)}
              </option>
            ))}
          </Select>
          <div className="flex items-end pb-2.5">
            <Checkbox
              label="Only running low"
              checked={lowStockOnly}
              onChange={(event) => setLowStockOnly(event.target.checked)}
            />
          </div>
        </div>
        <div className="border-t border-border px-5 py-3 sm:px-6">
          <Tabs tabs={STATUS_TABS} value={status} onChange={setStatus} size="sm" />
        </div>
      </Card>

      {listQuery.isLoading ? (
        <LoadingBlock rows={4} />
      ) : listQuery.isError ? (
        <ErrorState error={listQuery.error} onRetry={listQuery.refetch} />
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Pill}
            title="No medicines match"
            description="Try clearing the filters, or add a medicine to get started."
            action={
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add a medicine
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((medicine) => {
            const expiry = expiryLabel(medicine.expiryDate);
            const low = medicine.stock.quantity <= (medicine.stock.lowStockThreshold ?? 0);
            return (
              <Card key={medicine.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <Link
                        to={`/app/medicines/${medicine.id}`}
                        className="block truncate text-base font-semibold text-content underline-offset-4 hover:underline"
                      >
                        {medicine.name}
                      </Link>
                      <PronounceButton text={medicine.name} />
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {medicine.strength ? `${medicine.strength} ${medicine.unit}` : '—'} ·{' '}
                      {medicine.form}
                    </p>
                  </div>
                  <StatusPill status={medicine.status} />
                </div>

                <div className="flex flex-wrap gap-1.5 px-5">
                  {showProfileColumn && medicine.profileId ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted">
                      <MemberAvatar name={medicine.profileId.name} color={medicine.profileId.color} size={16} />
                      {medicine.profileId.name}
                    </span>
                  ) : null}
                  <Badge tone={low ? 'warning' : 'muted'} icon={Package}>
                    {medicine.stock.quantity} {medicine.stock.unit}
                  </Badge>
                  {medicine.expiryDate ? (
                    <Badge tone={expiry.tone === 'danger' ? 'danger' : expiry.tone === 'warning' ? 'warning' : 'muted'}>
                      {expiry.tone === 'muted' ? `Expires ${formatDate(medicine.expiryDate, 'MMM YYYY')}` : expiry.label}
                    </Badge>
                  ) : (
                    <Badge tone="muted">No expiry date</Badge>
                  )}
                </div>

                {medicine.instructions ? (
                  <p className="mt-3 line-clamp-2 px-5 text-xs text-subtle">{medicine.instructions}</p>
                ) : null}

                <div className="mt-auto flex items-center gap-2 border-t border-border px-5 py-3">
                  <Button as={Link} to={`/app/medicines/${medicine.id}`} variant="secondary" size="sm">
                    Open
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(medicine)}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit
                  </Button>
                  {medicine.status !== 'archived' ? (
                    <Button
                      variant="danger-ghost"
                      size="sm"
                      className="ml-auto"
                      onClick={() => setArchiving(medicine)}
                    >
                      <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                      Archive
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {visible.length ? (
        <Notice tone="neutral" className="mt-6" icon={Filter}>
          Showing {visible.length} medicine{visible.length === 1 ? '' : 's'}. Archived medicines keep their dose
          history and stock ledger — archiving only stops future reminders.
        </Notice>
      ) : null}

      <MedicineFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        defaultProfileId={activeProfile?.id || profiles[0]?.id}
      />

      <MedicineFormModal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        medicine={editing}
      />

      <ConfirmDialog
        open={Boolean(archiving)}
        onClose={() => setArchiving(null)}
        onConfirm={() => archiveMutation.mutate(archiving.id)}
        loading={archiveMutation.isPending}
        title={`Archive ${archiving?.name}?`}
        description="Future reminders stop. Dose history, stock transactions and reports are preserved."
        confirmLabel="Archive medicine"
      />
    </>
  );
}

export default MedicinesPage;
