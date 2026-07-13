import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@battleplans/ui';

/** Result of a battle, from the owner's perspective. */
export type BattleResult = 'won' | 'lost' | 'drew';

/** A photo attached to a battle, resolved for display. */
export interface BattlePhoto {
  id:           string;
  /** Storage object path in the `battle-images` bucket. */
  path:         string;
  /** Public URL resolved from the path. */
  url:          string;
  isPrimary:    boolean;
  displayOrder: number;
}

export interface Battle {
  id:            number;
  date_played:   string;
  opp_name:      string;
  result:        BattleResult;
  /** Venue name as recorded at the time. Most battles aren't at one of our venues. */
  location_name: string | null;
  /** Linked venue id, when the battle was at one of our venues. */
  location_id:   string | null;
  /** Rich-text notes (markdown), or null. */
  battle_notes:  string | null;
  game:          { id: string; name: string; slug: string } | null;
  /** The battle's opponents as objects. `opp_name` is the cached display string. */
  opponents:     { id: string; name: string }[];
  /** Every photo on the battle, primary first then by display order. */
  photos:        BattlePhoto[];
  /**
   * Public URL of the battle's primary photo, or null — the card background.
   * Convenience accessor for `photos[0]?.url`.
   */
  photoUrl:      string | null;
}

/** A photo row from the battle_images relation. */
interface BattleImageRow {
  id:            string;
  image_path:    string;
  is_primary:    boolean;
  display_order: number | null;
}

/** Row shape from the select, before image paths are resolved to URLs. */
interface BattleRow {
  id:            number;
  date_played:   string;
  opp_name:      string;
  result:        BattleResult;
  location_name: string | null;
  location_id:   string | null;
  battle_notes:  string | null;
  game:          { id: string; name: string; slug: string } | null;
  battle_images: BattleImageRow[] | null;
  battle_opponents: { opponent: { id: string; name: string } | null }[] | null;
}

/** How many battles are fetched per page as the list is scrolled. */
const PAGE_SIZE = 20;

const BATTLE_SELECT =
  'id, date_played, opp_name, result, location_name, location_id, battle_notes, ' +
  'game:games(id, name, slug), battle_images(id, image_path, is_primary, display_order), ' +
  'battle_opponents(opponent:opponents(id, name))';

/**
 * Resolve a stored `battle-images` object path to a public URL. Paths are kept
 * rather than full URLs so a future project move needs no data change.
 */
export function battlePhotoUrl(path: string): string {
  return supabase.storage.from('battle-images').getPublicUrl(path).data.publicUrl;
}

/** Primary first, then by display order, then a stable id tiebreak. */
function sortPhotos(images: BattleImageRow[] | null): BattlePhoto[] {
  if (!images) return [];
  return [...images]
    .map(i => ({
      id:           i.id,
      path:         i.image_path,
      url:          battlePhotoUrl(i.image_path),
      isPrimary:    i.is_primary,
      displayOrder: i.display_order ?? 0,
    }))
    .sort((a, b) =>
      Number(b.isPrimary) - Number(a.isPrimary) ||
      a.displayOrder - b.displayOrder ||
      a.id.localeCompare(b.id));
}

function mapRow(r: BattleRow): Battle {
  const photos = sortPhotos(r.battle_images);
  return {
    id:            r.id,
    date_played:   r.date_played,
    opp_name:      r.opp_name,
    result:        r.result,
    location_name: r.location_name,
    location_id:   r.location_id,
    battle_notes:  r.battle_notes,
    game:          r.game,
    opponents:     (r.battle_opponents ?? [])
                     .map(bo => bo.opponent)
                     .filter((o): o is { id: string; name: string } => !!o),
    photos,
    photoUrl:      photos[0]?.url ?? null,
  };
}

/**
 * The signed-in user's battles, most recent first, fetched a page at a time.
 *
 * Starts with the first {@link PAGE_SIZE}; call `loadMore` (e.g. when the list is
 * scrolled near its end) to append the next page. `hasMore` is false once a short
 * page comes back. `refetch` reloads the whole window currently on screen so an
 * edit/create/delete reflects without collapsing back to the first page.
 *
 * RLS on `battles` is owner-only, so this can't return anyone else's rows — the
 * user_id filter is belt-and-braces and keeps the query from running before auth
 * has resolved.
 */
export function useBattles(userId: string | null) {
  const [battles,     setBattles]     = useState<Battle[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);
  // Rows currently loaded — a ref so loadMore/refetch stay stable across renders.
  const loadedRef = useRef(0);

  const fetchRange = useCallback((from: number, to: number) =>
    supabase
      .from('battles')
      .select(BATTLE_SELECT)
      .eq('user_id', userId!)
      .order('date_played', { ascending: false })
      .range(from, to)
      .then(({ data }) => ((data as unknown as BattleRow[]) ?? []).map(mapRow)),
    [userId]);

  // Initial load (and reset to the first page whenever the user changes).
  const load = useCallback(async () => {
    if (!userId) { loadedRef.current = 0; setBattles([]); setHasMore(false); setLoading(false); return; }
    setLoading(true);
    const rows = await fetchRange(0, PAGE_SIZE - 1);
    loadedRef.current = rows.length;
    setBattles(rows);
    setHasMore(rows.length === PAGE_SIZE);
    setLoading(false);
  }, [userId, fetchRange]);

  const loadMore = useCallback(async () => {
    if (!userId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const from = loadedRef.current;
    const rows = await fetchRange(from, from + PAGE_SIZE - 1);
    setBattles(prev => {
      const next = [...prev, ...rows];
      loadedRef.current = next.length;
      return next;
    });
    setHasMore(rows.length === PAGE_SIZE);
    setLoadingMore(false);
  }, [userId, loadingMore, hasMore, fetchRange]);

  const refetch = useCallback(async () => {
    if (!userId) { loadedRef.current = 0; setBattles([]); setHasMore(false); return; }
    // Reload as many rows as are currently on screen (at least one page).
    const count = Math.max(PAGE_SIZE, loadedRef.current);
    const rows = await fetchRange(0, count - 1);
    loadedRef.current = rows.length;
    setBattles(rows);
    setHasMore(rows.length === count);
  }, [userId, fetchRange]);

  useEffect(() => { load(); }, [load]);

  return { battles, loading, loadingMore, hasMore, loadMore, refetch };
}
