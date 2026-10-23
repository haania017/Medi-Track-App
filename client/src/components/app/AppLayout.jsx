import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AlertTriangle, HeartPulse, Menu, X } from 'lucide-react';
import { PRIMARY_NAV } from './navItems';
import { ProfileSwitcher } from './ProfileSwitcher';
import { ThemeMenu } from './ThemeMenu';
import { AccountMenu } from './AccountMenu';
import { NotificationBell } from './NotificationBell';
import { useWorkspace } from '../../context/WorkspaceProvider';
import { Button } from '../ui/Button';
import { cx } from '../../lib/format';

function Brand({ onNavigate }) {
  return (
    <Link
      to="/app"
      onClick={onNavigate}
      className="flex items-center gap-2.5 rounded-xl px-1 py-1 text-content transition-opacity hover:opacity-85"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-fg">
        <HeartPulse className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="text-base font-semibold tracking-tight">MediTrack</span>
    </Link>
  );
}

function NavItems({ onNavigate }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {PRIMARY_NAV.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent-soft text-accent'
                  : 'text-muted hover:bg-surface-2 hover:text-content',
              )
            }
          >
            <Icon className="h-4.5 w-4.5 shrink-0" style={{ width: 18, height: 18 }} aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { profiles } = useWorkspace();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-bg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-nav lg:flex">
        <div className="px-4 py-4">
          <Brand />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <NavItems />
        </div>
        <div className="border-t border-border px-4 py-3">
          <p className="text-[11px] leading-snug text-subtle">
            MediTrack records what you enter. It does not diagnose conditions or replace medical advice.
          </p>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col border-r border-border bg-nav">
            <div className="flex items-center justify-between px-4 py-4">
              <Brand onNavigate={() => setMobileOpen(false)} />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="rounded-lg p-2 text-subtle transition-colors hover:bg-surface-2 hover:text-content"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
              <NavItems onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-nav/90 backdrop-blur supports-[backdrop-filter]:bg-nav/75">
          <div className="flex h-16 items-center gap-2 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-muted transition-colors hover:bg-surface-2 hover:text-content lg:hidden"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="lg:hidden">
              <Brand />
            </div>

            <div className="ml-auto flex items-center gap-2">
              {profiles.length > 1 ? <ProfileSwitcher /> : null}
              <ThemeMenu />
              <NotificationBell />
              <AccountMenu />
            </div>
          </div>
        </header>

        <main id="main-content" className="px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

/** Route-level error boundary content for permission errors. */
export function AccessDenied({ message }) {
  return (
    <div className="card card-pad text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-warning-soft text-warning">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-base font-semibold">You don't have access to this</h2>
      <p className="mt-1.5 text-sm text-muted">{message || 'Ask the family owner to grant you permission.'}</p>
      <Button as={Link} to="/app" className="mt-5">
        Back to dashboard
      </Button>
    </div>
  );
}

export default AppLayout;
