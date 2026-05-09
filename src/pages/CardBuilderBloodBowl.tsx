/**
 * CardBuilderBloodBowl.tsx — Blood Bowl card builder screen
 *
 * Allows the user to edit a Blood Bowl card. The live card component
 * (BloodBowlCard) is rendered in the centre column, wired to the editor
 * state in the right panel.
 *
 * LAYOUT (lg ≥ 1024px):
 * ┌──────────────────────────────────────────────────────────┐
 * │  Navbar (fixed, full width)                              │
 * ├──────────┬──────────────────────────┬────────────────────┤
 * │  Unit    │      Card display        │    Edit Card       │
 * │  List    │   (logo + live card)     │   (editor panel)   │
 * │  (256px) │        (flex-1)          │      (256px)       │
 * └──────────┴──────────────────────────┴────────────────────┘
 *
 * Below lg: both sidebars collapse, center viewport + logo remain, and the
 * navbar's ModeToggle + Print link collapses into a single mode dropdown.
 *
 * Route: /app/builder/blood-bowl?deckId=<uuid>
 */

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import Navbar from '../components/Navbar';
import ModeToggle, { type Mode } from '../components/ModeToggle';
import PlaySubnav, { type PlayTab } from '../components/PlaySubnav';
import EditSubnav from '../components/EditSubnav';
import BuilderShell from '../components/BuilderShell';
import CardListPanel from '../components/CardListPanel';
import EditorPanel from '../components/EditorPanel';
import CenterViewport from '../components/CenterViewport';
import { useCardBuilder } from '../hooks/useCardBuilder';
import Dropdown, { DropdownItem } from '../components/Dropdown';
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
import Card, { CardBody } from '../components/Card';
import Magnifer from '../icons/Magnifer';
import UploadPhotoModal from '../components/UploadPhotoModal';
import SaveTemplateModal from '../components/SaveTemplateModal';
import NewCardModal, { type NewCardModalTemplate } from '../components/NewCardModal';
import UsersGroupRounded from '../icons/UsersGroupRounded';
import UserRounded from '../icons/UserRounded';
import Star from '../icons/Star';
import AddCircle from '../icons/AddCircle';
import MinusCircle from '../icons/MinusCircle';
import CheckCircle from '../icons/CheckCircle';
import AltArrowDown from '../icons/AltArrowDown';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';
import Diskette from '../icons/Diskette';
import ArrowRight from '../icons/ArrowRight';
import Pen2 from '../icons/Pen2';
import Play from '../icons/Play';
import HamburgerMenu from '../icons/HamburgerMenu';
import { supabase } from '../lib/supabase';
import { fetchConstraints, getMaxLength, getMaxKeywords, isAtLimit } from '../lib/constraints';
import type { BloodBowlStats, EntityConstraints } from '../lib/database.types';
import logoBloodBowl from '../assets/games/logo-blood-bowl.png';
import iconBloodBowl from '../assets/games/card assets/blood-bowl/icon.png';

// ── Navbar height ─────────────────────────────────────────────────────────────

