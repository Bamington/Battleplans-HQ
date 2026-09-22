import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { ProtectedRoute, AppAccessRoute, WelcomeModal, AuthCallback, ResetPassword } from '@battleplans/ui';
import Login from './pages/Login.tsx';
import HomePage from './pages/HomePage.tsx';
import BattleStatsPage from './pages/BattleStatsPage.tsx';
import StoreStatsPage from './pages/StoreStatsPage.tsx';
import ManageStore from './pages/ManageStore.tsx';
import AdminPage from './pages/AdminPage.tsx';
import ManageUsers from './pages/admin/ManageUsers.tsx';
import ManageLocations from './pages/admin/ManageLocations.tsx';
import ManageGames from './pages/admin/ManageGames.tsx';
import ManageUpdates from './pages/admin/ManageUpdates.tsx';
import ComponentGallery from './pages/ComponentGallery.tsx';
import LandingPage from './marketing/pages/LandingPage.tsx';
import { VENUE_REGIONS_FLOW } from './welcomeFlows.tsx';
import VenuePage from './marketing/pages/VenuePage.tsx';

/**
 * The app's own screens, as a route subtree.
 *
 * Exported so the native BattlePlan HQ shell can mount it alongside the other
 * apps' subtrees without this file's paths changing: HQ shows one app at a
 * time, so `/app` means whichever app is currently mounted. Keeping this as the
 * single definition means the standalone web build below and the HQ build can't
 * drift apart.
 *
 * Public routes (/login, /auth/*) deliberately stay out of it — HQ owns one
 * copy of those for all three apps.
 */
export function appRoutes() {
  return (
    <Route element={
      <ProtectedRoute>
        <AppAccessRoute appName="BattlePlan">
          <WelcomeModal appName="BattlePlan" flow={VENUE_REGIONS_FLOW} />
          <Outlet />
        </AppAccessRoute>
      </ProtectedRoute>
    }>
      <Route path="/app" element={<HomePage />} />
      <Route path="/app/stats" element={<BattleStatsPage />} />
      <Route path="/app/store-stats" element={<StoreStatsPage />} />
      <Route path="/app/manage-store" element={<ManageStore />} />
      <Route path="/app/admin" element={<AdminPage />} />
      <Route path="/app/admin/users" element={<ManageUsers />} />
      <Route path="/app/admin/locations" element={<ManageLocations />} />
      <Route path="/app/admin/games" element={<ManageGames />} />
      <Route path="/app/admin/updates" element={<ManageUpdates />} />
    </Route>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/*
          ── Public routes ──

          The root used to bounce straight to /app or /login. It now serves the
          marketing page to everyone, signed in or not — the app itself lives at
          /app, and a signed-in user landing on battleplan.app should be able to
          read the page they'd send to a friend rather than being redirected past
          it. Reverting to the old behaviour means restoring RootRedirect here.
        */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/venue" element={<VenuePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback className="bg-neutral-950" />} />
        <Route path="/auth/reset-password" element={<ResetPassword className="bg-neutral-950" />} />

        {/* Component gallery — dev tool, not a user-facing screen */}
        <Route path="/gallery" element={<ComponentGallery />} />

        {/* ── Protected routes — redirect unauthenticated users to /login,
               then gate on the user's platform access level ── */}
        {appRoutes()}
      </Routes>
    </BrowserRouter>
  );
}
