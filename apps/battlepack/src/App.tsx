import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { supabase, ProtectedRoute, AppAccessRoute, WelcomeModal, AuthCallback, ResetPassword } from '@battleplans/ui';
import Login from './pages/Login.tsx';
import HomePage from './pages/HomePage.tsx';
import PackEditor from './pages/PackEditor.tsx';
import ComponentGallery from './pages/ComponentGallery.tsx';

/**
 * The app's own screens, as a route subtree.
 *
 * Exported so the native BattlePlan HQ shell can mount it alongside the other
 * apps' subtrees. HQ shows one app at a time, so these paths don't need
 * prefixing — `/app` means whichever app is currently mounted. Public routes
 * (/login, /auth/*) stay out: HQ owns one copy for all the apps.
 *
 * The pack editor will live at /app/<packId>/edit — keyed by the row id rather
 * than the slug, so it is stable, works for drafts that have no slug yet, and
 * never breaks when the slug is set on publish. The public page for a published
 * pack is a separate, later thing: battlepack.app/<slug>, at the root. That
 * namespace is shared with the app's own routes, so anything added here is
 * permanently reserved against slugs — currently app, login, auth and gallery.
 */
export function appRoutes() {
  return (
    <Route element={
      <ProtectedRoute>
        <AppAccessRoute appName="BattlePack">
          <WelcomeModal appName="BattlePack" fields={{ username: true }} />
          <Outlet />
        </AppAccessRoute>
      </ProtectedRoute>
    }>
      <Route path="/app" element={<HomePage />} />
      <Route path="/app/:packId/edit" element={<PackEditor />} />
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

        {/* Component gallery — dev tool, not a user-facing screen */}
        <Route path="/gallery" element={<ComponentGallery />} />

        {/* ── Protected routes — redirect unauthenticated users to /login,
               then gate on the user's platform access level ── */}
        {appRoutes()}
      </Routes>
    </BrowserRouter>
  );
}
