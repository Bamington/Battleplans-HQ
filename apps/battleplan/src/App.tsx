import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from '@battleplans/ui';
import Login from './pages/Login.tsx';
import AuthCallback from './pages/AuthCallback.tsx';
import HomePage from './pages/HomePage.tsx';
import AdminPage from './pages/AdminPage.tsx';
import ManageUsers from './pages/admin/ManageUsers.tsx';
import ManageLocations from './pages/admin/ManageLocations.tsx';
import ManageGames from './pages/admin/ManageGames.tsx';

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
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/app" element={<HomePage />} />
        <Route path="/app/admin" element={<AdminPage />} />
        <Route path="/app/admin/users" element={<ManageUsers />} />
        <Route path="/app/admin/locations" element={<ManageLocations />} />
        <Route path="/app/admin/games" element={<ManageGames />} />
      </Routes>
    </BrowserRouter>
  );
}
