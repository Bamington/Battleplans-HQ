/**
 * CardBuilderBloodBowl.tsx — Blood Bowl card builder screen
 *
 * Allows the user to edit a Blood Bowl card. The live card component
 * (BloodBowlCard) is rendered in the centre column, wired to the editor
 * state in the right panel.
 *
 * LAYOUT (desktop ≥ 768px):
 * ┌──────────────────────────────────────────────────────────┐
 * │  Navbar (fixed, full width)                              │
 * ├──────────┬──────────────────────────┬────────────────────┤
 * │  Unit    │      Card display        │    Edit Card       │
 * │  List    │   (logo + live card)     │   (editor panel)   │
 * │  (256px) │        (flex-1)          │      (256px)       │
 * └──────────┴──────────────────────────┴────────────────────┘
 *
 * LAYOUT (mobile < 768px):
 * ┌──────────────────────────────────┐
 * │  Navbar                          │
 * ├──────────────────────────────────┤
 * │  Card Selector bar (42px)        │  ← tap to open unit list overlay
 * ├──────────────────────────────────┤
 * │                                  │
 * │   Card (full width, clipped)     │  ← swipe L/R to navigate
 * │                                  │
 * ├──────────────────────────────────┤
 * │  EDIT CARD (collapsed bar)       │  ← tap to expand up to 50vh
 * └──────────────────────────────────┘
 *
 * Route: /app/builder/blood-bowl?deckId=<uuid>
 */

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import UnitListEntry from '../components/UnitListEntry';
import Input from '../components/Input';
import Counter from '../components/Counter';
import Button from '../components/Button';
import HR from '../components/HR';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import BloodBowlCard from '../components/BloodBowlCard';
import Card3DWrapper from '../components/Card3DWrapper';
import Modal from '../components/Modal';
import AddKeywordModal from '../components/AddKeywordModal';
import KeywordInfoModal from '../components/KeywordInfoModal';
import Badge from '../components/Badge';
import UploadPhotoModal from '../components/UploadPhotoModal';
import UsersGroupRounded from '../icons/UsersGroupRounded';
import UserRounded from '../icons/UserRounded';
import Star from '../icons/Star';
import AddCircle from '../icons/AddCircle';
import MinusCircle from '../icons/MinusCircle';
import CheckCircle from '../icons/CheckCircle';
import AltArrowDown from '../icons/AltArrowDown';
import AltArrowUp from '../icons/AltArrowUp';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';
import ArrowRight from '../icons/ArrowRight';
import Pen2 from '../icons/Pen2';
import HamburgerMenu from '../icons/HamburgerMenu';
import { supabase } from '../lib/supabase';
import type { BloodBowlStats } from '../lib/database.types';
import logoBloodBowl from '../assets/games/logo-blood-bowl.png';
import iconBloodBowl from '../assets/games/card assets/blood-bowl/icon.png';

// ── Navbar height ─────────────────────────────────────────────────────────────

// ── Card native dimensions ────────────────────────────────────────────────────
const CARD_W = 556;
const CARD_H = 779;

// ── Carousel constants ────────────────────────────────────────────────────────
// TODO: migrate this builder to the universal `CardCarousel` component
// (src/components/CardCarousel.tsx). All the carousel + zoom + fit-scale logic
// below duplicates what CardCarousel now owns. Kill Team and Starcraft already
// use it; this builder still has the inline copy.
const ADJACENT_SCALE = 0.7;  // Adjacent cards are 70 % of the active card's scale
const CARD_GAP       = 40;   // Gap in px between carousel card slots

// ── Blood Bowl attribute options ──────────────────────────────────────────────
const ATTRIBUTE_OPTIONS = ['Agility', 'General', 'Mutations', 'Passing', 'Strength', 'Devious'];

// ── Keyword attachment shape (shared with Halo) ──────────────────────────────

interface LocalKeywordAttachment {
  keywordId: string;
  keywordName: string;
  description: string;
  hasParams: boolean;
  paramValue: number | null;
}

const buildSkillsDisplayString = (kws: LocalKeywordAttachment[]) =>
  kws
    .map(k => k.paramValue != null ? `${k.keywordName} (${k.paramValue})` : k.keywordName)
    .join(', ');

// ── Card data type ────────────────────────────────────────────────────────────

interface BloodBowlCardData {
  id:            string;        // stable local React key
  dbId:          string | null; // Supabase row id (null = not yet saved)
  teamName:      string;
  unitName:      string;
  playerRole:    string;
  cost:          string;
  move:          number;
  strength:      number;
  agility:       number;
  passing:       number;
  armor:         number;
  primaryAttr:   string[];
  secondaryAttr: string[];
  skills:        string;        // computed display string for card renderer
  unitKeywords:  LocalKeywordAttachment[];
  portraitUrl:   string | null;
  avatarUrl:     string | null;
}

const defaultCard = (): BloodBowlCardData => ({
  id:            crypto.randomUUID(),
  dbId:          null,
  teamName:      '',
  unitName:      '',
  playerRole:    '',
  cost:          '',
  move:          0,
  strength:      0,
  agility:       0,
  passing:       0,
  armor:         0,
  primaryAttr:   [],
  secondaryAttr: [],
  skills:        '',
  unitKeywords:  [],
  portraitUrl:   null,
  avatarUrl:     null,
});

// ── Persistence helpers ────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

const withRetry = async <T,>(fn: () => Promise<T>, attempts = 3): Promise<T | undefined> => {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch { if (i < attempts - 1) await sleep(1000 * (i + 1)); }
  }
};

const isBloodBowlCardBlank = (c: BloodBowlCardData): boolean =>
  !c.unitName && !c.teamName && !c.playerRole && !c.cost &&
  c.move === 0 && c.strength === 0 && c.agility === 0 &&
  c.passing === 0 && c.armor === 0 &&
  c.primaryAttr.length === 0 && c.secondaryAttr.length === 0 &&
  c.unitKeywords.length === 0;

const toBloodBowlStats = (c: BloodBowlCardData): BloodBowlStats => ({
  teamName:           c.teamName,
  playerRole:         c.playerRole,
  cost:               c.cost,
  primaryAttribute:   c.primaryAttr.join(', '),
  secondaryAttribute: c.secondaryAttr.join(', '),
  ma: c.move,
  st: c.strength,
  ag: c.agility,
  pa: c.passing,
  av: c.armor,
});

// ── Component ─────────────────────────────────────────────────────────────────

