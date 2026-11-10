/**
 * useOpponents.ts — the signed-in user's list of people, shared by every app.
 *
 * Battleplan calls them opponents; BattleBench credits them as painters. Either
 * way it's one `opponents` table, so a friend who battles you and paints for
 * you is one entry.
 *
 * The list also offers your Friends. A friend you haven't picked before has no
 * opponents row yet: they appear as an id-less option carrying their user id,
 * and resolveOpponentIds() creates (or links) the row on save.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { listFriends } from '../lib/friends';

/** A person in the user's list. `id` is null for a friend not yet picked. */
export interface Opponent {
  id:            string | null;
  name:          string;
  /** The real account this person is, when known (a friend). */
  linkedUserId?: string | null;
  /** True when they're currently one of your Friends. */
  isFriend?:     boolean;
}

/** A picked person: an existing one (has id) or a name/friend to create on save. */
export interface SelectedOpponent {
  id:            string | null;
  name:          string;
  /** Optional email, only for new opponents — used later to match a real user. */
  email?:        string;
  /** Set when the pick is a Friend, so the row is linked to their account. */
  linkedUserId?: string | null;
}

/** A friend's display name: their private name if set, else @handle. */
const friendName = (f: { username: string | null; handle: string }) => f.username?.trim() || `@${f.handle}`;

/**
 * The signed-in user's people, by name, with Friends folded in: a friend
 * already linked to a row marks that row as a friend; any other friend is
 * added as an id-less option.
 */
export function useOpponents(userId: string | null) {
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) { setOpponents([]); setLoading(false); return; }
    setLoading(true);
    const [{ data }, friends] = await Promise.all([
      supabase.from('opponents').select('id, name, linked_user_id').eq('user_id', userId).order('name'),
      listFriends().catch(() => []),
    ]);
    const rows = ((data ?? []) as { id: string; name: string; linked_user_id: string | null }[]);
    const friendIds = new Set(friends.map(f => f.id));
    const linked = new Set(rows.map(r => r.linked_user_id).filter(Boolean));
    const list: Opponent[] = [
      ...rows.map(r => ({ id: r.id, name: r.name, linkedUserId: r.linked_user_id, isFriend: !!r.linked_user_id && friendIds.has(r.linked_user_id) })),
      ...friends.filter(f => !linked.has(f.id)).map(f => ({ id: null, name: friendName(f), linkedUserId: f.id, isFriend: true })),
    ];
    list.sort((a, b) => a.name.localeCompare(b.name));
    setOpponents(list);
    setLoading(false);
  }, [userId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { opponents, loading, refetch };
}

/**
 * Turn picked people into opponent ids, creating any new ones.
 *
 * A friend is found by their linked account first; failing that, an unlinked
 * row with the same name is taken to be them and gets linked; otherwise a new
 * linked row is made. A plain new name is matched case-insensitively against
 * the existing list (find-or-create), so we never duplicate a person the unique
 * index would reject anyway.
 */
export async function resolveOpponentIds(userId: string, selected: SelectedOpponent[]): Promise<string[]> {
  const ids: string[] = [];
  for (const s of selected) {
    if (s.id) { ids.push(s.id); continue; }
    const name = s.name.trim();
    if (!name) continue;

    if (s.linkedUserId) {
      const { data: byLink } = await supabase
        .from('opponents').select('id').eq('user_id', userId).eq('linked_user_id', s.linkedUserId).limit(1);
      if (byLink && byLink[0]) { ids.push(byLink[0].id); continue; }
    }

    const { data: existing } = await supabase
      .from('opponents').select('id, linked_user_id').eq('user_id', userId).ilike('name', name).limit(1);
    const match = existing?.[0] as { id: string; linked_user_id: string | null } | undefined;
    if (match) {
      if (s.linkedUserId && !match.linked_user_id) {
        await supabase.from('opponents').update({ linked_user_id: s.linkedUserId }).eq('id', match.id);
      }
      ids.push(match.id);
      continue;
    }

    const { data: created } = await supabase
      .from('opponents')
      .insert({ user_id: userId, name, email: s.email?.trim() || null, linked_user_id: s.linkedUserId ?? null })
      .select('id').single();
    if (created) ids.push(created.id);
  }
  return [...new Set(ids)];
}
