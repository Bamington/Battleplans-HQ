/**
 * useDeckTokens — shared Play-mode token engine
 *
 * Extracted verbatim from the Kill Team builder (the reference implementation)
 * so every game drives its Play-mode tokens through one pipeline. Tokens stay
 * DB-driven: each game seeds its own rows in `token_definitions` (game-level
 * rows with deck_id NULL, plus per-deck User-Created Tokens), and this hook
 * fetches, seeds, refreshes, and mutates them identically for all games.
 *
 * The hook is generic over the game's card type `T`. Because each game stores
 * its cards differently (Kill Team keeps a `cardState` object, others use a
 * plain array) and exposes stats/keywords under different shapes, the caller
 * supplies small adapters:
 *   - updateCards   — apply a functional update to the game's card collection
 *   - getTokenState — read a card's `{ [tokenDefId]: value }` map
 *   - withTokenState — return a copy of the card with a new token map
 *   - isTokenEligible — which cards can hold tokens (e.g. operatives, not rules)
 *   - resolveStat   — map a token's `stat_key` to a live card stat (for stat-capped maxes)
 *   - getUnitKeywords — the card's keywords, for keyword-driven token maxes
 *
 * Behaviour (seeding, New Turn refresh, activation detection, max resolution)
 * is identical to the original Kill Team logic — see the matching comments.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@battleplans/ui';
import type { TokenDefinition } from '../lib/database.types';

/** The `tokenOverlay` prop shape consumed by the shared TokenOverlay. */
export interface TokenOverlayProp {
  definitions:  TokenDefinition[];
  unitKeywords: { keywordName: string; paramValue: number | null }[];
  state:        Record<string, number>;
  onChange:     (tokenDefId: string, newValue: number) => void;
}

export interface UseDeckTokensOptions<T extends { id: string }> {
  /** Game slug used to fetch the game-level token definitions. */
  gameSlug: string;
  /** Current deck id (null outside a deck) — scopes User-Created Tokens. */
  deckId: string | null;
  /** True while the builder is in Play mode. Gates the overlay. */
  inPlayMode: boolean;
  /** The game's live card collection. */
  cards: T[];
  /** The active/centred card id — target of the menu's token changes. */
  activeCardId: string | null;
  /** Apply a functional update to the game's card collection. */
  updateCards: (updater: (cards: T[]) => T[]) => void;
  /** Read a card's token-state map. */
  getTokenState: (card: T) => Record<string, number>;
  /** Return a copy of the card with a replaced token-state map. */
  withTokenState: (card: T, tokenState: Record<string, number>) => T;
  /** Which cards may hold tokens. Defaults to every card. */
  isTokenEligible?: (card: T) => boolean;
  /** Map a token's `stat_key` to a live stat on the card (for stat_role='max'). */
  resolveStat?: (card: T, statKey: string) => number | undefined;
  /** Keywords on the card, for keyword-driven token maxes and menu display. */
  getUnitKeywords?: (card: T) => { keywordName: string; paramValue: number | null }[];
}

export interface UseDeckTokensResult<T> {
  tokenDefinitions: TokenDefinition[];
  /** Re-fetch game tokens + this deck's UCTs. Call after any UCT mutation. */
  reload: () => Promise<void>;
  /** Seed `tokenState` from each definition's `starting_value` for untouched
   *  cards. Call when entering Play mode. */
  seedPlayTokens: () => void;
  /** Change a token value on the active card (used by the TokenMenu). */
  handleTokenChange: (tokenDefId: string, newValue: number) => void;
  /** Change a token value on a specific card (used by overlay clicks). */
  handleTokenChangeForCard: (cardId: string, tokenDefId: string, newValue: number) => void;
  /** Resolve the effective max for a token on a card (stat/keyword overrides). */
  resolveTokenMax: (def: TokenDefinition, card: T) => number | null;
  /** Apply each token's refresh_on_turn delta to every eligible card. */
  newTurn: () => void;
  /** True when a card has all activation tokens at their effective max. */
  isCardActivated: (card: T) => boolean;
  /** True when every eligible card is activated. Drives New Turn styling. */
  allActivated: boolean;
  /** Build the `tokenOverlay` prop for a card, or undefined when not shown. */
  buildTokenOverlay: (card: T) => TokenOverlayProp | undefined;
}

