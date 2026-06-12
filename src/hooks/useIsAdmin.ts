import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) { setLoading(false); return; }

      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!cancelled) {
        setIsAdmin(data?.role === 'admin');
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { isAdmin, loading };
}
