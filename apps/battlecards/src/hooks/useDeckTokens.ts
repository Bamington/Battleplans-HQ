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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@battleplans/ui';
import type { TokenDefinition } from '../lib/database.types';
import { usePlaySession, type PlaySessionState } from './usePlaySession';

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
  /**
   * The card's DATABASE id (`cards.id`), or null for a card not yet saved.
   *
   * Play state is persisted against this, never the card's `id` — every
   * builder mints a fresh crypto.randomUUID() for React on each load, so a
   * snapshot keyed on that would save happily and restore into nothing.
   *
   * Omit to opt a builder out of persistence: the game still plays, it just
   * isn't remembered.
   */
  getCardDbId?: (card: T) => string | null;
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
  /** Turn number of the game in progress. 1 when there's no session. */
  turn: number;
  /** True once a game is open and its state has been restored onto the cards. */
  sessionReady: boolean;
  /** Finish the game: closes the session and returns every token to its
   *  starting value, so the next visit begins a fresh one. */
  endGame: () => Promise<void>;
}

export function useDeckTokens<T extends { id: string }>(
  opts: UseDeckTokensOptions<T>,
): UseDeckTokensResult<T> {
  const {
    gameSlug, deckId, inPlayMode, cards, activeCardId,
    updateCards, getTokenState, withTokenState,
    isTokenEligible, resolveStat, getUnitKeywords, getCardDbId,
  } = opts;

  const [tokenDefinitions, setTokenDefinitions] = useState<TokenDefinition[]>([]);

  // The game in progress. Persistence is opt-in per builder via getCardDbId.
  const persists = getCardDbId != null;
  const playSession = usePlaySession({
    deckId,
    active: inPlayMode && persists,
  });
  // Pulled apart because the hook returns a fresh object each render — depending
  // on it directly would re-run the save effect on every render instead of when
  // something actually changed.
  const {
    session:  currentSession,
    ready:    sessionLoaded,
    save:     saveSession,
    bumpTurn: bumpSessionTurn,
  } = playSession;

  // Which session's state has been laid onto the cards. The ref is the guard
  // the effects read synchronously (state wouldn't have committed yet and the
  // restore would run twice); the state is what render is allowed to see.
  // Both are cleared when a game opens or closes, so re-entering Play mode
  // restores again rather than trusting a stale "already done" flag.
  const restoredForRef = useRef<string | null>(null);
  const [restoredFor, setRestoredFor] = useState<string | null>(null);

  // Has the player actually changed anything this visit? Seeding starting
  // values counts as setting the board up, not as playing — without this the
  // first render in Play mode would save, creating the very session that
  // deferred creation exists to avoid.
  const touchedRef = useRef(false);

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

  /** Every token back to its starting value, for every eligible card —
   *  unconditionally, unlike seedPlayTokens which leaves touched cards alone.
   *  Used when a game ends. */
  const resetToSeeds = useCallback(() => {
    updateCards(list => list.map(c => {
      if (!eligible(c)) return c;
      const ts: Record<string, number> = {};
      for (const def of tokenDefinitions) {
        if (def.starting_value != null) ts[def.id] = def.starting_value;
      }
      return withTokenState(c, ts);
    }));
  }, [tokenDefinitions, updateCards, withTokenState, eligible]);

  // ── Restoring a game in progress ──────────────────────────────────────────
  //
  // Runs once per opened session, after the builder has seeded starting values.
  // Saved values are merged OVER the seeds rather than replacing them, so a
  // token added to the game since the session started still gets its default
  // instead of coming back undefined.

  const sessionKey = currentSession?.id ?? null;

  useEffect(() => {
    if (!inPlayMode || !persists || !sessionLoaded) return;
    if (!sessionKey || restoredForRef.current === sessionKey) return;
    if (cards.length === 0 || tokenDefinitions.length === 0) return;

    const saved = currentSession?.state ?? {};
    restoredForRef.current = sessionKey;
    setRestoredFor(sessionKey);

    // A brand-new session has nothing to restore; the first save captures the
    // seeded values.
    if (Object.keys(saved).length === 0) return;

    updateCards(list => list.map(card => {
      const dbId = getCardDbId ? getCardDbId(card) : null;
      const cardState = dbId ? saved[dbId] : undefined;
      if (!cardState) return card;
      return withTokenState(card, { ...getTokenState(card), ...cardState });
    }));
  }, [
    inPlayMode, persists, sessionLoaded, currentSession, sessionKey,
    cards.length, tokenDefinitions.length,
    updateCards, getCardDbId, getTokenState, withTokenState,
  ]);

  // Re-arm the restore when the game closes or Play mode is left.
  useEffect(() => {
    if (!inPlayMode || !sessionKey) {
      restoredForRef.current = null;
      setRestoredFor(null);
    }
  }, [inPlayMode, sessionKey]);

  // Leaving Play mode clears the "player did something" flag, so the next visit
  // starts quiet again and merely looking doesn't open a game.
  useEffect(() => {
    if (!inPlayMode) touchedRef.current = false;
  }, [inPlayMode]);

  // ── Saving ────────────────────────────────────────────────────────────────
  //
  // Watching the cards is what makes this work for every builder at once: any
  // route that changes a token — the menu, a direct overlay tap, New Turn —
  // lands here without each mutator having to remember to save. The hook
  // debounces and drops no-op snapshots, so this is far cheaper than it looks.

  useEffect(() => {
    if (!inPlayMode || !persists || !sessionLoaded) return;

    if (sessionKey) {
      // Resuming: never save before restoring, or the saved game would be
      // flattened by the seeds rendered while it was still loading.
      if (restoredForRef.current !== sessionKey) return;
    } else if (!touchedRef.current) {
      // No game yet, and nothing has been touched — saving here would create a
      // session for someone who only glanced at Play mode.
      return;
    }

    const snapshot: PlaySessionState = {};
    for (const card of cards) {
      if (!eligible(card)) continue;
      const dbId = getCardDbId ? getCardDbId(card) : null;
      if (!dbId) continue;                       // unsaved card — nothing to key on
      const ts = getTokenState(card);
      if (Object.keys(ts).length > 0) snapshot[dbId] = ts;
    }

    saveSession(snapshot);
  }, [
    inPlayMode, persists, sessionLoaded, saveSession, sessionKey,
    cards, eligible, getCardDbId, getTokenState,
  ]);

  /** Change a token value on the active card. */
  const handleTokenChange = useCallback((tokenDefId: string, newValue: number) => {
    touchedRef.current = true;
    updateCards(list => list.map(c =>
      c.id === activeCardId
        ? withTokenState(c, { ...getTokenState(c), [tokenDefId]: newValue })
        : c
    ));
  }, [activeCardId, updateCards, getTokenState, withTokenState]);

  /** Change a token value on a specific card (direct overlay clicks). */
  const handleTokenChangeForCard = useCallback(
    (cardId: string, tokenDefId: string, newValue: number) => {
      touchedRef.current = true;
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
    touchedRef.current = true;
    bumpSessionTurn();
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
  }, [tokenDefinitions, updateCards, eligible, getTokenState, withTokenState, resolveTokenMax, bumpSessionTurn]);

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

  /** Finish the game, then wipe the board back to starting values so the next
   *  visit opens a fresh session rather than inheriting the old one's numbers. */
  const endGame = useCallback(async () => {
    await playSession.endGame();
    restoredForRef.current = null;
    setRestoredFor(null);
    // Cleared before the reset below: wiping the board back to starting values
    // is a card change like any other, and with this still set it would save —
    // opening a brand-new session out of the act of ending one.
    touchedRef.current = false;
    resetToSeeds();
  }, [playSession, resetToSeeds]);

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
    turn:         playSession.turn,
    sessionReady: playSession.ready && restoredFor === sessionKey && sessionKey != null,
    endGame,
  };
}
