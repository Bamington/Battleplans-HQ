import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { supabase, ProtectedRoute, WelcomeModal } from '@battleplans/ui';
import Login from './pages/Login.tsx';
import AuthCallback from './pages/AuthCallback.tsx';
import HomePage from './pages/HomePage.tsx';
import BattleStatsPage from './pages/BattleStatsPage.tsx';
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
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* ── Protected routes — redirect unauthenticated users to /login ── */}
        <Route element={
          <ProtectedRoute>
            <WelcomeModal appName="BattlePlan" fields={{ username: true, preferredLocation: true }} />
            <Outlet />
          </ProtectedRoute>
        }>
          <Route path="/app" element={<HomePage />} />
          <Route path="/app/stats" element={<BattleStatsPage />} />
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
