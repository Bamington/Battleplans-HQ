import { useEffect, useState } from 'react';
import { supabase } from '@battleplans/ui';

/** Result of a battle, from the owner's perspective. */
export type BattleResult = 'won' | 'lost' | 'drew';

export interface Battle {
  id:            number;
  date_played:   string;
  opp_name:      string;
  result:        BattleResult;
  /** Venue name as recorded at the time. Most battles aren't at one of our venues. */
  location_name: string | null;
  game:          { id: string; name: string; slug: string } | null;
}

/**
 * The signed-in user's battles, most recent first.
 *
 * RLS on `battles` is owner-only, so this can't return anyone else's rows — the
 * user_id filter is belt-and-braces and keeps the query from running before auth
 * has resolved.
 */
export function useBattles(userId: string | null) {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = () => {
    if (!userId) { setBattles([]); setLoading(false); return; }
    setLoading(true);
    supabase
      .from('battles')
      .select('id, date_played, opp_name, result, location_name, game:games(id, name, slug)')
      .eq('user_id', userId)
      .order('date_played', { ascending: false })
      .then(({ data }) => {
        setBattles((data as unknown as Battle[]) ?? []);
        setLoading(false);
      });
  };

  useEffect(refetch, [userId]);

  return { battles, loading, refetch };
}
