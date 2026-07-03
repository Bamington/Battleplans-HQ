import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkRole(userId: string) {
      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();
      if (!cancelled) {
        setIsAdmin(data?.role === 'admin');
        setLoading(false);
      }
    }

    // onAuthStateChange fires immediately with INITIAL_SESSION once the
    // Supabase client has restored the session from storage. Using this
    // instead of getSession() avoids the race where getSession() is called
    // before the session is fully hydrated and returns null.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled) return;
        if (session?.user) {
          checkRole(session.user.id);
        } else {
          setIsAdmin(false);
          setLoading(false);
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { isAdmin, loading };
}
