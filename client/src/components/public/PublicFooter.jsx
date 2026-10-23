import { Link } from 'react-router-dom';
import { HeartPulse } from 'lucide-react';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Family care', href: '/#family' },
      { label: 'FAQ', href: '/#faq' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Log in', to: '/login' },
      { label: 'Create an account', to: '/signup' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Your rights', to: '/user-rights' },
      { label: 'Contact & support', to: '/user-rights#contact' },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface-2/60">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2">
            <Link to="/" className="flex items-center gap-2.5 text-content">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-fg">
                <HeartPulse className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-base font-semibold tracking-tight">MediTrack</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              A calm, private place to organise medicines, schedules, stock, expiry dates and family
              reminders — and to keep everyone who helps out on the same page.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold text-content">{column.title}</h3>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link to={link.to} className="text-sm text-muted transition-colors hover:text-content">
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className="text-sm text-muted transition-colors hover:text-content">
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs leading-relaxed text-subtle">
            <strong className="font-semibold text-muted">Important:</strong> MediTrack is a record-keeping
            tool. It does not diagnose illness, prescribe treatment, or decide whether a medicine is safe
            for you. Everything in your records is entered and confirmed by you. Always follow the advice of
            a qualified healthcare professional, and speak to a pharmacist about expired medicines.
          </p>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-subtle">
            © {new Date().getFullYear()} MediTrack. A demonstration project — not a live medical service.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-xs text-subtle">
            <Link to="/privacy" className="transition-colors hover:text-content">
              Privacy policy
            </Link>
            <Link to="/terms" className="transition-colors hover:text-content">
              Terms of use
            </Link>
            <span>Support: contact form (placeholder)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default PublicFooter;
