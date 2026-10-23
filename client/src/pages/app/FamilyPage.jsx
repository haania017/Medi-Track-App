import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BellRing,
  Crown,
  Mail,
  Shield,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import api from '../../lib/api';
import { PageHeader } from '../../components/app/PageHeader';
import { Card, CardBody, CardHeader, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea, Checkbox, FieldRow } from '../../components/ui/Field';
import { Badge, MemberAvatar, StatusPill, Toggle } from '../../components/ui/Misc';
import { Modal, ConfirmDialog } from '../../components/ui/Overlay';
import { ErrorState, LoadingBlock, Notice } from '../../components/ui/Feedback';
import { useToast } from '../../context/ToastProvider';
import { useWorkspace } from '../../context/WorkspaceProvider';
import { MEMBER_TYPE_LABEL, cx } from '../../lib/format';

const PERMISSIONS = [
  { key: 'viewRecords', label: 'View records', hint: 'See medicines, doses, stock and reports' },
  { key: 'manageMedicines', label: 'Manage medicines', hint: 'Add, edit and archive medicines' },
  { key: 'markDoses', label: 'Record doses', hint: 'Mark doses taken, skipped or snoozed' },
  { key: 'manageStock', label: 'Manage stock', hint: 'Record refills and adjustments' },
  { key: 'manageCarePlans', label: 'Manage care plans', hint: 'Create, review and close plans' },
  { key: 'manageProfile', label: 'Manage profile', hint: 'Edit this person and their details' },
];

const SHARE_ALERTS = [
  { key: 'doseReminder', label: 'Regular dose reminders' },
  { key: 'missedDose', label: 'Missed-dose alerts' },
  { key: 'lowStock', label: 'Low-stock / refill alerts' },
  { key: 'expiry', label: 'Expiry alerts' },
  { key: 'carePlanReview', label: 'Care-plan review alerts' },
];

const COLORS = ['#111827', '#2563eb', '#059669', '#7c3aed', '#e11d48', '#d97706', '#0891b2', '#db2777'];

