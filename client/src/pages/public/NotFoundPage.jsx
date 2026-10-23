import { Link } from 'react-router-dom';
import { Home, SearchX } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-subtle">
        <SearchX className="h-7 w-7" aria-hidden="true" />
      </span>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-accent">404</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-content">We couldn't find that page</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
        The link may be broken, or the page may have moved. Head back to the homepage, or sign in to pick up
        where you left off.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button as={Link} to="/">
          <Home className="h-4 w-4" aria-hidden="true" />
          Back to homepage
        </Button>
        <Button as={Link} to="/app" variant="secondary">
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}

export default NotFoundPage;
