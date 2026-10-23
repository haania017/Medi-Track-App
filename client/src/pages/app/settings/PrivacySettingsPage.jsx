import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ShieldCheck, Trash2, UserX } from 'lucide-react';
import api from '../../../lib/api';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Overlay';
import { Badge, DefinitionList } from '../../../components/ui/Misc';
import { Notice } from '../../../components/ui/Feedback';
import { useToast } from '../../../context/ToastProvider';
import { useAuth } from '../../../context/AuthProvider';

export function PrivacySettingsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState('');

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: () => api.data('/health'),
    staleTime: 5 * 60 * 1000,
  });

  const deleteAccountMutation = useMutation({
    mutationFn: () => api.del('/users/me', { body: { password } }),
    onSuccess: async () => {
      setDeleteOpen(false);
      setPassword('');
      try {
        await logout();
      } catch {
        // The server already cleared the session cookie.
      }
      toast.success('Your account and its data have been deleted.');
      navigate('/', { replace: true });
    },
    onError: (error) => toast.error(error.message),
  });

  const health = healthQuery.data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          icon={ShieldCheck}
          title="How your records are protected"
          description="What the server enforces on every request."
        />
        <CardBody>
          <ul className="space-y-3 text-sm text-muted">
            {[
              'Every request is checked against the specific profile involved — ownership is never taken from the request body.',
              'A profile you have not been granted access to reports "not found", so families cannot probe each other.',
              'Passwords are hashed with bcrypt and never returned by the API.',
              'Session cookies are HttpOnly and marked SameSite.',
            ].map((line) => (
              <li key={line} className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          icon={AlertTriangle}
          title="Integrations on this server"
          description="Read directly from the API health check."
        />
        <CardBody>
          {health ? (
            <div className="space-y-4">
              <DefinitionList
                items={[
                  {
                    label: 'Medicine information source',
                    value: (
                      <span className="flex flex-wrap items-center gap-2">
                        {health.integrations.medicineInfo.provider}
                        <Badge tone={health.integrations.medicineInfo.configured ? 'success' : 'muted'}>
                          {health.integrations.medicineInfo.mode}
                        </Badge>
                      </span>
                    ),
                  },
                  {
                    label: 'Web Push',
                    value: (
                      <Badge tone={health.integrations.push.configured ? 'success' : 'muted'}>
                        {health.integrations.push.configured ? 'configured' : 'not configured'}
                      </Badge>
                    ),
                  },
                  { label: 'File storage', value: health.integrations.storage.driver },
                  { label: 'Database', value: health.database },
                ]}
              />
              <p className="hint">{health.integrations.medicineInfo.message}</p>
            </div>
          ) : (
            <p className="text-sm text-muted">Loading integration status…</p>
          )}
        </CardBody>
      </Card>

      <Card className="border-danger/30">
        <CardHeader
          icon={UserX}
          title="Delete your account and data"
          description="Permanently remove your account, the families you own, and everything in them."
        />
        <CardBody className="space-y-4">
          <p className="text-sm text-muted">
            This deletes the families you own along with their members, medicines, dose records, stock
            ledger, care plans and notifications. It revokes your access to other families and deletes your
            account. It cannot be undone.
          </p>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete my account
          </Button>
        </CardBody>
      </Card>

      <Notice tone="warning" icon={AlertTriangle} title="MediTrack does not make medical decisions">
        It does not diagnose illness, prescribe or change treatment, recommend alternative medicines, or
        decide whether a medicine is safe for you. For any medical concern, speak to a qualified healthcare
        professional. If you suspect a severe allergic reaction, seek urgent medical care immediately.
      </Notice>

      <Modal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setPassword('');
        }}
        title="Delete your account?"
        description="This is permanent. Enter your password to confirm."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteOpen(false);
                setPassword('');
              }}
              disabled={deleteAccountMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteAccountMutation.isPending}
              disabled={!password}
              onClick={() => deleteAccountMutation.mutate()}
            >
              Delete everything
            </Button>
          </>
        }
      >
        <Input
          label="Your password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint="Required so a signed-in session alone cannot erase your data."
        />
      </Modal>
    </div>
  );
}

export default PrivacySettingsPage;
