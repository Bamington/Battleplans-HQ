/**
 * useAuthStatus — is this device signed in, and is that knowable right now?
 *
 * The question "does the user have a session" has THREE answers, not two, and
 * collapsing the third into "no" is what had people signing in every few days.
 *
 * A session is kept in localStorage and never expires on the server — the
 * live database shows sessions surviving idle gaps of fifty days. What DOES
 * happen is that the access token inside it expires after an hour, and on the
 * next open the client has to refresh it before it can say who you are. If
 * that refresh cannot reach the server — a shop with no signal, a train, wifi
 * that has not connected yet — supabase-js reports the session as null. It is
 * not null. It is sitting in storage, valid, waiting for a network.
 *
 * Every guard in the platform read that null as "signed out" and showed the
 * login form. The user typed their password into it, which minted a NEW
 * session, and the pattern in auth.sessions was exactly that: the same device,
 * a fresh session every few days, the old ones never revoked.
 *
 * So this hook tells the two apart:
 *
 *   'signed-in'    there is a session and it is usable
 *   'signed-out'   there is no session anywhere — storage is empty too
 *   'unreachable'  storage HOLDS a session but the server cannot be reached
 *                  to refresh it. Not a reason to ask for a password.
 *   'checking'     none of the above yet
 *
 * On 'unreachable' it keeps trying, because the network coming back is the
 * normal outcome and the user should land in the app without doing anything.
 */

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export type AuthStatus = 'checking' | 'signed-in' | 'signed-out' | 'unreachable';

/**
 * Whether supabase-js has a session persisted on this device.
 *
 * Read from storage directly rather than asked of the client, because the
 * client's answer is the one that goes null when the network does. The key
 * is `sb-<project-ref>-auth-token`; matching the pattern rather than building
 * the name keeps this true if the project ref ever changes.
 */
export function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
      const raw = localStorage.getItem(key);
      if (raw && raw.includes('refresh_token')) return true;
    }
  } catch {
    // Storage can throw in private windows and locked-down webviews. No
    // storage means no stored session, which is the honest answer.
  }
  return false;
}

/** How long to wait between refresh attempts while the server is unreachable. */
const RETRY_MS = 4000;

export function useAuthStatus(): AuthStatus {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const stopRetrying = () => {
      if (retry.current) { clearTimeout(retry.current); retry.current = null; }
    };

    /**
     * Keep asking for a refresh until one lands or storage empties.
     *
     * A refresh that fails because the token is genuinely dead — revoked, or
     * already used by another client — makes supabase-js REMOVE the session
     * from storage, so the next check finds nothing and we stop. A refresh that
     * fails for want of a network leaves storage as it was, and we go again.
     * That difference is the whole diagnosis, and it comes for free.
     */
    const keepTrying = () => {
      stopRetrying();
      retry.current = setTimeout(async () => {
        if (cancelled) return;
        if (!hasStoredSession()) { setStatus('signed-out'); return; }
        const { data, error } = await supabase.auth.refreshSession();
        if (cancelled) return;
        if (data.session) { setStatus('signed-in'); return; }
        if (!hasStoredSession()) { setStatus('signed-out'); return; }
        // Still stored, still unreachable. Log once per attempt so a support
        // conversation can see it was the network and not the account.
        console.warn('Session stored but could not be refreshed; will retry', error?.message);
        setStatus('unreachable');
        keepTrying();
      }, RETRY_MS);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;

      if (session) {
        stopRetrying();
        setStatus('signed-in');
        return;
      }

      // An explicit sign-out is the one null that means what it says.
      if (event === 'SIGNED_OUT') {
        stopRetrying();
        setStatus('signed-out');
        return;
      }

      // INITIAL_SESSION (or a failed refresh) with nothing usable. Whether that
      // is "no account here" or "cannot reach the server" is decided by what
      // storage holds, not by the null.
      if (hasStoredSession()) {
        setStatus('unreachable');
        keepTrying();
      } else {
        setStatus('signed-out');
      }
    });

    return () => {
      cancelled = true;
      stopRetrying();
      subscription.unsubscribe();
    };
  }, []);

  return status;
}

/**
 * Where a visitor to a sign-in-or-not page should go, once that is known.
 *
 * For /login and the root redirect. Both used to ask getSession() once and
 * route on the answer, and getSession() gives null for a stored session it
 * cannot refresh — so an unreachable server sent signed-in people to the login
 * form, and the login form never checked whether they were already in.
 *
 * Returns null while undecided, including while 'unreachable': a page that
 * exists to route the user should wait for the network rather than guess
 * wrong in either direction.
 */
export function useAuthDestination(signedIn: string = '/app', signedOut: string = '/login'): string | null {
  const status = useAuthStatus();
  if (status === 'signed-in')  return signedIn;
  if (status === 'signed-out') return signedOut;
  return null;
}