// ── Card native dimensions ────────────────────────────────────────────────────
const CARD_W = 750;
const CARD_H = 1100;

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
  const navigate = useNavigate();
  const deckId = searchParams.get('deckId');

  // ── Play mode toggle ─────────────────────────────────────────────────────────
  const [appMode, setAppMode] = useState<Mode>('edit');

  // ── Shared builder chrome (panel toggles, responsive, deck-name) ────────────
  const builder = useCardBuilder({ deckId });
  const {
    cardListOpen, editorOpen, toggleCardList, toggleEditor,
    isMobile, isShortHeight, mobilePanelOpen,
    deckName, setDeckName, editingDeckName, setEditingDeckName,
    deckNameInputRef, startDeckNameEdit,
  } = builder;

  const [playTab, setPlayTab] = useState<PlayTab>('units');
  const [ruleSearchQuery, setRuleSearchQuery] = useState('');

  // ── Keyword card fade-out/fade-in transition ────────────────────────────────
  const [kwDisplayId, setKwDisplayId] = useState<string>('');
  const [kwFading, setKwFading] = useState(false);

  // ── Edit mode (reorder + rename + duplicate + delete) ────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);
  const dragItemRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [confirmDeleteCardId, setConfirmDeleteCardId] = useState<string | null>(null);

  // ── Card list state ───────────────────────────────────────────────────────────
  const [cardState, setCardState] = useState(() => {
    const card = defaultCard();
    return { cards: [card] as BloodBowlCardData[], activeCardId: card.id };
  });
  const { cards, activeCardId } = cardState;
  const activeCard = cards.find(c => c.id === activeCardId) ?? cards[0];

  // When activeCardId changes (after carousel transition ends), swap displayed keywords and fade in
  useEffect(() => {
    if (!kwDisplayId) { setKwDisplayId(activeCardId); return; }
    if (activeCardId === kwDisplayId) return;
    setKwDisplayId(activeCardId);
    setKwFading(false);
  }, [activeCardId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Play mode: combined keywords list (Blood Bowl has no rules) ────────────
  const playKeywords = (() => {
    const kwMap = new Map<string, { name: string; description: string }>();
    for (const c of cards) {
      for (const k of c.unitKeywords) {
        if (!kwMap.has(k.keywordId)) kwMap.set(k.keywordId, { name: k.keywordName, description: k.description });
      }
    }
    return [...kwMap.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(k => ({ key: `kw-${k.name}`, title: k.name, description: k.description }));
  })();

  // ── Dirty tracking (cards that need saving) ───────────────────────────────────
  const dirtyCardsRef = useRef<Set<string>>(new Set());

  // ── DB-driven constraints ─────────────────────────────────────────────────────
  const [cardConstraints, setCardConstraints] = useState<EntityConstraints>({});
  const [keywordConstraints, setKeywordConstraints] = useState<EntityConstraints>({});
  useEffect(() => {
    fetchConstraints('blood-bowl', 'card').then(setCardConstraints);
    fetchConstraints('blood-bowl', 'keyword').then(setKeywordConstraints);
  }, []);

  const updateActiveCard = (patch: Partial<BloodBowlCardData>) => {
    dirtyCardsRef.current.add(activeCardId);
    setCardState(s => ({
      ...s,
      cards: s.cards.map(c => c.id === s.activeCardId ? { ...c, ...patch } : c),
    }));
  };

  const addBlankCard = () => {
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

  // ── New Card modal (shown when templates exist) ─────────────────────────────
  const [newCardModalOpen, setNewCardModalOpen] = useState(false);
  const [newCardTemplates, setNewCardTemplates] = useState<NewCardModalTemplate[]>([]);

  const addCard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { addBlankCard(); return; }

      const { data: game } = await supabase
        .from('games')
        .select('id')
        .eq('slug', 'blood-bowl')
        .single();
      if (!game) { addBlankCard(); return; }

      const { data: templates } = await supabase
        .from('cards')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('game_id', game.id)
        .eq('is_template', true)
        .order('name');

      if (!templates || templates.length === 0) { addBlankCard(); return; }

      setNewCardTemplates(templates);
      setNewCardModalOpen(true);
    } catch (err) {
      console.error('[BattleCards] Failed to load templates:', err);
      addBlankCard();
    }
  };

  const createFromTemplate = async (templateId: string) => {
    if (!deckId) return;

    type TemplateRow = {
      name: string;
      stats: BloodBowlStats;
      card_addons: { addon_id: string; sort_order: number | null }[];
      card_keywords: {
        keyword_id: string;
        params: Record<string, unknown>;
        sort_order: number | null;
        keywords: { name: string; description: string | null; params_schema: { key: string; type: string; label: string }[] } | null;
      }[];
    };

    const { data: tmpl, error } = await supabase
      .from('cards')
      .select('name, stats, card_addons(addon_id, sort_order), card_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema))')
      .eq('id', templateId)
      .single();
    if (error || !tmpl) { console.error('[BattleCards] Template fetch failed:', error); return; }

    const src = tmpl as unknown as TemplateRow;

    const { data: newRow, error: insertErr } = await supabase
      .from('cards')
      .insert({
        deck_id:    deckId,
        name:       src.name,
        stats:      src.stats,
        sort_order: cards.length,
      })
      .select('id')
      .single();
    if (insertErr || !newRow) { console.error('[BattleCards] Card insert failed:', insertErr); return; }

    const addons = src.card_addons ?? [];
    if (addons.length > 0) {
      await supabase.from('card_addons').insert(
        addons.map(a => ({ card_id: newRow.id, addon_id: a.addon_id, sort_order: a.sort_order })),
      );
    }

    const kws = src.card_keywords ?? [];
    if (kws.length > 0) {
      await supabase.from('card_keywords').insert(
        kws.map(k => ({ card_id: newRow.id, keyword_id: k.keyword_id, params: k.params, sort_order: k.sort_order })),
      );
    }

    const loadedKeywords: LocalKeywordAttachment[] = kws
      .filter(k => k.keywords != null)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(k => ({
        keywordId:   k.keyword_id,
        keywordName: k.keywords!.name,
        description: k.keywords!.description ?? '',
        hasParams:   Array.isArray(k.keywords!.params_schema) && k.keywords!.params_schema.length > 0,
        paramValue:  k.params?.X != null ? Number(k.params.X) : null,
      }));

    const s = (src.stats ?? {}) as BloodBowlStats;
    const localCard: BloodBowlCardData = {
      id:            crypto.randomUUID(),
      dbId:          newRow.id,
      teamName:      s.teamName   ?? '',
      unitName:      src.name,
      playerRole:    s.playerRole ?? '',
      cost:          s.cost       ?? '',
      move:          s.ma         ?? 0,
      strength:      s.st         ?? 0,
      agility:       s.ag         ?? 0,
      passing:       s.pa         ?? 0,
      armor:         s.av         ?? 0,
      primaryAttr:   s.primaryAttribute   ? s.primaryAttribute.split(', ').filter(Boolean)   : [],
      secondaryAttr: s.secondaryAttribute ? s.secondaryAttribute.split(', ').filter(Boolean) : [],
      skills:        buildSkillsDisplayString(loadedKeywords),
      unitKeywords:  loadedKeywords,
      portraitUrl:   null,
      avatarUrl:     null,
    };
    setCardState(st => ({ cards: [...st.cards, localCard], activeCardId: localCard.id }));
    setNewCardModalOpen(false);
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase.from('cards').delete().eq('id', templateId);
      if (error) throw error;
      setNewCardTemplates(list => {
        const next = list.filter(t => t.id !== templateId);
        if (next.length === 0) setNewCardModalOpen(false);
        return next;
      });
    } catch (err) {
      console.error('[BattleCards] Failed to delete template:', err);
    }
  };

  // ── Deck name inline rename ─────────────────────────────────────────────────
  // `startDeckNameEdit` comes from useCardBuilder. `commitDeckName` skips the
  // Supabase persist when editMode is on, since editMode batches its own save.
  const commitDeckName = useCallback(
    (newName: string) => builder.commitDeckName(newName, { persist: !editMode }),
    [builder, editMode],
  );

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

  // ── Duplicate card ─────────────────────────────────────────────────────────
  const duplicateCard = useCallback(async (cardId: string) => {
    const source = cards.find(c => c.id === cardId);
    if (!source || !deckId) return;

    const cloneId = crypto.randomUUID();
    let cloneDbId: string | null = null;
    let clonePortraitUrl: string | null = source.portraitUrl;
    let cloneAvatarUrl: string | null = source.avatarUrl;

    // If the source card has persisted images, copy them in storage
    if (source.dbId && (source.portraitUrl || source.avatarUrl)) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Create the new card in DB first so we have a card_id for images
        const { data: newRow, error: insertErr } = await supabase
          .from('cards')
          .insert({ deck_id: deckId, name: source.unitName || 'Unnamed Unit', stats: toBloodBowlStats(source) })
          .select('id')
          .single();
        if (insertErr) throw insertErr;
        cloneDbId = newRow.id;

        // Find the source card's images
        const { data: srcImages } = await supabase
          .from('card_images')
          .select('file_path, image_type, sort_order')
          .eq('card_id', source.dbId);

        if (srcImages && srcImages.length > 0) {
          for (const img of srcImages) {
            const ext = img.file_path.split('.').pop() ?? 'jpg';
            const prefix = img.image_type === 'avatar' ? 'avatar-' : '';
            const newFileName = `${prefix}${crypto.randomUUID()}.${ext}`;
            const newPath = `${user.id}/${cloneDbId}/${newFileName}`;

            await supabase.storage.from('card-images').copy(img.file_path, newPath);

            const { data: { publicUrl } } = supabase.storage
              .from('card-images')
              .getPublicUrl(newPath);

            await supabase.from('card_images').insert({
              card_id: cloneDbId,
              file_path: newPath,
              image_type: img.image_type,
              sort_order: img.sort_order,
            });

            if (img.image_type === 'portrait') clonePortraitUrl = publicUrl;
            if (img.image_type === 'avatar') cloneAvatarUrl = publicUrl;
          }
        }
      } catch (err) {
        console.error('[BattleCards] Failed to duplicate images:', err);
      }
    }

    const clone: BloodBowlCardData = {
      ...source,
      id: cloneId,
      dbId: cloneDbId,
      portraitUrl: clonePortraitUrl,
      avatarUrl: cloneAvatarUrl,
    };
    // Mark clone dirty so auto-save persists its keywords
    dirtyCardsRef.current.add(cloneId);
    setCardState(s => {
      const idx = s.cards.findIndex(c => c.id === cardId);
      const next = [...s.cards];
      next.splice(idx + 1, 0, clone);
      return { cards: next, activeCardId: clone.id };
    });
  }, [cards, deckId]);

  // ── Delete card ────────────────────────────────────────────────────────────
  const handleDeleteCard = useCallback(async () => {
    if (!confirmDeleteCardId) return;
    const card = cards.find(c => c.id === confirmDeleteCardId);
    setDeletingCard(true);
    try {
      if (card?.dbId) {
        await supabase.from('cards').delete().eq('id', card.dbId);
      }
      setCardState(s => {
        const remaining = s.cards.filter(c => c.id !== confirmDeleteCardId);
        if (remaining.length === 0) {
          const fresh = defaultCard();
          return { cards: [fresh], activeCardId: fresh.id };
        }
        const needNewActive = s.activeCardId === confirmDeleteCardId;
        return { cards: remaining, activeCardId: needNewActive ? remaining[0].id : s.activeCardId };
      });
    } catch (err) {
      console.error('[BattleCards] Failed to delete card:', err);
    } finally {
      setDeletingCard(false);
      setConfirmDeleteCardId(null);
    }
  }, [confirmDeleteCardId, cards]);

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

  // ── Save-as-template modal ──────────────────────────────────────────────────
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const saveAsTemplate = async (templateName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: game, error: gameErr } = await supabase
        .from('games')
        .select('id')
        .eq('slug', 'blood-bowl')
        .single();
      if (gameErr || !game) throw gameErr ?? new Error('Game lookup failed');

      const sourceDbId = await ensureCardSaved();

      const { data: tmpl, error: insertErr } = await supabase
        .from('cards')
        .insert({
          user_id:     user.id,
          game_id:     game.id,
          is_template: true,
          name:        templateName,
          stats:       toBloodBowlStats(activeCard),
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;

      if (sourceDbId) {
        const [{ data: srcAddons }, { data: srcKeywords }] = await Promise.all([
          supabase.from('card_addons').select('addon_id, sort_order').eq('card_id', sourceDbId),
          supabase.from('card_keywords').select('keyword_id, params, sort_order').eq('card_id', sourceDbId),
        ]);

        if (srcAddons && srcAddons.length > 0) {
          await supabase.from('card_addons').insert(
            srcAddons.map(a => ({ card_id: tmpl.id, addon_id: a.addon_id, sort_order: a.sort_order })),
          );
        }
        if (srcKeywords && srcKeywords.length > 0) {
          await supabase.from('card_keywords').insert(
            srcKeywords.map(k => ({ card_id: tmpl.id, keyword_id: k.keyword_id, params: k.params, sort_order: k.sort_order })),
          );
        }
      }

      setTemplateModalOpen(false);
    } catch (err) {
      console.error('[BattleCards] Failed to save template:', err);
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

  // ── Card scaling ──────────────────────────────────────────────────────────────
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale]   = useState(1);
  const [zoomLevel, setZoomLevel] = useState(0.7);
  // On mobile with a panel open, the carousel container is given an explicit
  // size so the card fits with 16px margins — ignore user zoom in that mode.
  const cardScale = mobilePanelOpen ? fitScale : fitScale * zoomLevel;

  // Reset zoom on panel toggle or short-height change.
  // Short viewports default to 1.0 (card fills available space); otherwise 0.7.
  useEffect(() => {
    setZoomLevel(isShortHeight ? 1.0 : 0.7);
  }, [cardListOpen, editorOpen, isShortHeight]);

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
    setKwFading(true); // fade out keywords in sync with the slide
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

  // Re-centre strip and reset card styles whenever zoom or layout changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (phaseRef.current !== 'transitioning') { applyStripTransform(0, false); resetCardStyles(false); }
  }, [cardScale, appMode, playTab, cardListOpen, editorOpen, isMobile, isShortHeight]);

  // When mode or panel state changes, the container size changes (panels hide/show,
  // mobile breakpoint flips on rotation). Force a re-measure so the carousel fits
  // the new dimensions immediately.
  useEffect(() => {
    const el = cardContainerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    containerWidthRef.current = width;
    setFitScale(Math.min(width / CARD_W, height / CARD_H));
  }, [appMode, playTab, cardListOpen, editorOpen, isMobile, isShortHeight]);

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
          maxLength={getMaxLength(cardConstraints, 'stats.teamName')}
          onChange={e => updateActiveCard({ teamName: e.target.value })}
        />
        <Input
          label="Unit Name"
          required
          placeholder="Unit Name"
          leftIcon={<UserRounded className="w-4 h-4" />}
          value={activeCard.unitName}
          maxLength={getMaxLength(cardConstraints, 'name')}
          onChange={e => updateActiveCard({ unitName: e.target.value })}
        />
        <Input
          label="Player Role"
          required
          placeholder="e.g. Thrower, Blitzer"
          leftIcon={<UserRounded className="w-4 h-4" />}
          value={activeCard.playerRole}
          maxLength={getMaxLength(cardConstraints, 'stats.playerRole')}
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
          disabled={isAtLimit(activeCard.unitKeywords.length, getMaxKeywords(cardConstraints))}
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
          constraints={keywordConstraints}
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
          constraints={keywordConstraints}
        />
      </section>

      {/* ── Save as Template / Delete Card ─────────────────────── */}
      <HR />
      <section className="space-y-3">
        <Button
          variant="outline"
          color="primary"
          size="sm"
          leftIcon={<Diskette className="w-4 h-4" />}
          className="w-full"
          onClick={() => setTemplateModalOpen(true)}
        >
          Save as Template
        </Button>
        <Button
          variant="ghost"
          color="danger"
          size="sm"
          leftIcon={<TrashBinMinimalistic className="w-4 h-4" />}
          className="w-full"
          onClick={() => setConfirmDeleteCardId(activeCard.id)}
        >
          Delete Card
        </Button>
      </section>

    </div>
  );

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <BuilderShell
      navbar={
        <Navbar fixed={false}>
          {/* Desktop (lg+): full mode toggle + Print link */}
          <div className="hidden lg:flex items-center gap-3">
            {deckId && (
              <Link to={`/app/print?deckId=${deckId}`}>
                <Button variant="ghost" color="secondary" size="xs">Print</Button>
              </Link>
            )}
            <ModeToggle mode={appMode} onModeChange={setAppMode} />
          </div>

          {/* Tablet/Mobile (<lg): collapsed mode dropdown */}
          <Dropdown
            align="right"
            className="lg:hidden"
            menuClassName="w-32"
            trigger={
              <Button color="primary" size="xs" rightIcon={<AltArrowDown className="w-4 h-4" />}>
                {appMode === 'edit' ? 'Edit' : 'Play'}
              </Button>
            }
          >
            {appMode !== 'edit' && (
              <DropdownItem icon={<Pen2 className="w-4 h-4" />} onClick={() => setAppMode('edit')}>
                Edit
              </DropdownItem>
            )}
            {appMode !== 'play' && (
              <DropdownItem icon={<Play className="w-4 h-4" />} onClick={() => setAppMode('play')}>
                Play
              </DropdownItem>
            )}
            {deckId && (
              <DropdownItem onClick={() => navigate(`/app/print?deckId=${deckId}`)}>
                Print
              </DropdownItem>
            )}
          </Dropdown>
        </Navbar>
      }
      topBar={
        appMode === 'play' ? (
          <PlaySubnav tab={playTab} onTabChange={setPlayTab} />
        ) : appMode === 'edit' ? (
          <EditSubnav
            className="lg:hidden"
            cardListOpen={cardListOpen}
            onToggleCardList={toggleCardList}
            editorOpen={editorOpen}
            onToggleEditor={toggleEditor}
          />
        ) : null
      }
      leftPanelOpen={cardListOpen}
      leftPanel={appMode === 'edit' ? (
        <CardListPanel
          deckName={deckName}
          editingDeckName={editingDeckName}
          inputRef={deckNameInputRef}
          onStartEdit={startDeckNameEdit}
          onCommit={commitDeckName}
          onCancelEdit={() => setEditingDeckName(false)}
          headerAction={
            <button
              type="button"
              onClick={() => editMode ? handleDoneEditing() : setEditMode(true)}
              className="p-1 rounded hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
              title={editMode ? 'Done editing' : 'Edit deck'}
            >
              {editMode
                ? <CheckCircle className="w-4 h-4 text-green-400" />
                : <Pen2 className="w-4 h-4" />
              }
            </button>
          }
          footer={
            <>
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
            </>
          }
        >
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
                    editMode={editMode}
                    onDuplicate={() => duplicateCard(card.id)}
                    onDelete={() => setConfirmDeleteCardId(card.id)}
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
        </CardListPanel>
      ) : undefined}
      center={
        appMode === 'play' && playTab === 'rules' ? (
          <main className="flex-1 flex flex-col overflow-hidden bg-gray-950">
            <div className="flex-1 overflow-y-auto py-5 px-5">
              <Input
                leftIcon={<Magnifer className="w-4 h-4" />}
                placeholder="Search for a Skill"
                value={ruleSearchQuery}
                onChange={e => setRuleSearchQuery(e.target.value)}
                className="mb-4"
              />
              <div className="flex flex-col gap-2.5">
                {playKeywords
                  .filter(item => {
                    if (!ruleSearchQuery) return true;
                    const q = ruleSearchQuery.toLowerCase();
                    return item.title.toLowerCase().includes(q)
                      || item.description.toLowerCase().includes(q);
                  })
                  .map(item => (
                    <Card key={item.key} className="!bg-gray-800 !border-gray-700">
                      <CardBody className="p-5 space-y-3">
                        <h5 className="font-heading text-xl text-white">
                          {item.title}
                        </h5>
                        <div className="font-body text-base text-gray-300">
                          <Markdown>{item.description}</Markdown>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
              </div>
            </div>
          </main>
        ) : (
          <CenterViewport
            logo={<img src={logoBloodBowl} alt="Blood Bowl" className="h-10 w-auto" />}
            mobilePanelOpen={mobilePanelOpen}
            isShortHeight={isShortHeight}
          >
          {/* Carousel viewport — overflow hidden hides off-screen adjacent cards */}
          <div
            ref={cardContainerRef}
            className={`w-full overflow-hidden relative select-none touch-pan-y ${mobilePanelOpen ? 'flex-none' : 'flex-1 min-h-0'}`}
            style={mobilePanelOpen ? { height: `calc((100vw - 32px) * ${CARD_H / CARD_W})` } : undefined}
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
                        {...(appMode === 'edit' ? {
                          onTeamNameChange:   (v: string) => updateActiveCard({ teamName:   v }),
                          onUnitNameChange:   (v: string) => updateActiveCard({ unitName:   v }),
                          onPlayerRoleChange: (v: string) => updateActiveCard({ playerRole: v }),
                          onCostChange:       (v: string) => updateActiveCard({ cost:       v }),
                          onMaChange: (v: number) => updateActiveCard({ move:     v }),
                          onStChange: (v: number) => updateActiveCard({ strength: v }),
                          onAgChange: (v: number) => updateActiveCard({ agility:  v }),
                          onPaChange: (v: number) => updateActiveCard({ passing:  v }),
                          onAvChange: (v: number) => updateActiveCard({ armor:    v }),
                          onEditSkill: (sk: { name: string; description: string }) => {
                            const match = activeCard.unitKeywords.find(k => k.keywordName === sk.name);
                            if (match) setEditingSkill(match);
                          },
                          constraints: cardConstraints,
                        } : {})}
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

          {/* Zoom controls — hidden on mobile with a panel open (card auto-fits);
              padding tightens on short viewports to give the card more vertical room */}
          <div className={`shrink-0 items-center gap-2 ${isShortHeight ? 'py-1' : 'py-3'} ${mobilePanelOpen ? 'hidden' : 'flex'}`}>
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

          {/* ── Play mode: skill cards for the active unit ─────────────── */}
          {appMode === 'play' && playTab === 'units' && (
            <div
              className="w-full overflow-y-auto px-5 pb-5 space-y-2.5"
              style={{
                height: '40vh',
                flexShrink: 0,
                opacity: kwFading ? 0 : 1,
                transition: 'opacity 120ms ease-out',
              }}
            >
              {(() => {
                const displayCard = cards.find(c => c.id === kwDisplayId) ?? activeCard;
                return displayCard.unitKeywords
                  .slice()
                  .sort((a, b) => a.keywordName.localeCompare(b.keywordName))
                  .map((kw, i) => (
                    <Card
                      key={`kw-${kw.keywordId}`}
                      className="!bg-gray-800 !border-gray-700"
                      style={!kwFading ? {
                        opacity: 0,
                        animation: `fadeInUp 150ms ease-out ${i * 40}ms forwards`,
                      } : undefined}
                    >
                      <CardBody className="p-5 space-y-3">
                        <h5 className="font-heading text-xl text-white">
                          {kw.paramValue != null ? `${kw.keywordName} (${kw.paramValue})` : kw.keywordName}
                        </h5>
                        <div className="font-body text-base text-gray-300">
                          <Markdown>{kw.description}</Markdown>
                        </div>
                      </CardBody>
                    </Card>
                  ));
              })()}
            </div>
          )}
          </CenterViewport>
        )
      }
      rightPanelOpen={editorOpen}
      rightPanel={appMode === 'edit' ? (
        <EditorPanel title="Edit Card">
          {editorForm}
        </EditorPanel>
      ) : undefined}
      modals={<>
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

      <SaveTemplateModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        defaultName={activeCard.unitName}
        onSave={saveAsTemplate}
      />

      <NewCardModal
        open={newCardModalOpen}
        onClose={() => setNewCardModalOpen(false)}
        templates={newCardTemplates}
        onNewBlank={() => { setNewCardModalOpen(false); addBlankCard(); }}
        onPickTemplate={createFromTemplate}
        onDeleteTemplate={deleteTemplate}
      />

      {/* ── Delete card confirmation modal ──────────────────────────────── */}
      <Modal
        open={confirmDeleteCardId !== null}
        onClose={() => !deletingCard && setConfirmDeleteCardId(null)}
        className="max-w-xs"
      >
        <div className="flex flex-col gap-3 p-5">
          <TrashBinMinimalistic className="size-8 text-blue-400" />
          <h2 className="font-heading text-xl text-white">Delete this card?</h2>
          <p className="font-body text-base text-gray-300">This can't be undone.</p>
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button
              variant="ghost"
              disabled={deletingCard}
              onClick={() => setConfirmDeleteCardId(null)}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              loading={deletingCard}
              rightIcon={<ArrowRight className="size-4" />}
              onClick={handleDeleteCard}
            >
              Yes, Delete this card
            </Button>
          </div>
        </div>
      </Modal>
      </>}
    />
  );
};

export default CardBuilderBloodBowl;