export function FamilyPage() {
  const { family, profiles, activeProfile, setActiveProfileId, refetch } = useWorkspace();
  const client = useQueryClient();
  const toast = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [memberType, setMemberType] = useState('managed');
  const [form, setForm] = useState({
    name: '',
    relationship: 'Child',
    invitedEmail: '',
    dateOfBirth: '',
    notes: '',
    color: COLORS[2],
  });
  const [removing, setRemoving] = useState(null);

  const familyQuery = useQuery({
    queryKey: ['families', family?.id],
    queryFn: () => api.data(`/families/${family.id}`),
    enabled: Boolean(family?.id),
  });

  const invitationsQuery = useQuery({
    queryKey: ['family-members', 'invitations'],
    queryFn: () => api.data('/family-members/invitations'),
  });

  const invalidateAll = () => {
    client.invalidateQueries({ queryKey: ['families'] });
    client.invalidateQueries({ queryKey: ['family-members'] });
    refetch();
  };

  const addMutation = useMutation({
    mutationFn: (payload) => api.post(`/families/${family.id}/members`, payload),
    onSuccess: (_payload, variables) => {
      invalidateAll();
      toast.success(
        variables.memberType === 'adult'
          ? 'Invitation created. They will see it when they sign in with that email.'
          : 'Profile added.',
      );
      setAddOpen(false);
      setForm({ name: '', relationship: 'Child', invitedEmail: '', dateOfBirth: '', notes: '', color: COLORS[2] });
    },
    onError: (error) => toast.error(error.message),
  });

  const permissionMutation = useMutation({
    mutationFn: ({ id, permissions }) => api.patch(`/family-members/${id}/permissions`, permissions),
    onSuccess: () => {
      invalidateAll();
      toast.success('Permissions updated.');
    },
    onError: (error) => toast.error(error.message),
  });

  const shareMutation = useMutation({
    mutationFn: ({ id, sharePreferences }) => api.patch(`/family-members/${id}`, { sharePreferences }),
    onSuccess: () => {
      invalidateAll();
      toast.success('Notification sharing updated.');
    },
    onError: (error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id) => api.del(`/family-members/${id}`),
    onSuccess: () => {
      invalidateAll();
      toast.success('Access removed.');
      setRemoving(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const acceptMutation = useMutation({
    mutationFn: (id) => api.post(`/family-members/${id}/accept`),
    onSuccess: () => {
      invalidateAll();
      toast.success('You are now connected to this family.');
    },
    onError: (error) => toast.error(error.message),
  });

  const members = familyQuery.data?.members ?? profiles;
  const isOwner = familyQuery.data?.isOwner ?? true;
  const invitations = invitationsQuery.data ?? [];

  return (
    <>
      <PageHeader
        title="Family hub"
        description="Each person keeps their own medicines, schedules, stock and history. Everyone else only sees what you allow."
        actions={
          isOwner ? (
            <Button onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Add a person
            </Button>
          ) : null
        }
      />

      {invitations.length ? (
        <Notice tone="info" icon={Mail} title="You have been invited to a family" className="mb-6">
          <ul className="mt-2 space-y-2">
            {invitations.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">
                  <strong className="font-semibold">{invite.familyName}</strong> as {invite.invitedAs}
                </span>
                <Button size="sm" loading={acceptMutation.isPending} onClick={() => acceptMutation.mutate(invite.id)}>
                  Accept and connect
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-subtle">
            Accepting shares your account with that family under the permissions the owner granted. You can
            leave at any time.
          </p>
        </Notice>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="People" value={members.length} icon={Users} />
        <StatCard
          label="Managed profiles"
          value={members.filter((m) => m.memberType === 'managed').length}
          hint="No separate login needed"
        />
        <StatCard
          label="Connected adults"
          value={members.filter((m) => m.memberType === 'adult').length}
          hint="Consent-based access"
        />
      </div>

      {familyQuery.isLoading ? (
        <LoadingBlock className="mt-6" rows={3} />
      ) : familyQuery.isError ? (
        <ErrorState className="mt-6" error={familyQuery.error} onRetry={familyQuery.refetch} />
      ) : (
        <div className="mt-6 space-y-4">
          {members.map((member) => {
            const isMe = member.memberType === 'owner';
            return (
              <Card key={member.id}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      {member.name}
                      {isMe ? (
                        <Badge tone="accent" icon={Crown}>
                          Owner
                        </Badge>
                      ) : null}
                    </span>
                  }
                  description={`${member.relationship} · ${MEMBER_TYPE_LABEL[member.memberType] || member.memberType}`}
                  action={
                    <div className="flex items-center gap-2">
                      <StatusPill status={member.status} />
                      {member.id !== activeProfile?.id ? (
                        <Button size="sm" variant="secondary" onClick={() => setActiveProfileId(member.id)}>
                          View as
                        </Button>
                      ) : (
                        <Badge tone="muted">Currently viewing</Badge>
                      )}
                    </div>
                  }
                  icon={() => <MemberAvatar name={member.name} color={member.color} size={36} />}
                />

                <CardBody className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
                    <Badge tone="muted">{member.activeMedicineCount ?? 0} active medicines</Badge>
                    {member.userId ? <Badge tone="muted">Linked account</Badge> : <Badge tone="muted">Managed profile</Badge>}
                    {member.invitedEmail ? <Badge tone="info">Invited {member.invitedEmail}</Badge> : null}
                  </div>

                  {isOwner && member.memberType !== 'owner' ? (
                    <>
                      <div>
                        <p className="label">Access permissions</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {PERMISSIONS.map((permission) => (
                            <Checkbox
                              key={permission.key}
                              label={permission.label}
                              hint={permission.hint}
                              checked={Boolean(member.permissions?.[permission.key])}
                              disabled={permissionMutation.isPending}
                              onChange={(event) =>
                                permissionMutation.mutate({
                                  id: member.id,
                                  permissions: { [permission.key]: event.target.checked },
                                })
                              }
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="label flex items-center gap-1.5">
                          <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
                          Alerts shared with this person
                        </p>
                        <div className="divide-border-y rounded-xl border border-border px-3">
                          {SHARE_ALERTS.map((alert) => (
                            <FieldRow key={alert.key} label={alert.label}>
                              <Toggle
                                checked={member.sharePreferences?.[alert.key] !== false}
                                disabled={shareMutation.isPending}
                                onChange={(checked) =>
                                  shareMutation.mutate({
                                    id: member.id,
                                    sharePreferences: { [alert.key]: checked },
                                  })
                                }
                                label={alert.label}
                              />
                            </FieldRow>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button variant="danger-ghost" size="sm" onClick={() => setRemoving(member)}>
                          <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                          Remove from family
                        </Button>
                      </div>
                    </>
                  ) : null}

                  {!isOwner && member.memberType === 'adult' && member.id === activeProfile?.id ? (
                    <Notice tone="neutral" icon={Shield}>
                      Your permissions are set by the family owner. You currently{' '}
                      {member.permissions?.manageMedicines ? 'can' : 'cannot'} manage medicines here.
                    </Notice>
                  ) : null}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Notice tone="neutral" className="mt-6" icon={Shield}>
        Everything is checked on the server for each request. A profile you have not been granted access to
        simply reports "not found", so nobody can reach another family's records by editing a URL.
      </Notice>

      {/* ------------------------------- add person ------------------------------ */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a person"
        description="Create a managed profile for someone you care for, or invite another adult to connect their own account."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={addMutation.isPending}>
              Cancel
            </Button>
            <Button
              loading={addMutation.isPending}
              disabled={!form.name.trim() || (memberType === 'adult' && !form.invitedEmail.trim())}
              onClick={() =>
                addMutation.mutate({
                  name: form.name,
                  relationship: form.relationship,
                  memberType,
                  color: form.color,
                  invitedEmail: memberType === 'adult' ? form.invitedEmail : undefined,
                  dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth).toISOString() : undefined,
                  notes: form.notes || undefined,
                })
              }
            >
              {memberType === 'adult' ? 'Send invitation' : 'Add profile'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'managed', label: 'Managed profile', hint: 'A child or someone you care for', icon: Users },
              { value: 'adult', label: 'Connect an adult', hint: 'They keep their own account', icon: UserPlus },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setMemberType(option.value);
                  setForm((prev) => ({ ...prev, relationship: option.value === 'adult' ? 'Family member' : 'Child' }));
                }}
                aria-pressed={memberType === option.value}
                className={cx(
                  'rounded-xl border p-3 text-left transition-colors',
                  memberType === option.value
                    ? 'border-accent/50 bg-accent-soft'
                    : 'border-border hover:bg-surface-2',
                )}
              >
                <option.icon className="h-4 w-4 text-accent" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium text-content">{option.label}</p>
                <p className="text-xs text-subtle">{option.hint}</p>
              </button>
            ))}
          </div>

          <Input
            label="Name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            required
            placeholder={memberType === 'adult' ? 'e.g. Imran' : 'e.g. Ayesha'}
          />

          <Select
            label="Relationship"
            value={form.relationship}
            onChange={(event) => setForm((prev) => ({ ...prev, relationship: event.target.value }))}
          >
            {['Child', 'Son', 'Daughter', 'Parent', 'Mother', 'Father', 'Spouse', 'Sibling', 'Family member', 'Carer', 'Self'].map(
              (option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ),
            )}
          </Select>

          {memberType === 'adult' ? (
            <Input
              label="Their email address"
              type="email"
              value={form.invitedEmail}
              onChange={(event) => setForm((prev) => ({ ...prev, invitedEmail: event.target.value }))}
              hint="They will see the invitation when they sign in with this email. They start with read-only access."
              required
            />
          ) : (
            <Input
              label="Date of birth (optional)"
              type="date"
              value={form.dateOfBirth}
              onChange={(event) => setForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
            />
          )}

          <div>
            <p className="label">Colour for notifications</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, color }))}
                  aria-label={`Use colour ${color}`}
                  aria-pressed={form.color === color}
                  className={cx(
                    'h-8 w-8 rounded-full border-2 transition-transform',
                    form.color === color ? 'scale-110 border-content' : 'border-transparent',
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <p className="hint mt-2">
              Used on their avatar and notifications, so it is always clear who an alert is about. Urgency is
              also shown as text, never by colour alone.
            </p>
          </div>

          <Textarea
            label="Notes (optional)"
            rows={2}
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            placeholder="Anything useful for other carers"
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => removeMutation.mutate(removing.id)}
        loading={removeMutation.isPending}
        title={`Remove ${removing?.name} from this family?`}
        description={
          removing?.memberType === 'adult'
            ? 'Their connected access is revoked immediately. Their own account and records are unaffected.'
            : 'The managed profile and its medicines are removed. This cannot be undone.'
        }
        confirmLabel="Remove"
      />
    </>
  );
}

export default FamilyPage;
