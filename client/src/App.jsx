import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { HeartPulse } from 'lucide-react';

import { PublicLayout } from './components/public/PublicLayout';
import { HomePage } from './pages/public/HomePage';
import { LoginPage } from './pages/public/LoginPage';
import { SignupPage } from './pages/public/SignupPage';
import { PrivacyPage } from './pages/public/PrivacyPage';
import { TermsPage } from './pages/public/TermsPage';
import { UserRightsPage } from './pages/public/UserRightsPage';
import { NotFoundPage } from './pages/public/NotFoundPage';

import { AppLayout } from './components/app/AppLayout';
import { DashboardPage } from './pages/app/DashboardPage';
import { DosesPage } from './pages/app/DosesPage';
import { MedicinesPage } from './pages/app/MedicinesPage';
import { MedicineDetailPage } from './pages/app/MedicineDetailPage';
import { StockPage } from './pages/app/StockPage';
import { ExpiryPage } from './pages/app/ExpiryPage';
import { CarePlansPage } from './pages/app/CarePlansPage';
import { FamilyPage } from './pages/app/FamilyPage';
import { ReportsPage } from './pages/app/ReportsPage';
import { NotificationsPage } from './pages/app/NotificationsPage';
import { SettingsLayout } from './pages/app/settings/SettingsLayout';
import { ProfileSettingsPage } from './pages/app/settings/ProfileSettingsPage';
import { AppearanceSettingsPage } from './pages/app/settings/AppearanceSettingsPage';
import { NotificationSettingsPage } from './pages/app/settings/NotificationSettingsPage';
import { PrivacySettingsPage } from './pages/app/settings/PrivacySettingsPage';
import { AllergySettingsPage } from './pages/app/settings/AllergySettingsPage';

import { useAuth } from './context/AuthProvider';
import { useTheme } from './theme/ThemeProvider';
import { WorkspaceProvider } from './context/WorkspaceProvider';
import { Skeleton } from './components/ui/Feedback';

/**
 * Apply the appearance saved on the account once the user is known.
 * Local storage stays the source of truth for instant paint; the server value
 * is merged in only when this device has no stored preference yet.
 */
function ThemeSync() {
  const { user } = useAuth();
  const { setTheme, mode, lightPalette, darkPalette } = useTheme();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current || !user?.appearance) return;
    applied.current = true;

    let stored = null;
    try {
      stored = localStorage.getItem('meditrack.theme');
    } catch {
      stored = null;
    }
    if (stored) return; // this device already has an explicit choice

    setTheme({
      mode: user.appearance.mode || mode,
      lightPalette: user.appearance.lightPalette || lightPalette,
      darkPalette: user.appearance.darkPalette || darkPalette,
    });
    // Runs once per session, intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return null;
}

function FullPageLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-fg">
        <HeartPulse className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="w-48 space-y-2">
        <Skeleton className="mx-auto h-3 w-32" />
        <Skeleton className="mx-auto h-3 w-24" />
      </div>
      <span className="sr-only" role="status">
        Loading MediTrack
      </span>
    </div>
  );
}

function RequireAuth({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

export function App() {
  return (
    <>
      <ThemeSync />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="user-rights" element={<UserRightsPage />} />
        </Route>

        <Route
          path="/app"
          element={
            <RequireAuth>
              <WorkspaceProvider>
                <AppLayout />
              </WorkspaceProvider>
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="doses" element={<DosesPage />} />
          <Route path="medicines" element={<MedicinesPage />} />
          <Route path="medicines/:medicineId" element={<MedicineDetailPage />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="expiry" element={<ExpiryPage />} />
          <Route path="care-plans" element={<CarePlansPage />} />
          <Route path="family" element={<FamilyPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="profile" replace />} />
            <Route path="profile" element={<ProfileSettingsPage />} />
            <Route path="appearance" element={<AppearanceSettingsPage />} />
            <Route path="notifications" element={<NotificationSettingsPage />} />
            <Route path="privacy" element={<PrivacySettingsPage />} />
            <Route path="allergies" element={<AllergySettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

export default App;
