/**
 * App.tsx — Root component and router
 *
 * This is the top-level component that React renders first.
 * It defines all the routes (URLs) in the app and maps each
 * one to the appropriate page component.
 *
 * Current routes:
 * - /                              → Auth-aware redirect (→ /login or /app)
 * - /login                         → Pre-login screen (sign in / continue as guest)
 * - /gallery                       → Component gallery (dev tool — not a user-facing screen)
 * - /app                           → App home
 * - /app/builder/blood-bowl        → Blood Bowl card builder
 * - /app/builder/halo-flashpoint   → Halo Flashpoint card builder
 * - /app/builder/kill-team         → Kill Team card builder
 * - /app/builder/starcraft         → StarCraft card builder (scaffolding)
 * - /app/print                     → Print deck preview
 *
 * As new pages are designed and built, import them here and add a
 * corresponding <Route> inside the <Routes> block.
 */

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import ComponentGallery from './pages/ComponentGallery';
import CardBuilderBloodBowl from './pages/CardBuilderBloodBowl';
import CardBuilderHaloFlashpoint from './pages/CardBuilderHaloFlashpoint';
import CardBuilderKillTeam from './pages/CardBuilderKillTeam';
import CardBuilderStarcraft from './pages/CardBuilderStarcraft';
import PrintDeck from './pages/PrintDeck';
import Login from './pages/Login';
import AppHome from './pages/AppHome';
import AuthCallback from './pages/AuthCallback';

// ── Root redirect ─────────────────────────────────────────────────────────
// Checks auth state and sends the user to /login or /app accordingly.

function RootRedirect() {
  const [target, setTarget] = useState<'/app' | '/login' | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setTarget(session ? '/app' : '/login');
    });
  }, []);

  if (!target) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <p className="font-body text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  return <Navigate to={target} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Root — redirect based on auth state ── */}
        <Route path="/" element={<RootRedirect />} />

        {/* ── Login ── */}
        <Route path="/login" element={<Login />} />

        {/* ── Component Gallery (dev tool) ── */}
        <Route path="/gallery" element={<ComponentGallery />} />

        {/* ── App home ── */}
        <Route path="/app" element={<AppHome />} />

        {/* ── OAuth callback — handles Google redirect ── */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* ── Card Builder — Blood Bowl ── */}
        <Route path="/app/builder/blood-bowl" element={<CardBuilderBloodBowl />} />

        {/* ── Card Builder — Halo Flashpoint ── */}
        <Route path="/app/builder/halo-flashpoint" element={<CardBuilderHaloFlashpoint />} />

        {/* ── Card Builder — Kill Team ── */}
        <Route path="/app/builder/kill-team" element={<CardBuilderKillTeam />} />

        {/* ── Card Builder — StarCraft ── */}
        <Route path="/app/builder/starcraft" element={<CardBuilderStarcraft />} />

        {/* ── Print Deck ── */}
        <Route path="/app/print" element={<PrintDeck />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
