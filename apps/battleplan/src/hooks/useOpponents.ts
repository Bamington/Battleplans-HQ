import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@battleplans/ui';

/** An opponent in the user's roster. */
export interface Opponent {
  id:   string;
  name: string;
}

/** A picked opponent: an existing one (has id) or a new name to create on save. */
export interface SelectedOpponent {
  id:    string | null;
  name:  string;
  /** Optional email, only for new opponents — used later to match a real user. */
  email?: string;
}

/** The signed-in user's opponent roster, most recent first. */
export function useOpponents(userId: string | null) {
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    if (!userId) { setOpponents([]); setLoading(false); return; }
    setLoading(true);
    supabase
      .from('opponents')
      .select('id, name')
      .eq('user_id', userId)
      .order('name')
      .then(({ data }) => {
        setOpponents((data as Opponent[]) ?? []);
        setLoading(false);
      });
  }, [userId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { opponents, loading, refetch };
}

/**
 * Turn picked opponents into opponent ids, creating any new ones. New names are
 * matched case-insensitively against the existing roster first (find-or-create),
 * so we never duplicate a person the unique index would reject anyway.
 */
export async function resolveOpponentIds(userId: string, selected: SelectedOpponent[]): Promise<string[]> {
  const ids: string[] = [];
  for (const s of selected) {
    if (s.id) { ids.push(s.id); continue; }
    const name = s.name.trim();
    if (!name) continue;
    const { data: existing } = await supabase
      .from('opponents').select('id').eq('user_id', userId).ilike('name', name).limit(1);
    if (existing && existing[0]) { ids.push(existing[0].id); continue; }
    const { data: created } = await supabase
      .from('opponents').insert({ user_id: userId, name, email: s.email?.trim() || null }).select('id').single();
    if (created) ids.push(created.id);
  }
  return [...new Set(ids)];
}

/** Replace a battle's opponent links with exactly `opponentIds`. */
export async function setBattleOpponents(battleId: number, opponentIds: string[]): Promise<void> {
  await supabase.from('battle_opponents').delete().eq('battle_id', battleId);
  if (opponentIds.length) {
    await supabase.from('battle_opponents')
      .insert(opponentIds.map(opponent_id => ({ battle_id: battleId, opponent_id })));
  }
}
