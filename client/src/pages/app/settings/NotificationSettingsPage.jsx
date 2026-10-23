import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing, Info } from 'lucide-react';
import api from '../../../lib/api';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { FieldRow } from '../../../components/ui/Field';
import { Toggle, Badge } from '../../../components/ui/Misc';
import { Notice } from '../../../components/ui/Feedback';
import { useToast } from '../../../context/ToastProvider';
import { useAuth } from '../../../context/AuthProvider';

const PREFERENCES = [
  { key: 'doseReminder', label: 'Regular dose reminders', hint: 'When a scheduled dose is due' },
  { key: 'missedDose', label: 'Missed-dose alerts', hint: 'When a dose passes without being recorded' },
  { key: 'lowStock', label: 'Low-stock and refill alerts', hint: 'When stock reaches your threshold' },
  { key: 'expiry', label: 'Expiry alerts', hint: '30, 7 and 1 day before an expiry date' },
  { key: 'carePlanReview', label: 'Care-plan review alerts', hint: 'When a temporary plan is due for review' },
];

export function NotificationSettingsPage() {
  const { user, setUser } = useAuth();
  const client = useQueryClient();
  const toast = useToast();

  const pushQuery = useQuery({
    queryKey: ['push-subscription'],
    queryFn: () => api.data('/users/me/push-subscription'),
  });

  const saveMutation = useMutation({
    mutationFn: (payload) => api.patch('/users/me/preferences', { notificationPreferences: payload }),
    onSuccess: (payload) => {
      setUser(payload.data.user);
      client.setQueryData(['auth', 'me'], { user: payload.data.user });
      toast.success('Notification preferences saved.');
    },
    onError: (error) => toast.error(error.message),
  });

  const prefs = user?.notificationPreferences || {};
  const push = pushQuery.data || { configured: false, subscriptions: 0 };

  const setPref = (key, value) => saveMutation.mutate({ [key]: value });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          icon={Bell}
          title="What you are told about"
          description="These apply to every profile you can access. Per-person sharing is controlled in the Family hub."
          action={<Badge tone={prefs.inApp === false ? 'danger' : 'success'}>{prefs.inApp === false ? 'In-app off' : 'In-app on'}</Badge>}
        />
        <CardBody className="pt-0">
          <FieldRow
            label="In-app notifications"
            hint="Show alerts in the notification centre and the bell menu."
          >
            <Toggle
              checked={prefs.inApp !== false}
              disabled={saveMutation.isPending}
              onChange={(checked) => setPref('inApp', checked)}
              label="In-app notifications"
            />
          </FieldRow>

          <div className="border-t border-border">
            {PREFERENCES.map((pref) => (
              <FieldRow key={pref.key} label={pref.label} hint={pref.hint}>
                <Toggle
                  checked={prefs[pref.key] !== false}
                  disabled={saveMutation.isPending || prefs.inApp === false}
                  onChange={(checked) => setPref(pref.key, checked)}
                  label={pref.label}
                />
              </FieldRow>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          icon={BellRing}
          title="Device notifications (Web Push)"
          description="Optional: also deliver alerts to this browser, even when MediTrack is closed."
          action={
            <Badge tone={push.configured ? 'success' : 'muted'}>
              {push.configured ? 'Server ready' : 'Not configured'}
            </Badge>
          }
        />
        <CardBody className="space-y-4">
          {push.configured ? (
            <Notice tone="info" icon={BellRing}>
              Push is available on this server. Browsers require HTTPS (or localhost) before they will accept a
              subscription — subscribe from the device you want alerts on.
            </Notice>
          ) : (
            <Notice tone="neutral" icon={Info} title="Push is not enabled on this server">
              No VAPID keys are configured, so notifications stay in-app. Everything still works — including
              marking a dose taken straight from a notification. The README explains how to generate keys and
              turn push on.
            </Notice>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!push.configured}>
              {push.subscriptions ? 'Update this device' : 'Enable on this device'}
            </Button>
            {push.subscriptions ? (
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await api.del('/users/me/push-subscription', { body: {} });
                    pushQuery.refetch();
                    toast.success('This device will no longer receive push notifications.');
                  } catch (error) {
                    toast.error(error.message);
                  }
                }}
              >
                Disable on this device
              </Button>
            ) : null}
          </div>
          <p className="hint">
            {push.subscriptions
              ? `${push.subscriptions} device subscription${push.subscriptions === 1 ? '' : 's'} saved for this account.`
              : 'No device subscriptions saved for this account.'}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

export default NotificationSettingsPage;
