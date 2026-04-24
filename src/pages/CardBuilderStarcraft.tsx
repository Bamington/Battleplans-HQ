/**
 * CardBuilderStarcraft.tsx — StarCraft card builder screen
 *
 * SCAFFOLDING (PR 1): This page currently resolves the deckId query param,
 * verifies the deck exists and belongs to the StarCraft game, and renders
 * a placeholder. The full builder (unit list / card display / editor panel,
 * mirroring the Halo and Blood Bowl builders) lands in PR 2 alongside the
 * StarcraftCard visual.
 *
 * Route: /app/builder/starcraft?deckId=<uuid>
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Button from '../components/Button';
import { supabase } from '../lib/supabase';
import type { DeckWithGame } from '../lib/database.types';

// Placeholder logo — swap to a real branded asset once provided.
import logoStarcraft from '../assets/games/logo-starcraft.svg';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; deck: DeckWithGame };

const CardBuilderStarcraft = () => {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const deckId         = searchParams.get('deckId');

  const [state, setState] = useState<LoadState>(() =>
    deckId ? { kind: 'loading' } : { kind: 'error', message: 'No deck selected.' },
  );

  useEffect(() => {
    if (!deckId) return;

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('decks')
        .select('*, game:games(id, name, slug, stat_schema, print_size, bleed_size, created_at)')
        .eq('id', deckId)
        .single();

      if (cancelled) return;

      if (error || !data) {
        setState({ kind: 'error', message: 'We couldn’t load that deck.' });
        return;
      }

      const deck = data as DeckWithGame;
      if (deck.game?.slug !== 'starcraft') {
        setState({ kind: 'error', message: 'That deck isn’t a StarCraft deck.' });
        return;
      }

      setState({ kind: 'ready', deck });
    })();

    return () => { cancelled = true; };
  }, [deckId]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <Navbar fixed={false} />

      <div className="flex-1 flex items-center justify-center p-6">

        {state.kind === 'loading' && (
          <p className="font-body text-sm text-gray-400">Loading deck…</p>
        )}

        {state.kind === 'error' && (
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <img src={logoStarcraft} alt="StarCraft" className="h-10 opacity-70" />
            <p className="font-body text-base text-gray-300">{state.message}</p>
            <Button variant="outline" color="secondary" onClick={() => navigate('/app')}>
              Back to decks
            </Button>
          </div>
        )}

        {state.kind === 'ready' && (
          <div className="flex flex-col items-center gap-4 text-center max-w-md">
            <img src={logoStarcraft} alt="StarCraft" className="h-10" />
            <h1 className="font-heading text-2xl text-white">{state.deck.name}</h1>
            <p className="font-body text-sm text-gray-400">
              The StarCraft card builder is on its way. The game is wired up and decks
              can be created — the visual card and editor controls land next.
            </p>
            <Button variant="outline" color="secondary" onClick={() => navigate('/app')}>
              Back to decks
            </Button>
          </div>
        )}

      </div>
    </div>
  );
};

export default CardBuilderStarcraft;
