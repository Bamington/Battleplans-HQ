import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { supabase, ProtectedRoute, AppAccessRoute, WelcomeModal, AuthCallback, ResetPassword } from '@battleplans/ui';
import Login from './pages/Login.tsx';
import HomePage from './pages/HomePage.tsx';
import CollectionStatsPage from './pages/CollectionStatsPage.tsx';
import AdminPage from './pages/admin/AdminPage.tsx';
import ManagePaintPacks from './pages/admin/ManagePaintPacks.tsx';
import PaintPackEditor from './pages/admin/PaintPackEditor.tsx';

/**
 * The app's own screens, as a route subtree.
 *
 * Exported so the native BattlePlan HQ shell can mount it alongside the other
 * apps' subtrees. HQ shows one app at a time, so these paths don't need
 * prefixing — `/app` means whichever app is currently mounted. Public routes
 * (/login, /auth/*) stay out: HQ owns one copy for all three apps.
 */
export function appRoutes() {
  return (
    <Route element={
      <ProtectedRoute>
        <AppAccessRoute appName="BattleBench">
          <WelcomeModal appName="BattleBench" fields={{ username: true }} />
          <Outlet />
        </AppAccessRoute>
      </ProtectedRoute>
    }>
      <Route path="/app" element={<HomePage />} />
      <Route path="/app/stats" element={<CollectionStatsPage />} />
      <Route path="/app/admin" element={<AdminPage />} />
      <Route path="/app/admin/paint-packs" element={<ManagePaintPacks />} />
      <Route path="/app/admin/paint-packs/:packId" element={<PaintPackEditor />} />
    </Route>
  );
}

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
        <Route path="/auth/reset-password" element={<ResetPassword className="bg-gray-950" />} />

        {/* ── Protected routes — redirect unauthenticated users to /login,
               then gate on the user's platform access level ── */}
        {appRoutes()}
      </Routes>
    </BrowserRouter>
  );
}
