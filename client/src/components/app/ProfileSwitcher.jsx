import { Check, ChevronDown, Users } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceProvider';
import { Popover, MenuLabel, MenuItem } from '../ui/Popover';
import { MemberAvatar } from '../ui/Misc';
import { MEMBER_TYPE_LABEL } from '../../lib/format';

/** Switch which family profile every page is showing. */
export function ProfileSwitcher() {
  const { profiles, activeProfile, setActiveProfileId } = useWorkspace();

  if (!profiles.length) return null;

  return (
    <Popover
      label="Switch profile"
      panelClassName="w-72"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          className="inline-flex h-10 max-w-[13rem] items-center gap-2 rounded-xl border border-border bg-surface px-2.5 text-sm transition-colors hover:bg-surface-2"
        >
          <MemberAvatar name={activeProfile?.name} color={activeProfile?.color} size={24} />
          <span className="min-w-0 flex-1 truncate text-left text-content">{activeProfile?.name || 'Select profile'}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
        </button>
      )}
    >
      {({ close }) => (
        <>
          <MenuLabel>Viewing</MenuLabel>
          {profiles.map((profile) => {
            const active = profile.id === activeProfile?.id;
            return (
              <MenuItem
                key={profile.id}
                onClick={() => {
                  setActiveProfileId(profile.id);
                  close();
                }}
              >
                <span className="flex items-center gap-2.5">
                  <MemberAvatar name={profile.name} color={profile.color} size={26} />
                  <span className="min-w-0">
                    <span className="block truncate">{profile.name}</span>
                    <span className="block truncate text-[11px] text-subtle">
                      {profile.relationship} · {MEMBER_TYPE_LABEL[profile.memberType] || profile.memberType}
                    </span>
                  </span>
                  {active ? <Check className="ml-auto h-4 w-4 shrink-0 text-accent" aria-hidden="true" /> : null}
                </span>
              </MenuItem>
            );
          })}
          <div className="mt-1 flex items-center gap-2 border-t border-border px-3 pt-2.5 pb-1 text-[11px] text-subtle">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Manage people in the Family hub</span>
          </div>
        </>
      )}
    </Popover>
  );
}

export default ProfileSwitcher;
