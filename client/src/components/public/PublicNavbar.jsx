import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { HeartPulse, Menu, X } from 'lucide-react';
import { ThemeMenu } from '../app/ThemeMenu';
import { Button } from '../ui/Button';
import { cx } from '../../lib/format';

const LINKS = [
  { to: '/#features', label: 'Features' },
  { to: '/#about', label: 'About' },
  { to: '/#how-it-works', label: 'How it works' },
  { to: '/#family', label: 'Family care' },
  { to: '/#support', label: 'Support' },
];

export function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header
      className={cx(
        'sticky top-0 z-40 border-b transition-colors',
        scrolled ? 'border-border bg-nav/85 backdrop-blur-md' : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 rounded-xl py-1 text-content">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-fg">
            <HeartPulse className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold tracking-tight">MediTrack</span>
        </Link>

        <nav aria-label="Public" className="ml-6 hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <a
              key={link.to}
              href={link.to}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-content"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <ThemeMenu compact />
          <Button as={NavLink} to="/login" variant="ghost" size="sm">
            Log in
          </Button>
          <Button as={NavLink} to="/signup" size="sm">
            Sign up
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:hidden">
          <ThemeMenu compact />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted"
          >
            {open ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-border bg-nav px-4 py-3 sm:hidden">
          <nav aria-label="Public mobile" className="flex flex-col gap-0.5">
            {LINKS.map((link) => (
              <a
                key={link.to}
                href={link.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-content"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
            <Button as={NavLink} to="/login" variant="secondary" fullWidth>
              Log in
            </Button>
            <Button as={NavLink} to="/signup" fullWidth>
              Sign up
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export default PublicNavbar;
