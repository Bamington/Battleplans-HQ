import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Button from './Button';

/**
 * AuthCallback.tsx — where Supabase returns the user after an auth flow.
 *
 * Google OAuth and email confirmation links both land here. With PKCE +
 * detectSessionInUrl the client exchanges the code in the URL for a session on
 * its own; this page waits for that to land and then sends the user into the
 * app.
 *
 * Two things it does beyond waiting:
 *   - Surfaces failures. Supabase reports a refused or expired flow as
 *     ?error=/#error= and never emits a session, so the previous version sat on
 *     "Signing you in…" indefinitely with no way out.
 *   - Routes recovery links to /auth/reset-password. A reset link signs the
 *     user in, which otherwise looks identical to a normal login and dropped
 *     them into the app without ever changing their password.
 *
 * Lived as three identical copies (one per app) until the apps needed the same
 * fixes; it's shared now so they can't drift.
 *
 * Route: /auth/callback
 */

// Supabase has either given us a session or an error long before this. Past it,
// something went wrong that we can't see — don't leave the user staring.
const SESSION_WAIT_MS = 10000;

const GENERIC_ERROR = "We couldn't finish signing you in. Please try again.";

interface Props {
  /** Page background, so the page matches the app it's rendered in. */
  className?: string;
  /** Where to send the user once they're signed in. */
  redirectTo?: string;
}

/** Reads the auth error Supabase reports in either the query string or hash. */
function readAuthError(): string | null {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const code = search.get('error') ?? hash.get('error');
  if (!code) return null;
  const description = search.get('error_description') ?? hash.get('error_description');
  return description ? description.replace(/\+/g, ' ') : GENERIC_ERROR;
}

export default function AuthCallback({ className = 'bg-gray-950', redirectTo = '/app' }: Props) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const urlError = readAuthError();
    if (urlError) {
      setError(urlError);
      return;
    }

    let settled = false;
    const finish = (to: string) => {
      if (settled) return;
      settled = true;
      navigate(to, { replace: true });
    };

    // A session can already be in place by the time this mounts — on native the
    // deep-link handler does the code exchange itself, and on web a fast
    // detectSessionInUrl can beat the first render. Either way the auth event
    // has been and gone, so waiting only for the next one would stall until the
    // timeout. Recovery is unaffected: those links route straight to
    // /auth/reset-password and never reach this screen.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) finish(redirectTo);
    });

    // PASSWORD_RECOVERY arrives with the session when the user followed a reset
    // link, which is the only reliable way to tell the two apart — the URL has
    // usually been scrubbed by the client before this component mounts.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        finish('/auth/reset-password');
      } else if (session) {
        finish(redirectTo);
      }
    });

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        setError(GENERIC_ERROR);
      }
    }, SESSION_WAIT_MS);

    return () => {
      settled = true;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [navigate, redirectTo]);

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-3 ${className}`}>
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg shadow-md w-full md:w-[450px] p-5 flex flex-col gap-4">
          <h1 className="font-heading text-white text-[19.8px] leading-7">Sign-in failed</h1>
          <p className="font-body text-base text-neutral-300 leading-6">{error}</p>
          <Button className="w-full" variant="outline" color="secondary" type="button" onClick={() => navigate('/login', { replace: true })}>
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center ${className}`}>
      <p className="font-body text-sm text-neutral-400">Signing you in…</p>
    </div>
  );
}
