/**
 * useEffectiveRole — the user's real role, and the one the UI should act on.
 *
 * These differ only while an admin is previewing a lower access level. The
 * distinction matters: `realRole` decides whether to offer the "view as"
 * controls at all, while `effectiveRole` decides what the rest of the UI shows.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useImpersonatedRole } from '../lib/impersonation';

export type UserRole = 'user' | 'beta_tester' | 'admin';

export interface UseEffectiveRoleResult {
  /** The role actually stored against the user. Null when signed out. */
  realRole: UserRole | null;
  /** What the UI should honour — the previewed role when impersonating. */
  effectiveRole: UserRole | null;
  /** True when an admin is previewing a lower access level. */
  isImpersonating: boolean;
  loading: boolean;
}

export function useEffectiveRole(): UseEffectiveRoleResult {
  const [realRole, setRealRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const impersonated = useImpersonatedRole();

  useEffect(() => {
    let cancelled = false;

    async function loadRole(userId: string) {
      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();
      if (cancelled) return;
      setRealRole((data?.role as UserRole) ?? null);
      setLoading(false);
    }

    // onAuthStateChange fires immediately with INITIAL_SESSION once the
    // Supabase client has restored the session from storage. Using this
    // instead of getSession() avoids the race where getSession() is called
    // before the session is fully hydrated and returns null.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled) return;
        if (session?.user) {
          loadRole(session.user.id);
        } else {
          setRealRole(null);
          setLoading(false);
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Only a real admin can be impersonating; for anyone else the stored value is
  // inert, matching what my_platform_apps() does server-side.
  const isImpersonating = realRole === 'admin' && impersonated !== null;

  return {
    realRole,
    effectiveRole: isImpersonating ? impersonated : realRole,
    isImpersonating,
    loading,
  };
}
