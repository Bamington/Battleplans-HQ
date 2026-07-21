import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { supabase, ProtectedRoute, AppAccessRoute, WelcomeModal, AuthCallback, ResetPassword } from '@battleplans/ui';
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

function RootRedirect() {
  const [target, setTarget] = useState<'/app' | '/login' | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setTarget(session ? '/app' : '/login');
    });
  }, []);

  if (target === null) return null;
  return <Navigate to={target} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public routes ── */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback className="bg-neutral-950" />} />
        <Route path="/auth/reset-password" element={<ResetPassword className="bg-neutral-950" />} />

        {/* ── Protected routes — redirect unauthenticated users to /login,
               then gate on the user's platform access level ── */}
        <Route element={
          <ProtectedRoute>
            <AppAccessRoute appName="BattlePlan">
              <WelcomeModal appName="BattlePlan" fields={{ username: true, preferredLocation: true, bookingEmailNote: true }} />
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
      </Routes>
    </BrowserRouter>
  );
}
