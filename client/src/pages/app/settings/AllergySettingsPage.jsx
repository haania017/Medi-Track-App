import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldAlert, Trash2 } from 'lucide-react';
import api, { qs } from '../../../lib/api';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input, Select, Textarea } from '../../../components/ui/Field';
import { Badge, MemberAvatar } from '../../../components/ui/Misc';
import { EmptyState, ErrorState, LoadingBlock, Notice } from '../../../components/ui/Feedback';
import { Modal, ConfirmDialog } from '../../../components/ui/Overlay';
import { useToast } from '../../../context/ToastProvider';
import { useWorkspace } from '../../../context/WorkspaceProvider';
import { formatDate } from '../../../lib/format';

const SEVERITIES = [
  { value: 'unknown', label: 'Not sure' },
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
];

const TYPES = [
  { value: 'drug', label: 'Medicine' },
  { value: 'ingredient', label: 'Ingredient' },
  { value: 'food', label: 'Food' },
  { value: 'other', label: 'Other' },
];

export function AllergySettingsPage() {
  const { profiles, activeProfile } = useWorkspace();
  const client = useQueryClient();
  const toast = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({
    allergen: '',
    allergenType: 'drug',
    severity: 'unknown',
    reaction: '',
    notes: '',
    profileId: activeProfile?.id || '',
  });

  const listQuery = useQuery({
    queryKey: ['allergies', activeProfile?.id],
    queryFn: () => api.get(`/allergies${qs({ profileId: activeProfile?.id })}`),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/allergies', payload),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['allergies'] });
      toast.success('Allergy recorded.');
      setAddOpen(false);
      setForm({ allergen: '', allergenType: 'drug', severity: 'unknown', reaction: '', notes: '', profileId: activeProfile?.id || '' });
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/allergies/${id}`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['allergies'] });
      toast.success('Allergy record removed.');
      setDeleting(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const allergies = listQuery.data?.data ?? [];
  const disclaimer = listQuery.data?.meta?.disclaimer;

  return (
    <div className="space-y-6">
      <Notice tone="warning" icon={ShieldAlert} title="These are notes you write yourself">
        MediTrack does not diagnose allergies, cannot tell whether a medicine caused a symptom, and will never
        predict an allergy from a photo. If a reliable ingredient source is configured, a recorded allergy is
        shown as a reminder when you open that medicine's information — clearly labelled as your own record.
      </Notice>

      <Card>
        <CardHeader
          icon={ShieldAlert}
          title="Recorded allergies"
          description={
            activeProfile ? `Showing the person you are viewing (${activeProfile.name}) plus general records.` : undefined
          }
          action={
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Record allergy
            </Button>
          }
        />

        {listQuery.isLoading ? (
          <CardBody>
            <LoadingBlock rows={2} />
          </CardBody>
        ) : listQuery.isError ? (
          <ErrorState error={listQuery.error} onRetry={listQuery.refetch} />
        ) : allergies.length ? (
          <ul className="divide-border-y">
            {allergies.map((allergy) => {
              const owner = profiles.find((p) => p.id === allergy.profileId);
              return (
                <li key={allergy._id} className="flex flex-wrap items-start gap-3 px-5 py-4 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-content">{allergy.allergen}</p>
                      <Badge tone={allergy.severity === 'severe' ? 'danger' : allergy.severity === 'moderate' ? 'warning' : 'muted'}>
                        {SEVERITIES.find((s) => s.value === allergy.severity)?.label || allergy.severity}
                      </Badge>
                      <Badge tone="muted">
                        {TYPES.find((t) => t.value === allergy.allergenType)?.label || allergy.allergenType}
                      </Badge>
                    </div>
                    {allergy.reaction ? (
                      <p className="mt-1 text-sm text-muted">Reaction: {allergy.reaction}</p>
                    ) : null}
                    {allergy.notes ? <p className="mt-1 text-xs text-subtle">{allergy.notes}</p> : null}
                    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-subtle">
                      {owner ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MemberAvatar name={owner.name} color={owner.color} size={14} />
                          {owner.name}
                        </span>
                      ) : (
                        <span>General (all profiles)</span>
                      )}
                      <span>· recorded {formatDate(allergy.recordedAt)}</span>
                    </p>
                  </div>
                  <Button
                    variant="danger-ghost"
                    size="icon-sm"
                    aria-label={`Delete ${allergy.allergen}`}
                    onClick={() => setDeleting(allergy)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={ShieldAlert}
            title="No allergies recorded"
            description="Add anything you already know about — this is your own note, not a diagnosis."
            action={
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Record an allergy
              </Button>
            }
          />
        )}
      </Card>

      {disclaimer ? <p className="hint">{disclaimer}</p> : null}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Record an allergy"
        description="Write down something you already know. MediTrack stores it exactly as you enter it."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button
              loading={createMutation.isPending}
              disabled={!form.allergen.trim()}
              onClick={() =>
                createMutation.mutate({
                  allergen: form.allergen,
                  allergenType: form.allergenType,
                  severity: form.severity,
                  reaction: form.reaction || undefined,
                  notes: form.notes || undefined,
                  profileId: form.profileId || null,
                })
              }
            >
              Save allergy
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="What is the allergy?"
            placeholder="e.g. Penicillin"
            value={form.allergen}
            onChange={(event) => setForm((prev) => ({ ...prev, allergen: event.target.value }))}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Type"
              value={form.allergenType}
              onChange={(event) => setForm((prev) => ({ ...prev, allergenType: event.target.value }))}
            >
              {TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
            <Select
              label="How serious was it?"
              value={form.severity}
              onChange={(event) => setForm((prev) => ({ ...prev, severity: event.target.value }))}
            >
              {SEVERITIES.map((severity) => (
                <option key={severity.value} value={severity.value}>
                  {severity.label}
                </option>
              ))}
            </Select>
          </div>
          <Select
            label="Who is this about?"
            value={form.profileId}
            onChange={(event) => setForm((prev) => ({ ...prev, profileId: event.target.value }))}
            hint="Choose “Applies to everyone” if it is not specific to one person."
          >
            <option value="">Applies to everyone</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </Select>
          <Input
            label="Reaction (optional)"
            placeholder="e.g. Rash, swelling"
            value={form.reaction}
            onChange={(event) => setForm((prev) => ({ ...prev, reaction: event.target.value }))}
          />
          <Textarea
            label="Notes (optional)"
            rows={2}
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
          <Notice tone="neutral">
            For a severe allergy, always tell your pharmacist and doctor. In an emergency, contact your local
            emergency service.
          </Notice>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleteMutation.mutate(deleting._id)}
        loading={deleteMutation.isPending}
        title={`Remove "${deleting?.allergen}"?`}
        description="The record you wrote is deleted. This does not change any medicine or prescription."
        confirmLabel="Remove record"
      />
    </div>
  );
}

export default AllergySettingsPage;
