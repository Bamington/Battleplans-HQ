/**
 * usePlaySessionEntry — which mode a deck opens in, and what to do with an old game
 *
 * Play state persisting created a question it didn't answer: a session left
 * open three weeks ago is still "in progress", and dropping someone back into
 * a half-wounded board from a game they've long forgotten is worse than not
 * remembering at all.
 *
 * The day is the signal. Opening a deck you were playing TODAY almost
 * certainly means resuming that game, so it opens straight into Play mode.
 * Any older, and the deck opens in Edit as it always has; if the player then
 * starts Play, they're asked whether to pick the old game up or start fresh —
 * rather than having either choice made for them.
 *
 * "Today" is the player's local day, not UTC — see isSameLocalDay.
 *
 * The hook owns the whole decision so the four builders each spend one call on
 * it, and reads without ever creating: opening a deck must not start a game.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  peekActivePlaySession,
  discardPlaySession,
  type PeekedSession,
} from './usePlaySession';

export interface UsePlaySessionEntryOptions {
  /** Deck being opened, or null before it's known. */
  deckId: string | null;
  /** Switch the builder into Play mode (seeding included). */
  enterPlay: () => void;
  /** False while the deck is still loading — auto-entering before the cards
   *  exist would show an empty board. */
  ready?: boolean;
}

export interface UsePlaySessionEntryResult {
  /** True while the "you have an older game" modal is showing. */
  promptOpen: boolean;
  /** When that older game was last played, for the modal to name. */
  lastPlayed: Date | null;
  /** Ask to enter Play mode. Enters immediately, or opens the prompt. */
  requestPlay: () => void;
  /** Modal choice: resume the older game. */
  continueGame: () => void;
  /** Modal choice: bin it and start a new one. */
  startFresh: () => Promise<void>;
  /** Modal dismissed without choosing — stays in Edit mode. */
  cancel: () => void;
}

export function usePlaySessionEntry({
  deckId,
  enterPlay,
  ready = true,
}: UsePlaySessionEntryOptions): UsePlaySessionEntryResult {
  const [peeked,     setPeeked]     = useState<PeekedSession | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);

  // Auto-entry is a one-shot per deck: having gone to Play once, a player who
  // deliberately switches back to Edit shouldn't be dragged forward again.
  const autoEnteredRef = useRef<string | null>(null);
  // Kept in a ref so the peek effect doesn't have to depend on a callback that
  // changes identity every render. Synced in an effect rather than during
  // render, and declared first so it lands before the peek below runs.
  const enterPlayRef = useRef(enterPlay);
  useEffect(() => { enterPlayRef.current = enterPlay; });

  // ── Look for a game in progress ───────────────────────────────────────────

  useEffect(() => {
    if (!deckId || !ready) return;

    let cancelled = false;

    void peekActivePlaySession(deckId).then(found => {
      if (cancelled) return;
      setPeeked(found);

      // Played today → straight back into it.
      if (found?.fromToday && autoEnteredRef.current !== deckId) {
        autoEnteredRef.current = deckId;
        enterPlayRef.current();
      }
    });

    return () => { cancelled = true; };
  }, [deckId, ready]);

  // ── Entering Play by hand ─────────────────────────────────────────────────

  const requestPlay = useCallback(() => {
    // An older game is the only case worth interrupting for. No session, or one
    // from today, goes straight through.
    if (peeked && !peeked.fromToday) {
      setPromptOpen(true);
      return;
    }
    enterPlayRef.current();
  }, [peeked]);

  const continueGame = useCallback(() => {
    setPromptOpen(false);
    // Treat it as today's game from here on, so switching to Edit and back
    // doesn't ask again in the same sitting.
    setPeeked(prev => (prev ? { ...prev, fromToday: true } : prev));
    enterPlayRef.current();
  }, []);

  const startFresh = useCallback(async () => {
    setPromptOpen(false);
    if (peeked) await discardPlaySession(peeked.id);
    // Cleared rather than replaced: with no active session, entering Play opens
    // a brand-new one and the board seeds from scratch.
    setPeeked(null);
    enterPlayRef.current();
  }, [peeked]);

  const cancel = useCallback(() => setPromptOpen(false), []);

  return {
    promptOpen,
    lastPlayed: peeked ? new Date(peeked.updatedAt) : null,
    requestPlay,
    continueGame,
    startFresh,
    cancel,
  };
}
