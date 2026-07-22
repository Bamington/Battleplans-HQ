import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import {
  supabase,
  AuthCallback,
  ResetPassword,
  useCurrentApp,
  setCurrentApp,
  type AppSlug,
} from '@battleplans/ui';

import { appRoutes as battleplanRoutes } from '@battleplans/battleplan';
import { appRoutes as battlecardsRoutes } from '@battleplans/battlecards';
import { appRoutes as battlebenchRoutes } from '@battleplans/battlebox';

import Login from '../../battleplan/src/pages/Login.tsx';

/**
 * App.tsx — the BattlePlan HQ shell.
 *
 * On the web the three apps are three origins, and the platform switcher moves
 * between them with a full page navigation. That model doesn't survive being
 * wrapped: inside a native shell the same navigation walks the user out of the
 * app and into a browser, which is what this replaces.
 *
 * HQ mounts exactly ONE app's route subtree at a time, chosen by the shared
 * currentApp store. Because only one is ever mounted, all three can keep their
 * existing absolute paths — BattlePlan's /app and BattleCards' /app never
 * collide, since only one of them exists at any moment. That's what lets HQ
 * exist without rewriting hundreds of links across three apps.
 *
 * The public routes (/login, /auth/*) are owned here, once, for all three.
 */

/** Each app's screens, keyed by the slug the switcher and the database use. */
const APP_ROUTES: Record<AppSlug, (() => React.ReactElement) | null> = {
  battleplan:  battleplanRoutes,
  battlecards: battlecardsRoutes,
  battlebox:   battlebenchRoutes,
  // Listed in platform_apps but has no screens yet; the switcher shows it as
  // "coming soon" and never routes here.
  battlepack:  null,
};

/** The app HQ opens on, and what it falls back to if an unknown slug is set. */
const DEFAULT_APP: AppSlug = 'battleplan';

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

/**
 * Keeps the mounted app and the URL honest about each other.
 *
 * Landing on a public route (a deep link back from an auth redirect, say) can
 * leave the store pointing at whichever app was last open, which is fine — but
 * the app must never be left unset, or the access gate and authRedirectTo have
 * nothing to resolve against.
 */
function useResolvedApp(): AppSlug {
  const current = useCurrentApp();

  useEffect(() => {
    if (!current) setCurrentApp(DEFAULT_APP);
  }, [current]);

  const slug = current ?? DEFAULT_APP;
  return APP_ROUTES[slug] ? slug : DEFAULT_APP;
}

function Shell() {
  const slug = useResolvedApp();
  const { pathname } = useLocation();

  // data-app drives the palette (see index.css). Applied to a wrapper rather
  // than <html> so it re-renders with the route rather than needing a DOM poke.
  return (
    <div data-app={slug} className="contents">
      <Routes key={slug}>
        {/* ── Public — one copy, shared by all three apps ── */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback className="bg-neutral-950" />} />
        <Route path="/auth/reset-password" element={<ResetPassword className="bg-neutral-950" />} />

        {/* ── The active app's screens ── */}
        {APP_ROUTES[slug]!()}

        {/* An unmatched path after an app switch means the old app had a screen
            the new one doesn't. Send them to its home rather than a blank page. */}
        <Route path="*" element={<Navigate to={pathname.startsWith('/app') ? '/app' : '/'} replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
