/**
 * useCardBuilder — shared cross-cutting state for every card-builder page.
 *
 * Owns the bits that are identical across Halo / Starcraft / Blood Bowl (and
 * future games):
 *   - Mobile slide-in panel toggles (cardListOpen / editorOpen) with mutual
 *     exclusion: opening one closes the other.
 *   - Responsive media queries (isMobile, isShortHeight) and the derived
 *     `mobilePanelOpen` flag the centre viewport uses to collapse around an
 *     open panel.
 *   - Inline deck-name rename: state, input ref, edit-start helper, and a
 *     commit helper that no-ops on blank/unchanged input and (optionally)
 *     persists to the `decks` table.
 *   - A `layoutDeps` array to spread into <CardCarousel layoutDeps={...}> so
 *     the carousel relayouts whenever the surrounding chrome changes.
 *
 * Game-specific state — the cards themselves, drag-reorder, dirty-flush,
 * play-mode subnav, modals — stays in the page component. This hook is
 * deliberately small; bigger ones tend to grow opinions that don't fit.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CardBuilderConfig } from '../types/cardBuilder';

export interface UseCardBuilderResult {
  // ── Panel toggle state (mobile slide-in) ─────────────────────────────────
  cardListOpen:    boolean;
  editorOpen:      boolean;
  toggleCardList:  () => void;
  toggleEditor:    () => void;

  // ── Responsive ───────────────────────────────────────────────────────────
  isMobile:        boolean;
  isShortHeight:   boolean;
  /** True when on a mobile viewport AND a slide-in panel is open. The centre
   *  viewport collapses to `flex-none` in this state so the panel can grow. */
  mobilePanelOpen: boolean;

  // ── Carousel relayout deps ───────────────────────────────────────────────
  /** Spread into <CardCarousel layoutDeps={[...layoutDeps, ...gameDeps]} />. */
  layoutDeps: ReadonlyArray<unknown>;

  // ── Deck name (inline rename) ────────────────────────────────────────────
  deckName:           string | null;
  setDeckName:        (n: string | null) => void;
  editingDeckName:    boolean;
  setEditingDeckName: (b: boolean) => void;
  deckNameInputRef:   React.RefObject<HTMLInputElement | null>;
  startDeckNameEdit:  () => void;
  /** Trim, no-op on blank/unchanged, set local, exit edit mode, optionally
   *  persist to Supabase. Pass `{ persist: false }` when caller is batching
   *  saves elsewhere (e.g. Halo's editMode "Done" button). */
  commitDeckName:     (newName: string, opts?: { persist?: boolean }) => Promise<void>;
}

export function useCardBuilder(config: CardBuilderConfig): UseCardBuilderResult {
  const { deckId, decksTable = 'decks' } = config;

  // ── Panel toggle state ─────────────────────────────────────────────────────
  const [cardListOpen, setCardListOpen] = useState(false);
  const [editorOpen,   setEditorOpen]   = useState(false);

  const toggleCardList = useCallback(() => {
    setCardListOpen(o => !o);
    setEditorOpen(false);
  }, []);
  const toggleEditor = useCallback(() => {
    setEditorOpen(o => !o);
    setCardListOpen(false);
  }, []);

  // ── Responsive state ───────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  );
  const [isShortHeight, setIsShortHeight] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-height: 700px)').matches,
  );

  useEffect(() => {
    const mqWidth  = window.matchMedia('(max-width: 767px)');
    const mqHeight = window.matchMedia('(max-height: 700px)');
    const widthHandler  = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    const heightHandler = (e: MediaQueryListEvent) => setIsShortHeight(e.matches);
    mqWidth.addEventListener('change', widthHandler);
    mqHeight.addEventListener('change', heightHandler);
    return () => {
      mqWidth.removeEventListener('change', widthHandler);
      mqHeight.removeEventListener('change', heightHandler);
    };
  }, []);

  const mobilePanelOpen = isMobile && (cardListOpen || editorOpen);

  // ── Deck name ──────────────────────────────────────────────────────────────
  const [deckName,        setDeckName]        = useState<string | null>(null);
  const [editingDeckName, setEditingDeckName] = useState(false);
  const deckNameInputRef = useRef<HTMLInputElement>(null);

  const startDeckNameEdit = useCallback(() => {
    setEditingDeckName(true);
    requestAnimationFrame(() => deckNameInputRef.current?.select());
  }, []);

  const commitDeckName = useCallback(async (newName: string, opts?: { persist?: boolean }) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === deckName) {
      setEditingDeckName(false);
      return;
    }
    setDeckName(trimmed);
    setEditingDeckName(false);
    if ((opts?.persist ?? true) && deckId) {
      await supabase.from(decksTable).update({ name: trimmed }).eq('id', deckId);
    }
  }, [deckName, deckId, decksTable]);

  return {
    cardListOpen, editorOpen, toggleCardList, toggleEditor,
    isMobile, isShortHeight, mobilePanelOpen,
    layoutDeps: [cardListOpen, editorOpen, isMobile, isShortHeight, mobilePanelOpen],
    deckName, setDeckName, editingDeckName, setEditingDeckName,
    deckNameInputRef, startDeckNameEdit, commitDeckName,
  };
}
