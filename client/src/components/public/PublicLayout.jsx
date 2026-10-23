import { Outlet } from 'react-router-dom';
import { PublicNavbar } from './PublicNavbar';
import { PublicFooter } from './PublicFooter';

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg"
      >
        Skip to content
      </a>
      <PublicNavbar />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}

export default PublicLayout;
