import { NavLink, Outlet } from 'react-router-dom';
import { Bell, Palette, ShieldCheck, ShieldAlert, UserCog } from 'lucide-react';
import { PageHeader } from '../../../components/app/PageHeader';
import { cx } from '../../../lib/format';

const SECTIONS = [
  { to: 'profile', label: 'Profile & timezone', icon: UserCog },
  { to: 'appearance', label: 'Appearance', icon: Palette },
  { to: 'notifications', label: 'Notifications', icon: Bell },
  { to: 'allergies', label: 'Allergies', icon: ShieldAlert },
  { to: 'privacy', label: 'Privacy & security', icon: ShieldCheck },
];

export function SettingsLayout() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Your account, how MediTrack looks, what you are told about, and the details you have recorded."
      />

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <nav aria-label="Settings sections" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface-2 p-1 lg:flex-col lg:overflow-visible">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <li key={section.to} className="shrink-0 lg:shrink">
                  <NavLink
                    to={section.to}
                    className={({ isActive }) =>
                      cx(
                        'flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive ? 'bg-surface text-content shadow-sm' : 'text-muted hover:text-content',
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {section.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </>
  );
}

export default SettingsLayout;