export function useDeckTokens<T extends { id: string }>(
  opts: UseDeckTokensOptions<T>,
): UseDeckTokensResult<T> {
  const {
    gameSlug, deckId, inPlayMode, cards, activeCardId,
    updateCards, getTokenState, withTokenState,
    isTokenEligible, resolveStat, getUnitKeywords,
  } = opts;

  const [tokenDefinitions, setTokenDefinitions] = useState<TokenDefinition[]>([]);

  const eligible = useCallback(
    (card: T) => (isTokenEligible ? isTokenEligible(card) : true),
    [isTokenEligible],
  );

  /** Pull both game tokens and this deck's UCTs in one go. Called on mount and
   *  after any UCT mutation so the menu/overlay reflect changes immediately. */
  const reload = useCallback(async () => {
    const { data: game } = await supabase
      .from('games').select('id').eq('slug', gameSlug).single();
    if (!game) return;

    // Game tokens.
    const { data: gameTokens } = await supabase
      .from('token_definitions').select('*')
      .eq('game_id', game.id)
      .is('deck_id', null)
      .order('sort_order');

    // Deck UCTs (if we're in a deck).
    let deckTokens: TokenDefinition[] = [];
    if (deckId) {
      const { data } = await supabase
        .from('token_definitions').select('*')
        .eq('deck_id', deckId)
        .order('created_at');
      if (data) deckTokens = data as TokenDefinition[];
    }

    setTokenDefinitions([...(gameTokens as TokenDefinition[] ?? []), ...deckTokens]);
  }, [gameSlug, deckId]);

  useEffect(() => { void reload(); }, [reload]);

  /** Seed `tokenState` from each definition's `starting_value` for any card
   *  that hasn't been touched yet. */
  const seedPlayTokens = useCallback(() => {
    if (tokenDefinitions.length === 0) return;
    updateCards(list => list.map(c => {
      if (Object.keys(getTokenState(c)).length > 0) return c;
      const ts: Record<string, number> = {};
      for (const def of tokenDefinitions) {
        if (def.starting_value != null) ts[def.id] = def.starting_value;
      }
      return withTokenState(c, ts);
    }));
  }, [tokenDefinitions, updateCards, getTokenState, withTokenState]);

  /** Change a token value on the active card. */
  const handleTokenChange = useCallback((tokenDefId: string, newValue: number) => {
    updateCards(list => list.map(c =>
      c.id === activeCardId
        ? withTokenState(c, { ...getTokenState(c), [tokenDefId]: newValue })
        : c
    ));
  }, [activeCardId, updateCards, getTokenState, withTokenState]);

  /** Change a token value on a specific card (direct overlay clicks). */
  const handleTokenChangeForCard = useCallback(
    (cardId: string, tokenDefId: string, newValue: number) => {
      updateCards(list => list.map(c =>
        c.id === cardId
          ? withTokenState(c, { ...getTokenState(c), [tokenDefId]: newValue })
          : c
      ));
    }, [updateCards, getTokenState, withTokenState]);

  /** Resolve effective max for a token on a card — mirrors TokenOverlay's
   *  precedence: stat_role='max' or keyword_value_role='max' override max_value. */
  const resolveTokenMax = useCallback((def: TokenDefinition, card: T): number | null => {
    let effMax: number | null = def.max_value ?? null;
    if (def.stat_key && def.stat_role === 'max' && resolveStat) {
      const v = resolveStat(card, def.stat_key);
      if (v != null) effMax = v;
    }
    if (def.keyword_name && def.keyword_value_role === 'max' && getUnitKeywords) {
      const kw = getUnitKeywords(card).find(
        k => k.keywordName.toLowerCase() === def.keyword_name!.toLowerCase());
      if (kw?.paramValue != null) effMax = kw.paramValue;
    }
    return effMax;
  }, [resolveStat, getUnitKeywords]);

  /** "New Turn": apply each token's refresh_on_turn delta to every eligible
   *  card, clamped to [min_value ?? 0, effectiveMax]. */
  const newTurn = useCallback(() => {
    const turnDefs = tokenDefinitions.filter(d => d.refresh_on_turn !== 0);
    if (turnDefs.length === 0) return;
    updateCards(list => list.map(card => {
      if (!eligible(card)) return card;
      const ts = { ...getTokenState(card) };
      for (const def of turnDefs) {
        const current = ts[def.id] ?? def.starting_value ?? 0;
        const effMax = resolveTokenMax(def, card);
        const lo = def.min_value ?? 0;
        const hi = effMax ?? Number.POSITIVE_INFINITY;
        ts[def.id] = Math.max(lo, Math.min(hi, current + def.refresh_on_turn));
      }
      return withTokenState(card, ts);
    }));
  }, [tokenDefinitions, updateCards, eligible, getTokenState, withTokenState, resolveTokenMax]);

  /** True when this card has all its activation tokens at their effective max
   *  — i.e. it has been activated this turn. False for ineligible cards and
   *  for cards with no activation tokens. */
  const isCardActivated = useCallback((card: T): boolean => {
    if (!eligible(card)) return false;
    const actDefs = tokenDefinitions.filter(d => d.is_activation_token);
    if (actDefs.length === 0) return false;
    const ts = getTokenState(card);
    return actDefs.every(def => {
      const current = ts[def.id] ?? def.starting_value ?? 0;
      const effMax = resolveTokenMax(def, card);
      return effMax != null ? current >= effMax : current >= 1;
    });
  }, [tokenDefinitions, eligible, getTokenState, resolveTokenMax]);

  /** Primary-styled when every eligible card has all activation tokens on. */
  const allActivated = useMemo(() => {
    const list = cards.filter(eligible);
    if (list.length === 0) return false;
    const actDefs = tokenDefinitions.filter(d => d.is_activation_token);
    if (actDefs.length === 0) return false;
    return list.every(isCardActivated);
  }, [cards, tokenDefinitions, eligible, isCardActivated]);

  /** Build the tokenOverlay prop for a card — only in play mode with tokens. */
  const buildTokenOverlay = useCallback((card: T): TokenOverlayProp | undefined => {
    if (!inPlayMode || tokenDefinitions.length === 0) return undefined;
    if (!eligible(card)) return undefined;
    return {
      definitions:  tokenDefinitions,
      unitKeywords: getUnitKeywords ? getUnitKeywords(card) : [],
      state:        getTokenState(card),
      onChange:     (tokenDefId: string, newValue: number) =>
        handleTokenChangeForCard(card.id, tokenDefId, newValue),
    };
  }, [inPlayMode, tokenDefinitions, eligible, getUnitKeywords, getTokenState, handleTokenChangeForCard]);

  return {
    tokenDefinitions,
    reload,
    seedPlayTokens,
    handleTokenChange,
    handleTokenChangeForCard,
    resolveTokenMax,
    newTurn,
    isCardActivated,
    allActivated,
    buildTokenOverlay,
  };
}
