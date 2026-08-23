/**
 * usePlaySession — the persistence half of Play mode
 *
 * A game in progress lives in `deck_play_sessions`: one row per player per
 * deck, holding every card's token values and the turn number. This hook owns
 * that row — finding or opening one when Play mode starts, saving as the game
 * goes, and closing it when the player is done.
 *
 * It deliberately knows nothing about cards or tokens. `useDeckTokens` reads
 * the restored snapshot onto its cards and hands back updated snapshots to
 * save; everything game-shaped stays there.
 *
 * SAVING IS DEBOUNCED
 * Tapping a damage counter four times is four state changes in about a second.
 * Writes are coalesced (SAVE_DEBOUNCE_MS) and skipped entirely when the
 * snapshot is unchanged, so a game costs roughly one write per action rather
 * than one per tap. A pending write is flushed on unmount, so leaving the deck
 * — the exact case this feature exists for — doesn't drop the last change.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@battleplans/ui';

/** card id (cards.id, NOT the client-side React id) → token def id → value. */
export type PlaySessionState = Record<string, Record<string, number>>;

export interface PlaySession {
  id:    string;
  turn:  number;
  state: PlaySessionState;
}

export interface UsePlaySessionOptions {
  /** Deck being played, or null outside a deck. */
  deckId: string | null;
  /** True while the builder is in Play mode. Opening a session is what
   *  "starting a game" means, so nothing happens until this is true. */
  active: boolean;
}

export interface UsePlaySessionResult {
  session: PlaySession | null;
  /** True once the initial find-or-create has settled. Callers must wait for
   *  this before restoring, or they'd overwrite a saved game with seeds. */
  ready:   boolean;
  turn:    number;
  /** Persist a snapshot. Debounced and de-duplicated. */
  save:    (state: PlaySessionState) => void;
  /** Advance the turn counter and persist it. */
  bumpTurn: () => void;
  /** Finish the game: closes the row so the next visit starts fresh. */
  endGame: () => Promise<void>;
}

/** How long to wait after the last change before writing. */
const SAVE_DEBOUNCE_MS = 800;

/**
 * Was this timestamp today, in the player's own timezone?
 *
 * Local, deliberately. `updated_at` is stored UTC, and comparing UTC dates
 * would roll "today" over mid-morning for anyone far enough east — a game
 * played at 9am in Melbourne would look like yesterday's by 10am.
 */
export function isSameLocalDay(iso: string, now: Date = new Date()): boolean {
  const then = new Date(iso);
  return then.getFullYear() === now.getFullYear()
      && then.getMonth()    === now.getMonth()
      && then.getDate()     === now.getDate();
}

/** A game in progress, as seen before opening it. */
export interface PeekedSession {
  id:        string;
  updatedAt: string;
  /** True when it was last touched today — i.e. almost certainly the same game. */
  fromToday: boolean;
}

/**
 * Look for a game in progress WITHOUT opening one.
 *
 * The builder needs this before it decides which mode to open in, and that
 * decision happens before Play mode exists — so it can't come from
 * usePlaySession, which only runs once play has started. Read-only: it never
 * creates a session, so merely opening a deck doesn't start a game.
 */
export async function peekActivePlaySession(deckId: string): Promise<PeekedSession | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('deck_play_sessions')
    .select('id, updated_at')
    .eq('deck_id', deckId)
    .eq('user_id', user.id)
    .is('ended_at', null)
    .maybeSingle();

  if (error || !data) return null;

  const updatedAt = data.updated_at as string;
  return { id: data.id as string, updatedAt, fromToday: isSameLocalDay(updatedAt) };
}

