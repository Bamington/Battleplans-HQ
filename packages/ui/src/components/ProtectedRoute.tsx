import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Props {
  children: React.ReactNode;
}

/**
 * Route guard for authenticated-only pages. Renders its children only when a
 * Supabase session exists; otherwise redirects to /login. While the session is
 * still being restored from storage it shows a lightweight loading screen.
 */
export default function ProtectedRoute({ children }: Props) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    // onAuthStateChange fires immediately with INITIAL_SESSION once the Supabase
    // client has restored the session from storage. Using it instead of
    // getSession() avoids the race where getSession() resolves null before the
    // session is fully hydrated.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!cancelled) setAuthed(!!session);
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <p className="font-body text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
