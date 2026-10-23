import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cx } from '../../lib/format';

export function PageHeader({ title, description, breadcrumbs = [], actions, className, children }) {
  return (
    <header className={cx('mb-6', className)}>
      {breadcrumbs.length ? (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-subtle">
            {breadcrumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {index > 0 ? <ChevronRight className="h-3 w-3" aria-hidden="true" /> : null}
                {crumb.to ? (
                  <Link to={crumb.to} className="transition-colors hover:text-content">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-muted">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-content sm:text-2xl">{title}</h1>
          {description ? <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {children}
    </header>
  );
}

export default PageHeader;
