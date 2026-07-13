import { useEffect, useState } from 'react';
import { supabase } from '@battleplans/ui';
import type { StatBattle } from '../lib/battleStats';

/**
 * Every one of the signed-in user's battles (slim columns only), for the stats
 * page. Unlike `useBattles` this does NOT page — stats need the whole history —
 * but it skips photos/notes to stay light. Owner-only RLS scopes the rows.
 */
export function useBattleStats(userId: string | null) {
  const [battles, setBattles] = useState<StatBattle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setBattles([]); setLoading(false); return; }
    setLoading(true);
    supabase
      .from('battles')
      .select('id, result, date_played, location_name, game:games(id, name, slug, supported), battle_opponents(opponent:opponents(id, name))')
      .eq('user_id', userId)
      .limit(5000)
      .then(({ data }) => {
        const rows = (data as unknown as (Omit<StatBattle, 'opponents'> & {
          battle_opponents: { opponent: { id: string; name: string } | null }[] | null;
        })[]) ?? [];
        setBattles(rows.map(r => ({
          id:            r.id,
          result:        r.result,
          date_played:   r.date_played,
          location_name: r.location_name,
          game:          r.game,
          opponents:     (r.battle_opponents ?? []).map(bo => bo.opponent).filter((o): o is { id: string; name: string } => !!o),
        })));
        setLoading(false);
      });
  }, [userId]);

  return { battles, loading };
}
