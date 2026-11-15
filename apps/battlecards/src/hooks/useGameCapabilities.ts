/**
 * useGameCapabilities — which deck-building modes each game offers the
 * signed-in user.
 *
 * Backed by the my_game_capabilities() RPC, which applies each game's
 * simple_access / custom_access level (off / admin / beta / everyone) against
 * the user's role and per-game tester rows. Only games with at least one
 * available mode are returned.
 *
 * USAGE:
 *   const { games, bySlug, loading } = useGameCapabilities();
 *   if (bySlug['starcraft']?.custom) { ... }
 */

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@battleplans/ui';
import type { CardMode } from '../lib/database.types';

export interface GameCapability {
  gameId: string;
  slug:   string;
  name:   string;
  simple: boolean;
  custom: boolean;
}

/** Modes a game offers, in the order they should be presented. */
export const availableModes = (cap: GameCapability | undefined, hasCustomBuilder: boolean): CardMode[] => {
  if (!cap) return [];
  const modes: CardMode[] = [];
  // A custom capability is only usable when the app actually has a builder page.
  if (cap.custom && hasCustomBuilder) modes.push('custom');
  if (cap.simple) modes.push('simple');
  return modes;
};

export function useGameCapabilities() {
  const [games, setGames]     = useState<GameCapability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('my_game_capabilities');
      if (cancelled) return;
      if (error) console.error('[useGameCapabilities]', error);
      setGames(((data ?? []) as { game_id: string; slug: string; name: string; simple: boolean; custom: boolean }[])
        .map(r => ({ gameId: r.game_id, slug: r.slug, name: r.name, simple: r.simple, custom: r.custom })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const bySlug = useMemo(
    () => Object.fromEntries(games.map(g => [g.slug, g])) as Record<string, GameCapability>,
    [games],
  );

  return { games, bySlug, loading };
}
