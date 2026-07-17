import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { supabase, ProtectedRoute, WelcomeModal } from '@battleplans/ui';
import Login from './pages/Login.tsx';
import AuthCallback from './pages/AuthCallback.tsx';
import HomePage from './pages/HomePage.tsx';
import AdminPage from './pages/admin/AdminPage.tsx';
import ManagePaintPacks from './pages/admin/ManagePaintPacks.tsx';
import PaintPackEditor from './pages/admin/PaintPackEditor.tsx';

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
            <WelcomeModal appName="BattleBox" fields={{ username: true }} />
            <Outlet />
          </ProtectedRoute>
        }>
          <Route path="/app" element={<HomePage />} />
          <Route path="/app/admin" element={<AdminPage />} />
          <Route path="/app/admin/paint-packs" element={<ManagePaintPacks />} />
          <Route path="/app/admin/paint-packs/:packId" element={<PaintPackEditor />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
