/**
 * AuthCallback.tsx — OAuth redirect handler
 *
 * Supabase redirects here after a successful Google OAuth flow.
 * With PKCE + detectSessionInUrl enabled, the Supabase client automatically
 * exchanges the code in the URL for a session. This page just waits for that
 * to complete and then sends the user into the app.
 *
 * Route: /auth/callback
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check whether the session is already established (fast path).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/app', { replace: true });
        return;
      }

      // Otherwise wait for Supabase to finish processing the URL code.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          subscription.unsubscribe();
          navigate('/app', { replace: true });
        }
      });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <p className="font-body text-sm text-gray-400">Signing you in…</p>
    </div>
  );
}
