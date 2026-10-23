import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, UserCog } from 'lucide-react';
import api from '../../../lib/api';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input, Select } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Feedback';
import { useToast } from '../../../context/ToastProvider';
import { useAuth } from '../../../context/AuthProvider';
import { listTimeZones } from '../../../lib/format';

export function ProfileSettingsPage() {
  const { user, setUser } = useAuth();
  const client = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState({ name: user?.name || '', timezone: user?.timezone || 'UTC' });
  const zones = listTimeZones();

  useEffect(() => {
    setForm({ name: user?.name || '', timezone: user?.timezone || 'UTC' });
  }, [user]);

  const saveMutation = useMutation({
    mutationFn: (payload) => api.patch('/users/me', payload),
    onSuccess: (payload) => {
      setUser(payload.data.user);
      client.setQueryData(['auth', 'me'], { user: payload.data.user });
      toast.success('Profile updated.');
    },
    onError: (error) => toast.error(error.message),
  });

  const passwordMutation = useMutation({
    mutationFn: (payload) => api.post('/users/me/password', payload),
    onSuccess: () => {
      toast.success('Password changed. Other sessions have been signed out.');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (error) => toast.error(error.message),
  });

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const submitPassword = (event) => {
    event.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('The new passwords do not match.');
      return;
    }
    passwordMutation.mutate({
      currentPassword: passwords.currentPassword,
      newPassword: passwords.newPassword,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          icon={UserCog}
          title="Profile"
          description="Your name and the timezone all reminder times are calculated in."
        />
        <CardBody className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <Input label="Email" value={user?.email || ''} disabled hint="Your email identifies your account and cannot be changed here." />
          <Select
            label="Timezone"
            value={form.timezone}
            onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
            hint="Dose times you enter are interpreted in this timezone."
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </Select>
          <Button
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate(form)}
            disabled={!form.name.trim()}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Save profile
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon={UserCog} title="Password" description="Change the password for this account." />
        <CardBody>
          <form className="space-y-4" onSubmit={submitPassword}>
            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={passwords.currentPassword}
              onChange={(event) => setPasswords((prev) => ({ ...prev, currentPassword: event.target.value }))}
              required
            />
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              hint="At least 8 characters, with a letter and a number."
              value={passwords.newPassword}
              onChange={(event) => setPasswords((prev) => ({ ...prev, newPassword: event.target.value }))}
              required
            />
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              value={passwords.confirmPassword}
              onChange={(event) => setPasswords((prev) => ({ ...prev, confirmPassword: event.target.value }))}
              required
            />
            <Button type="submit" loading={passwordMutation.isPending}>
              Change password
            </Button>
          </form>
          <Notice tone="neutral" className="mt-4">
            Changing your password signs out every other session. You will stay signed in here.
          </Notice>
        </CardBody>
      </Card>
    </div>
  );
}

export default ProfileSettingsPage;