/** Close a session by id — used when the player chooses to start fresh. */
export async function discardPlaySession(id: string): Promise<void> {
  const { error } = await supabase
    .from('deck_play_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('[BattleCards] Could not discard the old play session:', error);
}

export function usePlaySession({ deckId, active }: UsePlaySessionOptions): UsePlaySessionResult {
  const [session, setSession] = useState<PlaySession | null>(null);
  const [ready,   setReady]   = useState(false);
  // Tracked separately from `session` because the turn can advance before any
  // row exists — deferred creation means New Turn may come first.
  const [turn,    setTurn]    = useState(1);

  // Serialised copy of what's in the database, so an unchanged snapshot costs
  // nothing. Also what the debounce timer reads when it fires.
  const lastSavedRef = useRef<string>('');
  const pendingRef   = useRef<PlaySessionState | null>(null);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  // Needed by flush(), which may have to create the row itself and can't read
  // props or state directly from a debounced callback.
  const deckIdRef    = useRef<string | null>(deckId);
  const turnRef      = useRef<number>(1);

  // Synced in an effect rather than during render. Safe for flush(), which only
  // ever runs from a debounce or a cleanup — both after effects have committed.
  useEffect(() => { deckIdRef.current = deckId; }, [deckId]);

  // ── Find or open the session ──────────────────────────────────────────────

  useEffect(() => {
    if (!active || !deckId) {
      setReady(false);
      return;
    }

    let cancelled = false;

    const open = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      // Resume the game already in progress, if there is one.
      const { data: existing } = await supabase
        .from('deck_play_sessions')
        .select('id, turn, state')
        .eq('deck_id', deckId)
        .eq('user_id', user.id)
        .is('ended_at', null)
        .maybeSingle();

      if (cancelled) return;

      if (existing) {
        const loaded: PlaySession = {
          id:    existing.id as string,
          turn:  (existing.turn as number) ?? 1,
          state: ((existing.state ?? {}) as PlaySessionState),
        };
        sessionIdRef.current = loaded.id;
        turnRef.current      = loaded.turn;
        lastSavedRef.current = JSON.stringify(loaded.state);
        setSession(loaded);
        setTurn(loaded.turn);
        setReady(true);
        return;
      }

      // NOTHING IS CREATED HERE, DELIBERATELY.
      // Entering Play mode is not the same as playing a game. Someone who tabs
      // into Play, taps nothing and leaves would otherwise be asked about a
      // "game in progress" the next day that never happened. The row is written
      // on the first real change instead — see flush().
      setReady(true);
    };

    void open();
    return () => { cancelled = true; };
  }, [deckId, active]);

  // Leaving Play mode drops the in-memory handle but leaves the row open, so
  // the game is still there to resume.
  useEffect(() => {
    if (!active) {
      setSession(null);
      sessionIdRef.current = null;
      lastSavedRef.current = '';
      turnRef.current      = 1;
      setTurn(1);
    }
  }, [active]);

  // ── Saving ────────────────────────────────────────────────────────────────

  const flush = useCallback(async () => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;

    const serialised = JSON.stringify(pending);
    if (serialised === lastSavedRef.current) return;

    const id = sessionIdRef.current;

    // ── First real change: the game starts here ─────────────────────────────
    if (!id) {
      const deckIdNow = deckIdRef.current;
      if (!deckIdNow) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('deck_play_sessions')
        .insert({
          deck_id: deckIdNow,
          user_id: user.id,
          state:   pending,
          turn:    turnRef.current,
        })
        .select('id, turn, state')
        .single();

      if (error || !data) {
        // A unique-violation here means another tab opened a game for this deck
        // first. Either way the move is the same: leave it, and let the next
        // change try again rather than losing the row we do have.
        console.error('[BattleCards] Could not start a play session:', error);
        return;
      }

      sessionIdRef.current = data.id as string;
      lastSavedRef.current = serialised;
      setSession({
        id:    data.id as string,
        turn:  (data.turn as number) ?? turnRef.current,
        state: pending,
      });
      return;
    }

    // ── Subsequent changes ──────────────────────────────────────────────────
    lastSavedRef.current = serialised;

    const { error } = await supabase
      .from('deck_play_sessions')
      .update({ state: pending })
      .eq('id', id);

    if (error) {
      // Let the next change retry rather than silently accepting the loss.
      lastSavedRef.current = '';
      console.error('[BattleCards] Could not save play state:', error);
    }
  }, []);

  const save = useCallback((state: PlaySessionState) => {
    // No session-id guard: the first save is what creates the row.
    if (JSON.stringify(state) === lastSavedRef.current) return;

    pendingRef.current = state;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void flush(); }, SAVE_DEBOUNCE_MS);
  }, [flush]);

  // Flush on unmount — leaving the deck is precisely when the last change
  // must not be lost.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    void flush();
  }, [flush]);

  // ── Turn ──────────────────────────────────────────────────────────────────

  const bumpTurn = useCallback(() => {
    const next = turnRef.current + 1;
    turnRef.current = next;
    setTurn(next);

    // With no row yet, the turn rides along when the change that follows
    // creates one — New Turn always moves tokens, so a save is right behindit.
    const id = sessionIdRef.current;
    if (!id) return;

    void supabase.from('deck_play_sessions').update({ turn: next }).eq('id', id);
    setSession(prev => (prev ? { ...prev, turn: next } : prev));
  }, []);

  // ── Ending ────────────────────────────────────────────────────────────────

  const endGame = useCallback(async () => {
    const id = sessionIdRef.current;
    if (!id) return;

    // Drop any queued save first: it belongs to the game being ended, and
    // writing it after would be pointless work on a closed row.
    if (timerRef.current) clearTimeout(timerRef.current);
    pendingRef.current = null;

    const { error } = await supabase
      .from('deck_play_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[BattleCards] Could not end the play session:', error);
      return;
    }

    sessionIdRef.current = null;
    lastSavedRef.current = '';
    turnRef.current      = 1;
    setSession(null);
    setTurn(1);
  }, []);

  return {
    session,
    ready,
    turn,
    save,
    bumpTurn,
    endGame,
  };
}