const CardBuilderBloodBowl = () => {
  const [searchParams] = useSearchParams();
  const deckId = searchParams.get('deckId');

  // ── Deck name ────────────────────────────────────────────────────────────────
  const [deckName, setDeckName] = useState<string | null>(null);
  const [editingDeckName, setEditingDeckName] = useState(false);
  const deckNameInputRef = useRef<HTMLInputElement>(null);

  // ── Edit mode (reorder + rename) ────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);
  const dragItemRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // ── Card list state ───────────────────────────────────────────────────────────
  const [cardState, setCardState] = useState(() => {
    const card = defaultCard();
    return { cards: [card] as BloodBowlCardData[], activeCardId: card.id };
  });
  const { cards, activeCardId } = cardState;
  const activeCard = cards.find(c => c.id === activeCardId) ?? cards[0];

  // ── Dirty tracking (cards that need saving) ───────────────────────────────────
  const dirtyCardsRef = useRef<Set<string>>(new Set());

  const updateActiveCard = (patch: Partial<BloodBowlCardData>) => {
    dirtyCardsRef.current.add(activeCardId);
    setCardState(s => ({
      ...s,
      cards: s.cards.map(c => c.id === s.activeCardId ? { ...c, ...patch } : c),
    }));
  };

  const addCard = () => {
    const card = defaultCard();
    setCardState(s => ({ cards: [...s.cards, card], activeCardId: card.id }));
  };

  const deleteCard = async (cardId: string) => {
    const cardToDelete = cards.find(c => c.id === cardId);

    setCardState(s => {
      if (s.cards.length <= 1) return s;

      const deleteIndex = s.cards.findIndex(c => c.id === cardId);
      if (deleteIndex === -1) return s;

      const nextCards = s.cards.filter(c => c.id !== cardId);
      const nextActiveCardId = s.activeCardId === cardId
        ? nextCards[Math.min(deleteIndex, nextCards.length - 1)].id
        : s.activeCardId;

      return {
        cards: nextCards,
        activeCardId: nextActiveCardId,
      };
    });

    dirtyCardsRef.current.delete(cardId);

    if (cardToDelete?.dbId) {
      const { error } = await supabase.from('cards').delete().eq('id', cardToDelete.dbId);
      if (error) {
        console.error('[BattleCards] Failed to delete card:', error);
      }
    }
  };

  // ── Deck name inline rename ─────────────────────────────────────────────────
  const startDeckNameEdit = useCallback(() => {
    setEditingDeckName(true);
    // Focus the input after it renders
    requestAnimationFrame(() => deckNameInputRef.current?.select());
  }, []);

  const commitDeckName = useCallback(async (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === deckName) {
      setEditingDeckName(false);
      return;
    }
    setDeckName(trimmed);
    setEditingDeckName(false);
    // If not in edit mode, save immediately
    if (!editMode && deckId) {
      await supabase.from('decks').update({ name: trimmed }).eq('id', deckId);
    }
  }, [deckName, editMode, deckId]);

  // ── Drag reorder handlers ──────────────────────────────────────────────────
  const handleDragStart = useCallback((index: number) => {
    dragItemRef.current = index;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverRef.current = index;
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const from = dragItemRef.current;
    const to = dragOverRef.current;
    if (from == null || to == null || from === to) {
      setDragOverIndex(null);
      return;
    }
    setCardState(s => {
      const reordered = [...s.cards];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      return { ...s, cards: reordered };
    });
    dragItemRef.current = null;
    dragOverRef.current = null;
    setDragOverIndex(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragItemRef.current = null;
    dragOverRef.current = null;
    setDragOverIndex(null);
  }, []);

  // ── Done button — persist order + deck name ─────────────────────────────────
  const handleDoneEditing = useCallback(async () => {
    if (!deckId) { setEditMode(false); return; }
    setSavingEdits(true);
    try {
      // Save deck name
      await supabase.from('decks').update({ name: deckName || 'Untitled' }).eq('id', deckId);

      // Save card sort_order
      await Promise.all(
        cards.map((card, i) => {
          if (!card.dbId) return Promise.resolve();
          return supabase.from('cards').update({ sort_order: i }).eq('id', card.dbId);
        })
      );
    } catch (err) {
      console.error('[BattleCards] Failed to save edit mode changes:', err);
    } finally {
      setSavingEdits(false);
      setEditMode(false);
    }
  }, [deckId, deckName, cards]);

  // ── Load deck + cards on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (!deckId) return;

    supabase.from('decks').select('name').eq('id', deckId).single()
      .then(({ data }) => { if (data) setDeckName(data.name); });

    type CardKeywordRow = { keyword_id: string; params: Record<string, unknown>; sort_order: number | null; keywords: { name: string; description: string | null; params_schema: { key: string; type: string; label: string }[] } | null };
    type CardRow = {
      id: string; name: string; stats: BloodBowlStats;
      card_keywords: CardKeywordRow[];
      card_images: { file_path: string; sort_order: number; image_type: string }[];
    };

    supabase
      .from('cards')
      .select('id, name, stats, card_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema)), card_images(file_path, sort_order, image_type)')
      .eq('deck_id', deckId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) { console.error('[BattleCards] Failed to load cards:', error); return; }
        if (!data || data.length === 0) return;
        const loaded = (data as unknown as CardRow[]).map(row => {
          const s = row.stats ?? {};

          const sortedCardKeywords = [...(row.card_keywords ?? [])]
            .filter(ck => ck.keywords != null)
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

          const loadedUnitKeywords: LocalKeywordAttachment[] = sortedCardKeywords.map(ck => ({
            keywordId: ck.keyword_id,
            keywordName: ck.keywords!.name,
            description: ck.keywords!.description ?? '',
            hasParams: Array.isArray(ck.keywords!.params_schema) && ck.keywords!.params_schema.length > 0,
            paramValue: ck.params?.X != null ? Number(ck.params.X) : null,
          }));

          // Resolve card images by type
          const allImages = row.card_images ?? [];
          const portraitImg = allImages.find(i => i.image_type === 'portrait');
          const avatarImg   = allImages.find(i => i.image_type === 'avatar');
          let portraitUrl: string | null = null;
          if (portraitImg) {
            portraitUrl = supabase.storage.from('card-images').getPublicUrl(portraitImg.file_path).data.publicUrl;
          }
          let avatarUrl: string | null = null;
          if (avatarImg) {
            avatarUrl = supabase.storage.from('card-images').getPublicUrl(avatarImg.file_path).data.publicUrl;
          }

          return {
            id:            row.id,
            dbId:          row.id,
            teamName:      s.teamName      ?? '',
            unitName:      row.name,
            playerRole:    s.playerRole    ?? '',
            cost:          s.cost          ?? '',
            move:          s.ma            ?? 0,
            strength:      s.st            ?? 0,
            agility:       s.ag            ?? 0,
            passing:       s.pa            ?? 0,
            armor:         s.av            ?? 0,
            primaryAttr:   s.primaryAttribute   ? s.primaryAttribute.split(', ').filter(Boolean)   : [],
            secondaryAttr: s.secondaryAttribute ? s.secondaryAttribute.split(', ').filter(Boolean) : [],
            skills: buildSkillsDisplayString(loadedUnitKeywords),
            unitKeywords: loadedUnitKeywords,
            portraitUrl,
            avatarUrl,
          } as BloodBowlCardData;
        });
        setCardState({ cards: loaded, activeCardId: loaded[0].id });
      });
  }, [deckId]);

  // ── Auto-save (debounced 1s) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!deckId || dirtyCardsRef.current.size === 0) return;

    const dirty = new Set(dirtyCardsRef.current);
    const timer = setTimeout(async () => {
      dirtyCardsRef.current.clear();

      for (let ci = 0; ci < cards.length; ci++) {
        const card = cards[ci];
        if (!dirty.has(card.id) || isBloodBowlCardBlank(card)) continue;

        await withRetry(async () => {
          let dbId = card.dbId;

          if (!dbId) {
            const { data, error } = await supabase
              .from('cards')
              .insert({ deck_id: deckId, name: card.unitName || 'Unnamed Unit', stats: toBloodBowlStats(card), sort_order: ci })
              .select('id')
              .single();
            if (error) throw error;
            dbId = data.id;
            setCardState(s => ({
              ...s,
              cards: s.cards.map(c => c.id === card.id ? { ...c, dbId: data.id } : c),
            }));
          } else {
            const { error } = await supabase
              .from('cards')
              .update({ name: card.unitName || 'Unnamed Unit', stats: toBloodBowlStats(card), sort_order: ci })
              .eq('id', dbId);
            if (error) throw error;
          }

          // Sync card_keywords: delete all then re-insert in order
          await supabase.from('card_keywords').delete().eq('card_id', dbId);
          if (card.unitKeywords.length > 0) {
            const { error } = await supabase.from('card_keywords').insert(
              card.unitKeywords.map((k, i) => ({
                card_id: dbId!,
                keyword_id: k.keywordId,
                params: k.paramValue != null ? { X: k.paramValue } : {},
                sort_order: i,
              }))
            );
            if (error) throw error;
          }
        });
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [cards, deckId]);

  // ── Ensure card is saved (needed before image upload) ────────────────────────
  const ensureCardSaved = async (): Promise<string | null> => {
    if (activeCard.dbId) return activeCard.dbId;
    if (!deckId) return null;
    try {
      const { data, error } = await supabase
        .from('cards')
        .insert({
          deck_id: deckId,
          name: activeCard.unitName || 'Unnamed Unit',
          stats: toBloodBowlStats(activeCard),
        })
        .select('id')
        .single();
      if (error) throw error;
      setCardState(s => ({
        ...s,
        cards: s.cards.map(c =>
          c.id === activeCard.id ? { ...c, dbId: data.id } : c,
        ),
      }));
      return data.id;
    } catch {
      return null;
    }
  };

  // ── Photo upload modal ──────────────────────────────────────────────────────
  const [photoModalOpen, setPhotoModalOpen]           = useState(false);
  const [deletePortraitConfirm, setDeletePortraitConfirm] = useState(false);
  const [deletingPortrait, setDeletingPortrait]           = useState(false);
  const [deleteCardConfirmOpen, setDeleteCardConfirmOpen] = useState(false);
  const [cardPendingDelete, setCardPendingDelete] = useState<BloodBowlCardData | null>(null);
  const [deletingCard, setDeletingCard] = useState(false);

  const requestDeleteCard = (card: BloodBowlCardData) => {
    setCardPendingDelete(card);
    setDeleteCardConfirmOpen(true);
  };

  const closeDeleteCardConfirm = () => {
    setDeleteCardConfirmOpen(false);
    setCardPendingDelete(null);
  };

  const handleConfirmDeleteCard = async () => {
    if (!cardPendingDelete) return;
    setDeletingCard(true);
    try {
      await deleteCard(cardPendingDelete.id);
      closeDeleteCardConfirm();
    } finally {
      setDeletingCard(false);
    }
  };

  const handleDeletePortrait = async () => {
    if (!activeCard.dbId) return;
    setDeletingPortrait(true);
    try {
      const { data: images } = await supabase
        .from('card_images')
        .select('id, file_path')
        .eq('card_id', activeCard.dbId);

      if (images && images.length > 0) {
        await supabase.storage.from('card-images').remove(images.map(img => img.file_path));
        await supabase.from('card_images').delete().eq('card_id', activeCard.dbId);
      }

      updateActiveCard({ portraitUrl: null, avatarUrl: null });
      setDeletePortraitConfirm(false);
    } catch (err) {
      console.error('[BattleCards] Failed to delete portrait:', err);
    } finally {
      setDeletingPortrait(false);
    }
  };

  // ── Skills (keyword-based) ───────────────────────────────────────────────────
  const [skillModalOpen, setSkillModalOpen]             = useState(false);
  const [viewingSkill, setViewingSkill]                 = useState<LocalKeywordAttachment | null>(null);
  const [editingSkill, setEditingSkill]                 = useState<LocalKeywordAttachment | null>(null);

  /** Propagate a skill/keyword definition update across ALL cards. */
  const propagateKeywordUpdate = useCallback((keywordId: string, newName: string, newDescription: string, newHasParams: boolean) => {
    setCardState(s => ({
      ...s,
      cards: s.cards.map(c => {
        const newUnitKws = c.unitKeywords.map(k =>
          k.keywordId === keywordId
            ? { ...k, keywordName: newName, description: newDescription, hasParams: newHasParams }
            : k,
        );
        if (newUnitKws === c.unitKeywords) return c;
        dirtyCardsRef.current.add(c.id);
        return { ...c, unitKeywords: newUnitKws, skills: buildSkillsDisplayString(newUnitKws) };
      }),
    }));
  }, []);

  // ── Responsive layout detection ───────────────────────────────────────────────
  const [isMobile, setIsMobile]     = useState(() => window.innerWidth < 768);
  const [mobileScale, setMobileScale] = useState(() => (window.innerWidth - 24) / CARD_W);

  useEffect(() => {
    const update = () => {
      setIsMobile(window.innerWidth < 768);
      setMobileScale((window.innerWidth - 24) / CARD_W);
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── Mobile UI state ───────────────────────────────────────────────────────────
  const [unitListOpen,  setUnitListOpen]  = useState(false);
  const [editPanelOpen, setEditPanelOpen] = useState(false);

  // ── Swipe navigation ──────────────────────────────────────────────────────────
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 60) return;
    const idx = cards.findIndex(c => c.id === activeCardId);
    if (delta < 0 && idx < cards.length - 1)
      setCardState(s => ({ ...s, activeCardId: cards[idx + 1].id }));
    else if (delta > 0 && idx > 0)
      setCardState(s => ({ ...s, activeCardId: cards[idx - 1].id }));
  };

  // ── Card scaling (desktop) ────────────────────────────────────────────────────
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale]   = useState(1);
  const [zoomLevel, setZoomLevel] = useState(0.7);
  const cardScale = fitScale * zoomLevel;

  useEffect(() => {
    const el = cardContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      containerWidthRef.current = width;
      setFitScale(Math.min(width / CARD_W, height / CARD_H));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const zoomOut = () => setZoomLevel(z => Math.max(0.5, parseFloat((z - 0.1).toFixed(1))));
  const zoomIn  = () => setZoomLevel(z => Math.min(1.0, parseFloat((z + 0.1).toFixed(1))));

  // ── Carousel refs & helpers ───────────────────────────────────────────────────
  const stripRef          = useRef<HTMLDivElement>(null);
  const prevCardRef       = useRef<HTMLDivElement>(null);
  const activeCardRef     = useRef<HTMLDivElement>(null);
  const nextCardRef       = useRef<HTMLDivElement>(null);
  const containerWidthRef = useRef(0);
  const cardScaleRef      = useRef(cardScale);
  cardScaleRef.current    = cardScale;
  const cardsLengthRef    = useRef(cards.length);
  cardsLengthRef.current  = cards.length;

  // Navigation animation phase
  const phaseRef       = useRef<'idle' | 'transitioning'>('idle');
  const pendingIdRef   = useRef<string | null>(null);

  // Drag tracking
  const draggingRef    = useRef(false);
  const dragStartXRef  = useRef(0);

  const getBaseTranslateX = () => {
    const cs   = cardScaleRef.current;
    const adjW = CARD_W * cs * ADJACENT_SCALE;
    return containerWidthRef.current / 2 - adjW - CARD_GAP - CARD_W * cs / 2;
  };

  const getSlideDistance = () => {
    const cs = cardScaleRef.current;
    return CARD_W * cs / 2 + CARD_GAP + CARD_W * cs * ADJACENT_SCALE / 2;
  };

  const applyStripTransform = (extra: number, animate: boolean) => {
    const strip = stripRef.current;
    if (!strip) return;
    strip.style.transition = animate
      ? 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
      : 'none';
    strip.style.transform = `translateX(${getBaseTranslateX() + extra}px)`;
  };

  // Set transform + opacity on all three card containers via refs — no React re-render needed
  const CARD_TRANS = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
  const applyCardStyles = (
    prevS: number, activeS: number, nextS: number,
    prevO: number, activeO: number, nextO: number,
    animate: boolean,
  ) => {
    const t = animate ? CARD_TRANS : 'none';
    if (prevCardRef.current)   { prevCardRef.current.style.transition   = t; prevCardRef.current.style.transform   = `scale(${prevS})`; prevCardRef.current.style.opacity   = String(prevO);   }
    if (activeCardRef.current) { activeCardRef.current.style.transition = t; activeCardRef.current.style.transform = `scale(${activeS})`; activeCardRef.current.style.opacity = String(activeO); }
    if (nextCardRef.current)   { nextCardRef.current.style.transition   = t; nextCardRef.current.style.transform   = `scale(${nextS})`; nextCardRef.current.style.opacity   = String(nextO);   }
  };

  const resetCardStyles = (animate: boolean) => {
    const cs   = cardScaleRef.current;
    const as   = cs * ADJACENT_SCALE;
    const adjO = cardsLengthRef.current >= 2 ? 0.5 : 0;
    applyCardStyles(as, cs, as, adjO, 1, adjO, animate);
  };

  const navigateCarousel = (targetId: string, direction: 'prev' | 'next') => {
    if (phaseRef.current !== 'idle') return;
    const cs     = cardScaleRef.current;
    const as     = cs * ADJACENT_SCALE;
    const offset = direction === 'next' ? -getSlideDistance() : getSlideDistance();
    phaseRef.current     = 'transitioning';
    pendingIdRef.current = targetId;
    // Slide strip + animate scale and opacity simultaneously
    applyStripTransform(offset, true);
    if (direction === 'next') {
      applyCardStyles(as, as, cs, 0.5, 0.5, 1, true); // active dims + shrinks, next brightens + grows
    } else {
      applyCardStyles(cs, as, as, 1, 0.5, 0.5, true); // prev brightens + grows, active dims + shrinks
    }
  };

  const handleStripTransitionEnd = () => {
    if (phaseRef.current !== 'transitioning' || !pendingIdRef.current) return;
    const targetId       = pendingIdRef.current;
    pendingIdRef.current = null;
    phaseRef.current     = 'idle';
    // Snap strip and card styles back instantly, then swap content
    const strip = stripRef.current;
    if (strip) { strip.style.transition = 'none'; strip.style.transform = `translateX(${getBaseTranslateX()}px)`; }
    resetCardStyles(false);
    setCardState(s => ({ ...s, activeCardId: targetId }));
  };

  // Re-centre strip and reset card styles whenever zoom changes — layout effect runs before paint
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (phaseRef.current !== 'transitioning') { applyStripTransform(0, false); resetCardStyles(false); }
  }, [cardScale]);

  // Set initial card styles before first paint
  useLayoutEffect(() => { resetCardStyles(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived values ────────────────────────────────────────────────────────────
  const skillsString = activeCard.skills;

  // ── Shared editor form ────────────────────────────────────────────────────────
  const editorForm = (
    <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">

      {/* ── Basic Details ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Basic Details
        </p>

        <Input
          label="Team Name"
          required
          placeholder="Team Name"
          leftIcon={<UsersGroupRounded className="w-4 h-4" />}
          value={activeCard.teamName}
          onChange={e => updateActiveCard({ teamName: e.target.value })}
        />
        <Input
          label="Unit Name"
          required
          placeholder="Unit Name"
          leftIcon={<UserRounded className="w-4 h-4" />}
          value={activeCard.unitName}
          onChange={e => updateActiveCard({ unitName: e.target.value })}
        />
        <Input
          label="Player Role"
          required
          placeholder="e.g. Thrower, Blitzer"
          leftIcon={<UserRounded className="w-4 h-4" />}
          value={activeCard.playerRole}
          onChange={e => updateActiveCard({ playerRole: e.target.value })}
        />
        <Input
          label="Cost"
          required
          placeholder="Cost in your roster."
          leftIcon={<Star className="w-4 h-4" />}
          value={activeCard.cost}
          onChange={e => updateActiveCard({ cost: e.target.value })}
        />
      </section>

      {/* ── Images ──────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Images
        </p>
        {activeCard.portraitUrl ? (
          <div className="flex flex-wrap gap-1">
            <Button
              rightIcon={<AddCircle className="w-4 h-4" />}
              variant="outline"
              size="sm"
              className="w-full"
              onClick={async () => {
                await ensureCardSaved();
                setPhotoModalOpen(true);
              }}
            >
              Change Portrait Image
            </Button>
            <Button
              leftIcon={<TrashBinMinimalistic className="w-4 h-4" />}
              variant="ghost"
              color="danger"
              size="sm"
              onClick={() => setDeletePortraitConfirm(true)}
            >
              Remove Portrait
            </Button>
          </div>
        ) : (
          <Button
            rightIcon={<AddCircle className="w-4 h-4" />}
            variant="outline"
            size="sm"
            onClick={async () => {
              await ensureCardSaved();
              setPhotoModalOpen(true);
            }}
          >
            Upload Portrait Image
          </Button>
        )}
      </section>

      {/* ── Unit Stats ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Unit Stats
        </p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Counter
            label="Move"
            required
            min={0}
            value={activeCard.move}
            onChange={v => updateActiveCard({ move: v })}
            className="w-full"
          />
          <Counter
            label="Strength"
            required
            min={0}
            value={activeCard.strength}
            onChange={v => updateActiveCard({ strength: v })}
            className="w-full"
          />
          <Counter
            label="Agility"
            required
            min={0}
            value={activeCard.agility}
            onChange={v => updateActiveCard({ agility: v })}
            className="w-full"
          />
          <Counter
            label="Passing"
            required
            min={0}
            value={activeCard.passing}
            onChange={v => updateActiveCard({ passing: v })}
            className="w-full"
          />
        </div>

        <Counter
          label="Armor"
          required
          min={0}
          value={activeCard.armor}
          onChange={v => updateActiveCard({ armor: v })}
        />
      </section>

      {/* ── Player Development ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Player Development
        </p>

        <MultiSelectDropdown
          label="Primary Attributes"
          required
          helperText="Used for league progression."
          options={ATTRIBUTE_OPTIONS}
          selected={activeCard.primaryAttr}
          disabledOptions={activeCard.secondaryAttr}
          onChange={primaryAttr => updateActiveCard({ primaryAttr })}
        />

        <MultiSelectDropdown
          label="Secondary Attributes"
          required
          helperText="Used for league progression."
          options={ATTRIBUTE_OPTIONS}
          selected={activeCard.secondaryAttr}
          disabledOptions={activeCard.primaryAttr}
          onChange={secondaryAttr => updateActiveCard({ secondaryAttr })}
        />
      </section>

      {/* ── Skills (keyword-based) ─────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Skills
        </p>

        {activeCard.unitKeywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeCard.unitKeywords.map(k => (
              <Badge
                key={k.keywordId}
                onDismiss={() => {
                  const updated = activeCard.unitKeywords.filter(x => x.keywordId !== k.keywordId);
                  updateActiveCard({
                    unitKeywords: updated,
                    skills: buildSkillsDisplayString(updated),
                  });
                }}
              >
                <button
                  type="button"
                  className="underline text-blue-600 dark:text-blue-400 hover:text-blue-500"
                  onClick={() => setViewingSkill(k)}
                >
                  {k.paramValue != null ? `${k.keywordName} (${k.paramValue})` : k.keywordName}
                </button>
              </Badge>
            ))}
          </div>
        )}

        <Button
          leftIcon={<AddCircle className="w-4 h-4" />}
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setSkillModalOpen(true)}
        >
          Add Skill
        </Button>

        <AddKeywordModal
          open={skillModalOpen}
          onClose={() => setSkillModalOpen(false)}
          gameSlug="blood-bowl"
          typeName="Skill"
          valueExamples="Loner (X), Mighty Blow (X)"
          onKeywordSelected={(kw) => {
            const updated = [...activeCard.unitKeywords, kw];
            updateActiveCard({
              unitKeywords: updated,
              skills: buildSkillsDisplayString(updated),
            });
            setSkillModalOpen(false);
          }}
          excludeKeywordIds={activeCard.unitKeywords.map(k => k.keywordId)}
        />

        <KeywordInfoModal
          open={!!viewingSkill}
          onClose={() => setViewingSkill(null)}
          name={viewingSkill?.keywordName ?? ''}
          description={viewingSkill?.description ?? ''}
          typeName="Skill"
          onEdit={() => {
            setEditingSkill(viewingSkill);
            setViewingSkill(null);
          }}
        />

        <AddKeywordModal
          open={!!editingSkill}
          onClose={() => setEditingSkill(null)}
          gameSlug="blood-bowl"
          typeName="Skill"
          valueExamples="Loner (X), Mighty Blow (X)"
          editingKeyword={editingSkill ? {
            id: editingSkill.keywordId,
            name: editingSkill.keywordName,
            description: editingSkill.description,
            hasParams: editingSkill.hasParams,
          } : null}
          onKeywordSelected={() => {}}
          onKeywordUpdated={(updated) => {
            propagateKeywordUpdate(updated.keywordId, updated.keywordName, updated.description, updated.hasParams);
            setEditingSkill(null);
          }}
        />
      </section>

    </div>
  );

  // ── Mobile layout ─────────────────────────────────────────────────────────────
  if (isMobile) return (
    <div className="flex flex-col bg-gray-950 h-screen overflow-hidden">
      <Navbar fixed={false} />

      <div className="relative z-20 shrink-0">
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 bg-gray-900 border-b border-gray-700"
          style={{ height: 42 }}
          onClick={() => setUnitListOpen(o => !o)}
        >
          <img
            src={logoBloodBowl}
            alt="Blood Bowl"
            className="h-7 w-7 rounded-full object-contain shrink-0"
          />
          <div className="flex-1 text-left min-w-0">
            <p className="font-body text-sm font-semibold text-white truncate">
              {activeCard.unitName || 'New Unit'}
            </p>
            <p className="font-body text-xs text-gray-500 uppercase tracking-wide truncate">
              {activeCard.playerRole || 'No Role'}
            </p>
          </div>
          {unitListOpen
            ? <AltArrowUp   className="w-4 h-4 text-gray-400 shrink-0" />
            : <AltArrowDown className="w-4 h-4 text-gray-400 shrink-0" />}
        </button>

        {unitListOpen && (
          <div className="absolute top-full left-0 right-0 bg-gray-900 border-b border-gray-700 shadow-xl z-10">
            <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
              {editingDeckName ? (
                <input
                  ref={deckNameInputRef}
                  type="text"
                  defaultValue={deckName ?? ''}
                  className="flex-1 min-w-0 bg-gray-800 border border-gray-600 rounded px-2 py-0.5
                             font-heading text-xs font-bold text-white uppercase tracking-wide
                             outline-none focus:border-blue-500"
                  onBlur={e => commitDeckName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitDeckName(e.currentTarget.value);
                    if (e.key === 'Escape') setEditingDeckName(false);
                  }}
                />
              ) : (
                <p
                  className="flex-1 min-w-0 font-heading text-xs font-bold text-white uppercase tracking-wide truncate cursor-pointer"
                  onDoubleClick={startDeckNameEdit}
                  title="Double-click to rename"
                >
                  {deckName ?? '—'}
                </p>
              )}
              <button
                type="button"
                onClick={() => editMode ? handleDoneEditing() : setEditMode(true)}
                className="shrink-0 p-1 rounded hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
              >
                {editMode
                  ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                  : <Pen2 className="w-3.5 h-3.5" />
                }
              </button>
            </div>
            <nav className="px-3 py-2 space-y-1">
              {cards.map((card, i) => (
                <div
                  key={card.id}
                  className={`flex items-center gap-1 ${
                    editMode && dragOverIndex === i ? 'border-t-2 border-blue-500' : 'border-t-2 border-transparent'
                  }`}
                  onDragOver={editMode ? (e) => handleDragOver(e, i) : undefined}
                  onDrop={editMode ? handleDrop : undefined}
                >
                  {editMode && (
                    <div
                      draggable
                      onDragStart={() => handleDragStart(i)}
                      onDragEnd={handleDragEnd}
                      className="shrink-0 cursor-grab active:cursor-grabbing p-0.5 text-gray-500 hover:text-gray-300"
                    >
                      <HamburgerMenu className="w-4 h-4" />
                    </div>
                  )}
                  <div className={editMode ? 'flex-1 min-w-0' : 'w-full'}>
                    <UnitListEntry
                      status={card.dbId ? 'complete' : 'blank'}
                      unitName={card.unitName || undefined}
                      unitType={card.playerRole || undefined}
                      avatarSrc={card.avatarUrl ?? iconBloodBowl}
                      active={card.id === activeCardId}
                      onClick={() => {
                        setCardState(s => ({ ...s, activeCardId: card.id }));
                        if (!editMode) setUnitListOpen(false);
                      }}
                    />
                  </div>
                  {editMode && (
                    <button
                      type="button"
                      aria-label={`Delete ${card.unitName || 'unit'}`}
                      onClick={e => {
                        e.stopPropagation();
                        requestDeleteCard(card);
                      }}
                      disabled={cards.length <= 1}
                      className="shrink-0 p-1 rounded text-gray-500 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title={cards.length <= 1 ? 'At least one unit is required' : 'Delete unit'}
                    >
                      <TrashBinMinimalistic className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </nav>
            <div className="px-3 pb-3 space-y-3">
              <HR className="!my-0" />
              {editMode ? (
                <Button
                  leftIcon={<CheckCircle className="w-4 h-4" />}
                  color="primary"
                  size="sm"
                  className="w-full"
                  onClick={handleDoneEditing}
                  loading={savingEdits}
                >
                  Done
                </Button>
              ) : (
                <Button
                  leftIcon={<AddCircle className="w-4 h-4" />}
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={addCard}
                >
                Add Unit
              </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div
        className="flex-1 overflow-hidden relative px-3 pt-3"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (unitListOpen) setUnitListOpen(false); }}
      >
        {unitListOpen && (
          <div
            className="absolute inset-0 bg-black/60 z-10"
            onClick={() => setUnitListOpen(false)}
          />
        )}

        <div
          style={{
            width:      CARD_W * mobileScale,
            height:     CARD_H * mobileScale,
            position:   'relative',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position:        'absolute',
              top:             0,
              left:            0,
              transform:       `scale(${mobileScale})`,
              transformOrigin: 'top left',
            }}
          >
            <BloodBowlCard
              teamName={activeCard.teamName     || 'Team Name'}
              unitName={activeCard.unitName     || 'Unit Name'}
              playerRole={activeCard.playerRole || 'Player Role'}
              cost={activeCard.cost             || '?'}
              skills={skillsString}
              skillData={activeCard.unitKeywords.map(k => ({
                label: k.paramValue != null ? `${k.keywordName} (${k.paramValue})` : k.keywordName,
                name: k.keywordName,
                description: k.description,
              }))}
              portrait={activeCard.portraitUrl ?? undefined}
              primaryAttribute={activeCard.primaryAttr.length   ? activeCard.primaryAttr.join(', ')   : '—'}
              secondaryAttribute={activeCard.secondaryAttr.length ? activeCard.secondaryAttr.join(', ') : '—'}
              ma={activeCard.move}
              st={activeCard.strength}
              ag={activeCard.agility}
              pa={activeCard.passing}
              av={activeCard.armor}
              onTeamNameChange={v   => updateActiveCard({ teamName:   v })}
              onUnitNameChange={v   => updateActiveCard({ unitName:   v })}
              onPlayerRoleChange={v => updateActiveCard({ playerRole: v })}
              onCostChange={v       => updateActiveCard({ cost:       v })}
              onMaChange={v         => updateActiveCard({ move:       v })}
              onStChange={v         => updateActiveCard({ strength:   v })}
              onAgChange={v         => updateActiveCard({ agility:    v })}
              onPaChange={v         => updateActiveCard({ passing:    v })}
              onAvChange={v         => updateActiveCard({ armor:      v })}
              onEditSkill={(sk) => {
                const match = activeCard.unitKeywords.find(k => k.keywordName === sk.name);
                if (match) setEditingSkill(match);
              }}
            />
          </div>
        </div>
      </div>

      <div className="shrink-0 bg-gray-900 border-t border-gray-700 z-20 relative">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-4 border-b border-gray-700"
          onClick={() => setEditPanelOpen(o => !o)}
        >
          <h2 className="font-heading text-sm font-bold text-white uppercase tracking-wide">
            Edit Card
          </h2>
          {editPanelOpen
            ? <AltArrowDown className="w-4 h-4 text-gray-400" />
            : <AltArrowUp   className="w-4 h-4 text-gray-400" />}
        </button>

        {editPanelOpen && (
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(50vh - 53px)' }}>
            {editorForm}
          </div>
        )}
      </div>

      {/* Delete portrait confirmation modal */}
      <Modal
        open={deletePortraitConfirm}
        onClose={() => !deletingPortrait && setDeletePortraitConfirm(false)}
        className="max-w-sm"
      >
        <div className="p-5 flex flex-col gap-3">
          <TrashBinMinimalistic className="w-8 h-8 text-blue-500" />
          <h3 className="font-heading text-xl text-white tracking-tight">Delete this image?</h3>
          <p className="font-body text-base text-gray-300">
            This can't be undone, but you can upload a different image.
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" size="sm" disabled={deletingPortrait} onClick={() => setDeletePortraitConfirm(false)}>
              Cancel
            </Button>
            <Button color="danger" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}
              loading={deletingPortrait} onClick={handleDeletePortrait}
            >
              Yes, Delete this portrait image
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete card confirmation modal */}
      <Modal
        open={deleteCardConfirmOpen}
        onClose={() => !deletingCard && closeDeleteCardConfirm()}
        className="max-w-sm"
      >
        <div className="p-5 flex flex-col gap-3">
          <TrashBinMinimalistic className="w-8 h-8 text-blue-500" />
          <h3 className="font-heading text-xl text-white tracking-tight">Delete this unit?</h3>
          <p className="font-body text-base text-gray-300">
            This will permanently delete {cardPendingDelete?.unitName ? `“${cardPendingDelete.unitName}”` : 'this unit'}.
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" size="sm" disabled={deletingCard} onClick={closeDeleteCardConfirm}>
              Cancel
            </Button>
            <Button color="danger" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}
              loading={deletingCard} onClick={handleConfirmDeleteCard}
            >
              Yes, Delete Unit
            </Button>
          </div>
        </div>
      </Modal>

      {/* Upload Photo modal */}
      <UploadPhotoModal
        open={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        game="blood-bowl"
        cardDbId={activeCard.dbId}
        unitName={activeCard.unitName || undefined}
        onImageUploaded={(url, _pStyle) => updateActiveCard({ portraitUrl: url })}
        onAvatarUploaded={url => updateActiveCard({ avatarUrl: url })}
      />

    </div>
  );

  // ── Desktop layout (≥ 768px) ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      <Navbar fixed={false} />

      <div
        className="flex flex-1 overflow-hidden"
      >

        {/* Left panel */}
        <aside className="w-64 shrink-0 flex flex-col bg-gray-900
                          border-r border-gray-700 overflow-hidden">
          {/* Deck name header */}
          <div className="px-4 py-4 border-b border-gray-700 shrink-0 flex items-center gap-2">
            {editingDeckName ? (
              <input
                ref={deckNameInputRef}
                type="text"
                defaultValue={deckName ?? ''}
                className="flex-1 min-w-0 bg-gray-800 border border-gray-600 rounded px-2 py-0.5
                           font-heading text-sm font-bold text-white uppercase tracking-wide
                           outline-none focus:border-blue-500"
                onBlur={e => commitDeckName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitDeckName(e.currentTarget.value);
                  if (e.key === 'Escape') setEditingDeckName(false);
                }}
              />
            ) : (
              <p
                className="flex-1 min-w-0 font-heading text-sm font-bold text-white uppercase tracking-wide truncate cursor-pointer"
                onDoubleClick={startDeckNameEdit}
                title="Double-click to rename"
              >
                {deckName ?? '—'}
              </p>
            )}
            <button
              type="button"
              onClick={() => editMode ? handleDoneEditing() : setEditMode(true)}
              className="shrink-0 p-1 rounded hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
              title={editMode ? 'Done editing' : 'Edit deck'}
            >
              {editMode
                ? <CheckCircle className="w-4 h-4 text-green-400" />
                : <Pen2 className="w-4 h-4" />
              }
            </button>
          </div>

          {/* Card list */}
          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
            {cards.map((card, i) => (
              <div
                key={card.id}
                className={`flex items-center gap-1 ${
                  editMode && dragOverIndex === i ? 'border-t-2 border-blue-500' : 'border-t-2 border-transparent'
                }`}
                onDragOver={editMode ? (e) => handleDragOver(e, i) : undefined}
                onDrop={editMode ? handleDrop : undefined}
              >
                {editMode && (
                  <div
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragEnd={handleDragEnd}
                    className="shrink-0 cursor-grab active:cursor-grabbing p-0.5 text-gray-500 hover:text-gray-300"
                  >
                    <HamburgerMenu className="w-4 h-4" />
                  </div>
                )}
                <div className={editMode ? 'flex-1 min-w-0' : 'w-full'}>
                  <UnitListEntry
                    status={card.dbId ? 'complete' : 'blank'}
                    unitName={card.unitName || undefined}
                    unitType={card.playerRole || undefined}
                    avatarSrc={card.avatarUrl ?? iconBloodBowl}
                    active={card.id === activeCardId}
                    onClick={() => setCardState(s => ({ ...s, activeCardId: card.id }))}
                  />
                </div>
                {editMode && (
                  <button
                    type="button"
                    aria-label={`Delete ${card.unitName || 'unit'}`}
                    onClick={e => {
                      e.stopPropagation();
                      requestDeleteCard(card);
                    }}
                    disabled={cards.length <= 1}
                    className="shrink-0 p-1 rounded text-gray-500 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title={cards.length <= 1 ? 'At least one unit is required' : 'Delete unit'}
                  >
                    <TrashBinMinimalistic className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-3 pb-3 shrink-0 flex flex-col gap-3">
            <HR className="!my-0" />
            {editMode ? (
              <Button
                leftIcon={<CheckCircle className="w-4 h-4" />}
                color="primary"
                size="sm"
                className="w-full"
                onClick={handleDoneEditing}
                loading={savingEdits}
              >
                Done
              </Button>
            ) : (
              <Button
                leftIcon={<AddCircle className="w-4 h-4" />}
                variant="outline"
                size="sm"
                className="w-full"
                onClick={addCard}
              >
                Add Unit
              </Button>
            )}
          </div>
        </aside>

        {/* Center — carousel card display */}
        <main className="flex-1 flex flex-col items-center overflow-hidden bg-gray-950">
          <div className="flex items-center justify-center w-full shrink-0 py-3">
            <img src={logoBloodBowl} alt="Blood Bowl" className="h-10 w-auto" />
          </div>

          {/* Carousel viewport — overflow hidden hides off-screen adjacent cards */}
          <div
            ref={cardContainerRef}
            className="flex-1 min-h-0 w-full overflow-hidden relative select-none"
            onPointerDown={e => {
              if (phaseRef.current !== 'idle') return;
              draggingRef.current   = true;
              dragStartXRef.current = e.clientX;
            }}
            onPointerMove={e => {
              if (!draggingRef.current) return;
              const delta = e.clientX - dragStartXRef.current;
              // Capture pointer once the user has dragged a meaningful distance
              if (Math.abs(delta) > 5 && !(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              }
              applyStripTransform(delta, false);
              // Live scale + opacity: interpolate proportional to drag progress
              const cs   = cardScaleRef.current;
              const as   = cs * ADJACENT_SCALE;
              const adjO = cardsLengthRef.current >= 2 ? 0.5 : 0;
              const t    = Math.min(1, Math.max(-1, delta / getSlideDistance()));
              applyCardStyles(
                as   + (cs   - as)   * Math.max(0,  t),  // prev scale grows right
                cs   - (cs   - as)   * Math.abs(t),       // active scale shrinks
                as   + (cs   - as)   * Math.max(0, -t),  // next scale grows left
                adjO + (1    - adjO) * Math.max(0,  t),  // prev opacity brightens right
                1    - (1    - adjO) * Math.abs(t),       // active opacity dims
                adjO + (1    - adjO) * Math.max(0, -t),  // next opacity brightens left
                false,
              );
            }}
            onPointerUp={e => {
              if (!draggingRef.current) return;
              draggingRef.current = false;
              const delta     = e.clientX - dragStartXRef.current;
              const threshold = 80;
              const idx       = cards.findIndex(c => c.id === activeCardId);
              if (Math.abs(delta) < 5) {
                // Treat as click — snap any micro-offset back
                applyStripTransform(0, true);
                resetCardStyles(true);
              } else if (delta < -threshold && cards.length >= 2) {
                navigateCarousel(cards[(idx + 1) % cards.length].id, 'next');
              } else if (delta > threshold && cards.length >= 2) {
                navigateCarousel(cards[(idx - 1 + cards.length) % cards.length].id, 'prev');
              } else {
                // Didn't cross threshold — spring everything back
                applyStripTransform(0, true);
                resetCardStyles(true);
              }
            }}
            onPointerCancel={() => {
              draggingRef.current = false;
              applyStripTransform(0, true);
              resetCardStyles(true);
            }}
          >
            {/* Strip — absolute, vertically centred; card divs are native-size with center-origin scale */}
            {(() => {
              const idx      = cards.findIndex(c => c.id === activeCardId);
              // Circular: wrap around so the last card shows the first as its "next" and vice-versa
              const prevCard = cards.length >= 2 ? cards[(idx - 1 + cards.length) % cards.length] : null;
              const nextCard = cards.length >= 2 ? cards[(idx + 1) % cards.length] : null;
              // Visual widths at current zoom
              const adjW    = CARD_W * cardScale * ADJACENT_SCALE;
              const activeW = CARD_W * cardScale;
              // Left edge of each card div so its visual centre lands where we want it.
              // With transformOrigin:center the div centre == visual centre, so:
              //   divLeft = visualCentre - CARD_W/2
              const prevLeft   = adjW / 2                                           - CARD_W / 2;
              const activeLeft = adjW + CARD_GAP + activeW / 2                      - CARD_W / 2;
              const nextLeft   = adjW + CARD_GAP + activeW + CARD_GAP + adjW / 2   - CARD_W / 2;
              return (
                <div
                  ref={stripRef}
                  style={{
                    position:   'absolute',
                    top:        '50%',
                    left:       0,
                    height:     CARD_H,
                    marginTop:  -(CARD_H / 2),
                    willChange: 'transform',
                  }}
                  onTransitionEnd={handleStripTransitionEnd}
                >
                  {/* ── Prev card — ref-controlled scale+opacity, neither in JSX ── */}
                  <div
                    ref={prevCardRef}
                    style={{
                      position:        'absolute',
                      top:             0,
                      left:            prevLeft,
                      width:           CARD_W,
                      height:          CARD_H,
                      transformOrigin: 'center center',
                      cursor:          prevCard ? 'pointer' : 'default',
                      pointerEvents:   prevCard ? 'auto' : 'none',
                      filter:          'drop-shadow(0 4.179px 56.411px rgba(30,31,110,0.75))',
                    }}
                    onClick={() => prevCard && navigateCarousel(prevCard.id, 'prev')}
                  >
                    {prevCard && (
                      <BloodBowlCard
                        teamName={prevCard.teamName     || 'Team Name'}
                        unitName={prevCard.unitName     || 'Unit Name'}
                        playerRole={prevCard.playerRole || 'Player Role'}
                        cost={prevCard.cost             || '?'}
                        skills={prevCard.skills}
                        portrait={prevCard.portraitUrl ?? undefined}
                        primaryAttribute={prevCard.primaryAttr.join(', ')   || '—'}
                        secondaryAttribute={prevCard.secondaryAttr.join(', ') || '—'}
                        ma={prevCard.move} st={prevCard.strength} ag={prevCard.agility}
                        pa={prevCard.passing} av={prevCard.armor}
                      />
                    )}
                  </div>

                  {/* ── Active card — ref-controlled scale, no transform in JSX ── */}
                  <div
                    ref={activeCardRef}
                    style={{
                      position:        'absolute',
                      top:             0,
                      left:            activeLeft,
                      width:           CARD_W,
                      height:          CARD_H,
                      transformOrigin: 'center center',
                    }}
                  >
                    <Card3DWrapper
                      style={{
                        width:  CARD_W,
                        height: CARD_H,
                        filter: 'drop-shadow(0 5.571px 75.215px rgba(30,31,110,0.75))',
                      }}
                    >
                      <BloodBowlCard
                        teamName={activeCard.teamName     || 'Team Name'}
                        unitName={activeCard.unitName     || 'Unit Name'}
                        playerRole={activeCard.playerRole || 'Player Role'}
                        cost={activeCard.cost             || '?'}
                        skills={skillsString}
                        skillData={activeCard.unitKeywords.map(k => ({
                          label: k.paramValue != null ? `${k.keywordName} (${k.paramValue})` : k.keywordName,
                          name: k.keywordName,
                          description: k.description,
                        }))}
                        portrait={activeCard.portraitUrl ?? undefined}
                        primaryAttribute={activeCard.primaryAttr.length   ? activeCard.primaryAttr.join(', ')   : '—'}
                        secondaryAttribute={activeCard.secondaryAttr.length ? activeCard.secondaryAttr.join(', ') : '—'}
                        ma={activeCard.move}
                        st={activeCard.strength}
                        ag={activeCard.agility}
                        pa={activeCard.passing}
                        av={activeCard.armor}
                        onTeamNameChange={v   => updateActiveCard({ teamName:   v })}
                        onUnitNameChange={v   => updateActiveCard({ unitName:   v })}
                        onPlayerRoleChange={v => updateActiveCard({ playerRole: v })}
                        onCostChange={v       => updateActiveCard({ cost:       v })}
                        onMaChange={v => updateActiveCard({ move:     v })}
                        onStChange={v => updateActiveCard({ strength: v })}
                        onAgChange={v => updateActiveCard({ agility:  v })}
                        onPaChange={v => updateActiveCard({ passing:  v })}
                        onAvChange={v => updateActiveCard({ armor:    v })}
                        onEditSkill={(sk) => {
                          const match = activeCard.unitKeywords.find(k => k.keywordName === sk.name);
                          if (match) setEditingSkill(match);
                        }}
                      />
                    </Card3DWrapper>
                  </div>

                  {/* ── Next card — ref-controlled scale+opacity, neither in JSX ── */}
                  <div
                    ref={nextCardRef}
                    style={{
                      position:        'absolute',
                      top:             0,
                      left:            nextLeft,
                      width:           CARD_W,
                      height:          CARD_H,
                      transformOrigin: 'center center',
                      cursor:          nextCard ? 'pointer' : 'default',
                      pointerEvents:   nextCard ? 'auto' : 'none',
                      filter:          'drop-shadow(0 4.179px 56.411px rgba(30,31,110,0.75))',
                    }}
                    onClick={() => nextCard && navigateCarousel(nextCard.id, 'next')}
                  >
                    {nextCard && (
                      <BloodBowlCard
                        teamName={nextCard.teamName     || 'Team Name'}
                        unitName={nextCard.unitName     || 'Unit Name'}
                        playerRole={nextCard.playerRole || 'Player Role'}
                        cost={nextCard.cost             || '?'}
                        skills={nextCard.skills}
                        portrait={nextCard.portraitUrl ?? undefined}
                        primaryAttribute={nextCard.primaryAttr.join(', ')   || '—'}
                        secondaryAttribute={nextCard.secondaryAttr.join(', ') || '—'}
                        ma={nextCard.move} st={nextCard.strength} ag={nextCard.agility}
                        pa={nextCard.passing} av={nextCard.armor}
                      />
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="shrink-0 flex items-center gap-2 py-3">
            <Button
              leftIcon={<MinusCircle className="w-4 h-4" />}
              variant="outline"
              size="sm"
              disabled={zoomLevel <= 0.5}
              onClick={zoomOut}
            >
              Zoom Out
            </Button>
            <Button
              rightIcon={<AddCircle className="w-4 h-4" />}
              variant="outline"
              size="sm"
              disabled={zoomLevel >= 1.0}
              onClick={zoomIn}
            >
              Zoom In
            </Button>
          </div>
        </main>

        {/* Right panel — editor */}
        <aside className="w-64 shrink-0 flex flex-col bg-gray-900
                          border-l border-gray-700 overflow-hidden">
          <div className="px-4 py-4 border-b border-gray-700 shrink-0">
            <h2 className="font-heading text-sm font-bold text-white uppercase tracking-wide">
              Edit Card
            </h2>
          </div>

          {editorForm}
        </aside>

      </div>

      {/* Delete portrait confirmation modal */}
      <Modal
        open={deletePortraitConfirm}
        onClose={() => !deletingPortrait && setDeletePortraitConfirm(false)}
        className="max-w-sm"
      >
        <div className="p-5 flex flex-col gap-3">
          <TrashBinMinimalistic className="w-8 h-8 text-blue-500" />
          <h3 className="font-heading text-xl text-white tracking-tight">Delete this image?</h3>
          <p className="font-body text-base text-gray-300">
            This can't be undone, but you can upload a different image.
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" size="sm" disabled={deletingPortrait} onClick={() => setDeletePortraitConfirm(false)}>
              Cancel
            </Button>
            <Button color="danger" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}
              loading={deletingPortrait} onClick={handleDeletePortrait}
            >
              Yes, Delete this portrait image
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete card confirmation modal */}
      <Modal
        open={deleteCardConfirmOpen}
        onClose={() => !deletingCard && closeDeleteCardConfirm()}
        className="max-w-sm"
      >
        <div className="p-5 flex flex-col gap-3">
          <TrashBinMinimalistic className="w-8 h-8 text-blue-500" />
          <h3 className="font-heading text-xl text-white tracking-tight">Delete this unit?</h3>
          <p className="font-body text-base text-gray-300">
            This will permanently delete {cardPendingDelete?.unitName ? `“${cardPendingDelete.unitName}”` : 'this unit'}.
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" size="sm" disabled={deletingCard} onClick={closeDeleteCardConfirm}>
              Cancel
            </Button>
            <Button color="danger" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}
              loading={deletingCard} onClick={handleConfirmDeleteCard}
            >
              Yes, Delete Unit
            </Button>
          </div>
        </div>
      </Modal>

      {/* Upload Photo modal */}
      <UploadPhotoModal
        open={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        game="blood-bowl"
        cardDbId={activeCard.dbId}
        unitName={activeCard.unitName || undefined}
        onImageUploaded={(url, _pStyle) => updateActiveCard({ portraitUrl: url })}
        onAvatarUploaded={url => updateActiveCard({ avatarUrl: url })}
      />

    </div>
  );
};

export default CardBuilderBloodBowl;
