import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Settings, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthProvider';
import { useToast } from '../../context/ToastProvider';
import { Popover, MenuItem, MenuLabel, MenuSeparator } from '../ui/Popover';
import { MemberAvatar } from '../ui/Misc';
import { initials } from '../../lib/format';

export function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Signed out.');
      navigate('/', { replace: true });
    } catch (error) {
      toast.error(error.message);
    }
  };

  const displayName = user?.name || 'Account';
  const fallbackColor = user?.appearance?.resolvedMode === 'dark' ? '#fafafa' : '#111827';

  return (
    <Popover
      label="Account"
      panelClassName="w-60"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Account menu"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-2 pr-2.5 transition-colors hover:bg-surface-2"
        >
          <MemberAvatar name={displayName} color={fallbackColor} size={24} />
          <ChevronDown className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
        </button>
      )}
    >
      {({ close }) => (
        <>
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-content">{displayName}</p>
            <p className="truncate text-xs text-subtle">{user?.email}</p>
          </div>
          <MenuSeparator />
          <MenuLabel>Settings</MenuLabel>
          <MenuItem icon={UserIcon} onClick={() => { navigate('/app/settings/profile'); close(); }}>
            Profile & timezone
          </MenuItem>
          <MenuItem icon={Settings} onClick={() => { navigate('/app/settings/appearance'); close(); }}>
            Appearance
          </MenuItem>
          <MenuItem icon={ShieldCheck} onClick={() => { navigate('/app/settings/privacy'); close(); }}>
            Privacy & security
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={LogOut} tone="danger" onClick={handleLogout}>
            Sign out
          </MenuItem>
          <p className="px-3 pb-1 pt-2 text-[11px] text-subtle">Signed in as {initials(displayName) || '—'}</p>
        </>
      )}
    </Popover>
  );
}

export default AccountMenu;
