import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { ProtectedRoute, AppAccessRoute, WelcomeModal, AuthCallback, ResetPassword } from '@battleplans/ui';
import Login from './pages/Login.tsx';
import HomePage from './pages/HomePage.tsx';
import PackEditor from './pages/PackEditor.tsx';
import ComponentGallery from './pages/ComponentGallery.tsx';
import PublicPack from './pages/PublicPack.tsx';
import LandingPage from './marketing/pages/LandingPage.tsx';
import StoresPage from './marketing/pages/StoresPage.tsx';

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
 * permanently reserved against slugs — currently app, login, auth, gallery and
 * stores.
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/*
          ── Public routes ──

          The root used to bounce straight to /app or /login. It now serves the
          marketing page to everyone, signed in or not — the app itself lives at
          /app, and a signed-in organiser landing on battlepack.app should be
          able to read the page they'd send to their shop rather than being
          redirected past it. Reverting means restoring the old RootRedirect,
          which resolved the session and then <Navigate>d.

          /stores is the second marketing page, and adding it PERMANENTLY
          RESERVED the word "stores" against pack slugs. Three other places had
          to learn about it and all four have to agree: the reserved list in
          `battlepack_reserved_slugs()` (20260825000000), the rewrite in
          vercel.json that must not send this path to the social-preview
          function, and CLAUDE.md where the rule is written down.
        */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/stores" element={<StoresPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/reset-password" element={<ResetPassword className="bg-gray-950" />} />

        {/* Component gallery — dev tool, not a user-facing screen */}
        <Route path="/gallery" element={<ComponentGallery />} />

        {/* ── Protected routes — redirect unauthenticated users to /login,
               then gate on the user's platform access level ── */}
        {appRoutes()}

        {/* ── A published pack, at the root ──
            LAST, and deliberately. This is a catch-all: every path above is
            permanently reserved against slugs, and React Router matches the
            more specific route first, so `app`, `login`, `auth`, `gallery` and
            `stores` keep working. Adding a new top-level route silently makes
            that word unusable as a slug — the DB trigger rejects the reserved
            list, so
            add it there too or an organiser can claim a URL that will never
            resolve. */}
        <Route path="/:slug" element={<PublicPack />} />
      </Routes>
    </BrowserRouter>
  );
}
