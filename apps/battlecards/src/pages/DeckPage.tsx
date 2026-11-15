/**
 * DeckPage.tsx — Single entry point for opening a deck: /app/deck/:slug?deckId=…
 *
 * Which page opens is decided by the deck's stored card_mode (chosen when the
 * deck was created), so decks never move between builders when a game's
 * capabilities change later:
 *   - 'custom' → the game's custom builder (GAME_PAGES), if the app has one
 *   - 'simple' → the generic <ListBuilder> (static card faces + play mode)
 * A custom-mode deck for a game with no builder page also falls back to the
 * ListBuilder. Cards with a face_path render as static images either way.
 *
 * The custom builders read ?deckId= themselves, so rendering them here is
 * equivalent to their legacy /app/builder/<slug> routes (which still work).
 */

import { useEffect, useState, type ComponentType } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import CardBuilderBloodBowl from './CardBuilderBloodBowl';
import CardBuilderHaloFlashpoint from './CardBuilderHaloFlashpoint';
import CardBuilderKillTeam from './CardBuilderKillTeam';
import CardBuilderStarcraft from './CardBuilderStarcraft';
import CardBuilderRyg from './CardBuilderRyg';
import ListBuilder from './ListBuilder';
import { supabase } from '@battleplans/ui';
import type { CardMode } from '../lib/database.types';

/** Games that have a custom card builder page in the app. */
export const GAME_PAGES: Record<string, ComponentType> = {
  'blood-bowl':      CardBuilderBloodBowl,
  'halo-flashpoint': CardBuilderHaloFlashpoint,
  'kill-team':       CardBuilderKillTeam,
  'starcraft':       CardBuilderStarcraft,
  'ryg':             CardBuilderRyg,
};

/** URL for opening a deck, whatever kind of game it is. */
export const deckUrl = (slug: string, deckId: string) => `/app/deck/${slug}?deckId=${deckId}`;

/** The page a deck opens in, from its game and stored mode. */
export const pageForDeck = (slug: string, mode: CardMode | null | undefined): ComponentType =>
  mode !== 'simple' && GAME_PAGES[slug] ? GAME_PAGES[slug] : ListBuilder;

const DeckPage = () => {
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const deckId = searchParams.get('deckId');
  const [mode, setMode] = useState<CardMode | null | undefined>(undefined);

  useEffect(() => {
    if (!deckId) { setMode(null); return; }
    let cancelled = false;
    setMode(undefined);
    supabase.from('decks').select('card_mode').eq('id', deckId).single()
      .then(({ data }) => { if (!cancelled) setMode((data?.card_mode as CardMode | undefined) ?? null); });
    return () => { cancelled = true; };
  }, [deckId]);

  if (mode === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <p className="font-body text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  const Page = pageForDeck(slug, mode);
  // key forces a fresh mount when switching between games or modes.
  return <Page key={`${slug}:${mode}`} />;
};

export default DeckPage;
