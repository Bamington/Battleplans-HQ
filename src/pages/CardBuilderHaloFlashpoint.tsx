/**
 * CardBuilderHaloFlashpoint.tsx — Halo Flashpoint card builder screen
 *
 * Allows the user to edit a Halo Flashpoint unit card. The live card component
 * (HaloFlashpointCard) is rendered in the centre column, wired to the editor
 * state in the right panel.
 *
 * LAYOUT:
 * ┌──────────────────────────────────────────────────────────┐
 * │  Navbar (fixed, full width)                              │
 * ├──────────┬──────────────────────────┬────────────────────┤
 * │  Unit    │      Card display        │    Edit Card       │
 * │  List    │   (logo + live card)     │   (editor panel)   │
 * │  (256px) │        (flex-1)          │      (256px)       │
 * └──────────┴──────────────────────────┴────────────────────┘
 *
 * Route: /app/builder/halo-flashpoint?deckId=<uuid>
 */

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import UnitListEntry from '../components/UnitListEntry';
import Input from '../components/Input';
import Select from '../components/Select';
import Counter from '../components/Counter';
import Button from '../components/Button';
import HR from '../components/HR';
import HaloFlashpointCard from '../components/HaloFlashpointCard';
import Card3DWrapper from '../components/Card3DWrapper';
import Modal from '../components/Modal';
import AddAddonModal, { type AddonFormProps } from '../components/AddAddonModal';
import AddKeywordModal from '../components/AddKeywordModal';
import KeywordInfoModal from '../components/KeywordInfoModal';
// TODO: migrate to the universal `AddonInfoModal` (src/components/AddonInfoModal.tsx).
// Same shape, just data-driven via `statRows` instead of hardcoded weapon fields.
// Kill Team already uses the universal modal for weapons + abilities.
import WeaponInfoModal from '../components/WeaponInfoModal';
import Badge from '../components/Badge';
import UploadPhotoModal from '../components/UploadPhotoModal';
import UserRounded from '../icons/UserRounded';
import AddCircle from '../icons/AddCircle';
import MinusCircle from '../icons/MinusCircle';
import CheckCircle from '../icons/CheckCircle';
import CloseCircle from '../icons/CloseCircle';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';
import ArrowRight from '../icons/ArrowRight';
import Pen2 from '../icons/Pen2';
import HamburgerMenu from '../icons/HamburgerMenu';
import { supabase } from '../lib/supabase';
import type { Addon, HaloFlashpointStats } from '../lib/database.types';
import logoHaloFlashpoint from '../assets/games/logo-halo-flashpoint.png';
import iconHaloFlashpoint from '../assets/games/card assets/halo/icon.png';

// ── Navbar height ─────────────────────────────────────────────────────────────

// ── Card native dimensions ────────────────────────────────────────────────────
const CARD_W = 1270;
const CARD_H = 890;

// ── Carousel constants ────────────────────────────────────────────────────────
// TODO: migrate this builder to the universal `CardCarousel` component
// (src/components/CardCarousel.tsx). All the carousel + zoom + fit-scale logic
// below duplicates what CardCarousel now owns. Kill Team and Starcraft already
// use it; this builder still has the inline copy.
const ADJACENT_SCALE = 0.7;
const CARD_GAP       = 40;

// ── Keyword update propagation ────────────────────────────────────────────────
// Module-scoped ref so HaloWeaponForm (which can't receive extra props via
// AddonFormProps) can propagate keyword edits across all cards.
let _propagateKeywordUpdate: ((keywordId: string, name: string, desc: string, hasParams: boolean) => void) | null = null;

// ── Local weapon shape ────────────────────────────────────────────────────────
// Mirrors HaloWeapon but carries the Supabase addon ID for edit/delete.

interface LocalWeapon {
  addonId:    string;
  type:       string;
  name:       string;
  range:      string;
  ap:         string;
  keywords:   string;
  pointsCost: string;
  weaponKeywords: LocalKeywordAttachment[];
}

// ── Card data type ────────────────────────────────────────────────────────────

interface HaloCardData {
  id:          string;        // stable local React key
  dbId:        string | null; // Supabase row id (null = not yet saved)
  unitName:    string;
  keywords:    string;        // computed display string for the card renderer
  unitKeywords: LocalKeywordAttachment[];
  ra:          number;
  fi:          number;
  sv:          number;
  advance:     number;
  sprint:      number;
  hp:          number;
  armour:      number;
  pointsCost:  number;
  weapons:       LocalWeapon[];
  portraitUrl:   string | null; // public URL from Supabase Storage
  portraitStyle: string | null; // null = default, 'portraitFramed' = frame overlay
  avatarUrl:     string | null; // square thumbnail for lists
}

const defaultCard = (): HaloCardData => ({
  id:            crypto.randomUUID(),
  dbId:          null,
  unitName:      '',
  keywords:      '',
  unitKeywords:  [],
  ra:            0,
  fi:            0,
  sv:            0,
  advance:       0,
  sprint:        0,
  hp:            0,
  armour:        0,
  pointsCost:    0,
  weapons:       [],
  portraitUrl:   null,
  portraitStyle: null,
  avatarUrl:     null,
});

// ── Persistence helpers ────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

const withRetry = async <T,>(fn: () => Promise<T>, attempts = 3): Promise<T | undefined> => {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch { if (i < attempts - 1) await sleep(1000 * (i + 1)); }
  }
};

const isHaloCardBlank = (c: HaloCardData): boolean =>
  !c.unitName && c.unitKeywords.length === 0 &&
  c.ra === 0 && c.fi === 0 && c.sv === 0 &&
  c.advance === 0 && c.sprint === 0 && c.hp === 0 && c.armour === 0 &&
  c.pointsCost === 0 && c.weapons.length === 0;

const toHaloStats = (c: HaloCardData): HaloFlashpointStats => ({
  keywords:     c.keywords,
  ra:           c.ra,
  fi:           c.fi,
  sv:           c.sv,
  advanceValue: c.advance,
  sprintValue:  c.sprint,
  ar:           c.armour,
  hp:           c.hp,
  pointsCost:   c.pointsCost,
});

const buildKeywordsDisplayString = (kws: LocalKeywordAttachment[]) =>
  kws
    .map(k => k.paramValue != null ? `${k.keywordName} (${k.paramValue})` : k.keywordName)
    .join(', ');

// ── Weapon subtitle builder ────────────────────────────────────────────────────
// Used in the picker list to summarise a weapon from its Supabase addon row.

const getWeaponSubtitle = (addon: Addon): string => {
  const s = addon.stats as Record<string, unknown>;
  const parts: string[] = [];
  if (s.type)     parts.push(String(s.type));
  if (s.range)    parts.push(`R${s.range}`);
  if (s.ap)       parts.push(`AP ${s.ap}`);
  if (s.keywords) parts.push(String(s.keywords));
  return parts.join(', ') || addon.name;
};

// ── Weapon type options ───────────────────────────────────────────────────────

const WEAPON_TYPE_OPTIONS = [
  { value: '',             label: 'Closed Combat or Ranged', disabled: true },
  { value: 'Close Combat', label: 'Close Combat' },
  { value: 'Ranged',       label: 'Ranged'       },
  { value: 'Grenade',      label: 'Grenade'      },
];

// ── HaloWeaponForm — create / edit form rendered inside AddAddonModal ─────────

interface LocalKeywordAttachment {
  keywordId: string;
  keywordName: string;
  description: string;
  hasParams: boolean;
  paramValue: number | null;
}

const HaloWeaponForm = ({ editingAddon, onSave, onCancel, saving }: AddonFormProps) => {
  const s = (editingAddon?.stats ?? {}) as Record<string, unknown>;

  const [type,       setType]       = useState(String(s.type  ?? ''));
  const [name,       setName]       = useState(editingAddon?.name ?? '');
  const [range,      setRange]      = useState(Number(s.range) || 0);
  const [ap,         setAp]         = useState(Number(s.ap)    || 0);
  const [pointsCost, setPointsCost] = useState(Number(s.pointsCost) || 0);

  const [attachedKeywords, setAttachedKeywords] = useState<LocalKeywordAttachment[]>([]);
  const [keywordModalOpen, setKeywordModalOpen] = useState(false);
  const [viewingKeyword, setViewingKeyword]     = useState<LocalKeywordAttachment | null>(null);
  const [editingKw, setEditingKw]               = useState<LocalKeywordAttachment | null>(null);

  // Load existing keyword attachments when editing
  useEffect(() => {
    if (!editingAddon) return;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from('addon_keywords')
        .select('keyword_id, params, sort_order, keywords(name, description, params_schema)')
        .eq('addon_id', editingAddon.id)
        .order('sort_order');

      if (cancelled || error || !data) return;

      setAttachedKeywords(
        (data as any[]).map(ak => ({
          keywordId: ak.keyword_id,
          keywordName: ak.keywords.name,
          description: ak.keywords.description ?? '',
          hasParams: Array.isArray(ak.keywords.params_schema) && ak.keywords.params_schema.length > 0,
          paramValue: ak.params?.X != null ? Number(ak.params.X) : null,
        })),
      );
    };

    load();
    return () => { cancelled = true; };
  }, [editingAddon]);

  const isCC      = type === 'Close Combat';
  const isEditing = !!editingAddon;
  const canSave   = type.trim() !== '' && name.trim() !== '' && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    const addonId = await onSave(
      name.trim(),
      null,
      {
        type:     type.trim(),
        range:      isCC ? null : String(range),
        ap:         String(ap),
        pointsCost: String(pointsCost),
        keywords:   buildKeywordsDisplayString(attachedKeywords),
      },
    );

    // Sync addon_keywords after the addon is persisted
    if (addonId) {
      await supabase.from('addon_keywords').delete().eq('addon_id', addonId);
      if (attachedKeywords.length > 0) {
        await supabase.from('addon_keywords').insert(
          attachedKeywords.map((k, i) => ({
            addon_id: addonId,
            keyword_id: k.keywordId,
            params: k.paramValue != null ? { X: k.paramValue } : {},
            sort_order: i,
          })),
        );
      }
    }
  };

  return (
    <div className="p-5 flex flex-col gap-3">

      {/* Title */}
      <h5 className="font-heading text-xl text-white">
        {isEditing ? `Edit Weapon` : 'Create Weapon'}
      </h5>

      {/* Subtitle */}
      <p className="font-body text-sm text-gray-300">
        Once created, you can add this weapon to other units from the same game.
      </p>

      {/* ── Basic Details ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="font-body text-base font-bold text-gray-100">Basic Details</p>

        <Select
          label="Weapon Type"
          required
          options={WEAPON_TYPE_OPTIONS}
          value={type}
          onChange={e => setType(e.target.value)}
        />
        <Input
          label="Weapon Name"
          required
          placeholder="Eg. Fists, Battle Rifle, etc."
          value={name}
          onChange={e => setName(e.target.value)}
        />

        {/* Weapon Keywords */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium font-body text-gray-900 dark:text-white">
            Weapon Keywords
          </p>
          {attachedKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachedKeywords.map(k => (
                <Badge
                  key={k.keywordId}
                  onDismiss={() =>
                    setAttachedKeywords(prev => prev.filter(x => x.keywordId !== k.keywordId))
                  }
                >
                  <button
                    type="button"
                    className="underline text-blue-600 dark:text-blue-400 hover:text-blue-500"
                    onClick={() => setViewingKeyword(k)}
                  >
                    {k.paramValue != null ? `${k.keywordName} (${k.paramValue})` : k.keywordName}
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<AddCircle className="size-4" />}
              onClick={() => setKeywordModalOpen(true)}
            >
              Add Keyword
            </Button>
          </div>
        </div>
      </div>

      <HR className="!my-0" />

      {/* ── Weapon Stats ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="font-body text-base font-bold text-gray-100">Weapon Stats</p>

        <div className="flex gap-4">
          {!isCC && (
            <Counter
              label="Weapon Range"
              required
              min={0}
              value={range}
              onChange={setRange}
            />
          )}
          <Counter
            label="AP Value"
            required
            min={0}
            value={ap}
            onChange={setAp}
          />
          <Counter
            label="Points Cost"
            min={0}
            value={pointsCost}
            onChange={setPointsCost}
          />
        </div>
      </div>

      <HR className="!my-0" />

      {/* CTAs */}
      <div className="flex items-center gap-1 flex-wrap">
        <Button
          leftIcon={<CheckCircle className="size-4" />}
          disabled={!canSave}
          loading={saving}
          onClick={handleSave}
        >
          {isEditing ? 'Update Weapon' : 'Save Weapon'}
        </Button>
        <Button
          variant="ghost"
          color="danger"
          leftIcon={<CloseCircle className="size-4" />}
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>

      {/* Keyword modal (nested inside weapon form) */}
      <AddKeywordModal
        open={keywordModalOpen}
        onClose={() => setKeywordModalOpen(false)}
        gameSlug="halo-flashpoint"
        onKeywordSelected={(kw) => {
          setAttachedKeywords(prev => [...prev, kw]);
          setKeywordModalOpen(false);
        }}
        excludeKeywordIds={attachedKeywords.map(k => k.keywordId)}
      />

      {/* Keyword info modal */}
      <KeywordInfoModal
        open={!!viewingKeyword}
        onClose={() => setViewingKeyword(null)}
        name={viewingKeyword?.keywordName ?? ''}
        description={viewingKeyword?.description ?? ''}
        onEdit={() => {
          setEditingKw(viewingKeyword);
          setViewingKeyword(null);
        }}
      />

      {/* Edit keyword modal */}
      <AddKeywordModal
        open={!!editingKw}
        onClose={() => setEditingKw(null)}
        gameSlug="halo-flashpoint"
        editingKeyword={editingKw ? {
          id: editingKw.keywordId,
          name: editingKw.keywordName,
          description: editingKw.description,
          hasParams: editingKw.hasParams,
        } : null}
        onKeywordSelected={() => {}}
        onKeywordUpdated={(updated) => {
          setAttachedKeywords(prev => prev.map(k =>
            k.keywordId === updated.keywordId
              ? { ...k, keywordName: updated.keywordName, description: updated.description, hasParams: updated.hasParams }
              : k,
          ));
          _propagateKeywordUpdate?.(updated.keywordId, updated.keywordName, updated.description, updated.hasParams);
          setEditingKw(null);
        }}
      />

    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

const CardBuilderHaloFlashpoint = () => {
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
    return { cards: [card] as HaloCardData[], activeCardId: card.id };
  });
  const { cards, activeCardId } = cardState;
  const activeCard = cards.find(c => c.id === activeCardId) ?? cards[0];

  // ── Dirty tracking (cards that need saving) ───────────────────────────────────
  const dirtyCardsRef = useRef<Set<string>>(new Set());

  const updateActiveCard = (patch: Partial<HaloCardData>) => {
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

  const [deleteCardConfirmOpen, setDeleteCardConfirmOpen] = useState(false);
  const [cardPendingDelete, setCardPendingDelete] = useState<HaloCardData | null>(null);
  const [deletingCard, setDeletingCard] = useState(false);

  const requestDeleteCard = (card: HaloCardData) => {
    setCardPendingDelete(card);
    setDeleteCardConfirmOpen(true);
  };

  const handleConfirmDeleteCard = async () => {
    if (!cardPendingDelete) return;
    setDeletingCard(true);
    try {
      await deleteCard(cardPendingDelete.id);
      setDeleteCardConfirmOpen(false);
      setCardPendingDelete(null);
    } finally {
      setDeletingCard(false);
    }
  };

  /** Propagate a keyword definition update (name/description) across ALL cards. */
  const propagateKeywordUpdate = useCallback((keywordId: string, newName: string, newDescription: string, newHasParams: boolean) => {
    setCardState(s => ({
      ...s,
      cards: s.cards.map(c => {
        let changed = false;

        // Update unit keywords
        const newUnitKws = c.unitKeywords.map(k => {
          if (k.keywordId !== keywordId) return k;
          changed = true;
          return { ...k, keywordName: newName, description: newDescription, hasParams: newHasParams };
        });

        // Update weapon keywords
        const newWeapons = c.weapons.map(w => {
          const newWkws = w.weaponKeywords.map(k => {
            if (k.keywordId !== keywordId) return k;
            changed = true;
            return { ...k, keywordName: newName, description: newDescription, hasParams: newHasParams };
          });
          if (newWkws === w.weaponKeywords) return w;
          return { ...w, weaponKeywords: newWkws, keywords: buildKeywordsDisplayString(newWkws) };
        });

        if (!changed) return c;
        dirtyCardsRef.current.add(c.id);
        return { ...c, unitKeywords: newUnitKws, keywords: buildKeywordsDisplayString(newUnitKws), weapons: newWeapons };
      }),
    }));
  }, []);

  // Expose propagateKeywordUpdate to HaloWeaponForm via module-scoped ref
  useEffect(() => {
    _propagateKeywordUpdate = propagateKeywordUpdate;
    return () => { _propagateKeywordUpdate = null; };
  }, [propagateKeywordUpdate]);

  // ── Deck name inline rename ─────────────────────────────────────────────────
  const startDeckNameEdit = useCallback(() => {
    setEditingDeckName(true);
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

    type AddonKeywordRow = { keyword_id: string; params: Record<string, unknown>; sort_order: number | null; keywords: { name: string; description: string | null; params_schema: { key: string; type: string; label: string }[] } | null };
    type CardRow = {
      id: string; name: string; stats: HaloFlashpointStats; portrait_style: string | null;
      card_addons: { addon_id: string; sort_order: number | null; addons: { name: string; stats: Record<string, unknown>; addon_keywords: AddonKeywordRow[] } | null }[];
      card_images: { file_path: string; sort_order: number; image_type: string }[];
      card_keywords: AddonKeywordRow[];
    };

    supabase
      .from('cards')
      .select('id, name, stats, portrait_style, card_addons(addon_id, sort_order, addons(name, stats, addon_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema)))), card_images(file_path, sort_order, image_type), card_keywords(keyword_id, params, sort_order, keywords(name, description, params_schema))')
      .eq('deck_id', deckId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) { console.error('[BattleCards] Failed to load cards:', error); return; }
        if (!data || data.length === 0) return;
        const loaded = (data as unknown as CardRow[]).map(row => {
          const s = row.stats ?? {};
          const sortedAddons = [...(row.card_addons ?? [])]
            .filter(ca => ca.addons != null)
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

          // Resolve card images by type to public URLs
          const allImages = row.card_images ?? [];
          const portraitImg = allImages.find(i => i.image_type === 'portrait');
          const avatarImg   = allImages.find(i => i.image_type === 'avatar');

          let portraitUrl: string | null = null;
          if (portraitImg) {
            const { data: urlData } = supabase.storage
              .from('card-images')
              .getPublicUrl(portraitImg.file_path);
            portraitUrl = urlData.publicUrl;
          }

          let avatarUrl: string | null = null;
          if (avatarImg) {
            const { data: urlData } = supabase.storage
              .from('card-images')
              .getPublicUrl(avatarImg.file_path);
            avatarUrl = urlData.publicUrl;
          }

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

          return {
            id:       row.id,
            dbId:     row.id,
            unitName: row.name,
            keywords: buildKeywordsDisplayString(loadedUnitKeywords) || (s.keywords ?? ''),
            unitKeywords: loadedUnitKeywords,
            ra:       s.ra           ?? 0,
            fi:       s.fi           ?? 0,
            sv:       s.sv           ?? 0,
            advance:  s.advanceValue ?? 0,
            sprint:   s.sprintValue  ?? 0,
            hp:       s.hp           ?? 0,
            armour:   s.ar           ?? 0,
            pointsCost: s.pointsCost ?? 0,
            portraitUrl,
            portraitStyle: row.portrait_style ?? null,
            avatarUrl,
            weapons: sortedAddons.map(ca => {
              const ws = ca.addons!.stats;
              const addonKws = [...(ca.addons!.addon_keywords ?? [])]
                .filter(ak => ak.keywords != null)
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
              const wkws: LocalKeywordAttachment[] = addonKws.map(ak => ({
                keywordId: ak.keyword_id,
                keywordName: ak.keywords!.name,
                description: ak.keywords!.description ?? '',
                hasParams: Array.isArray(ak.keywords!.params_schema) && ak.keywords!.params_schema.length > 0,
                paramValue: ak.params?.X != null ? Number(ak.params.X) : null,
              }));
              return {
                addonId:  ca.addon_id,
                name:     ca.addons!.name,
                type:     String(ws.type     ?? ''),
                range:    String(ws.range    ?? ''),
                ap:       String(ws.ap       ?? ''),
                keywords: buildKeywordsDisplayString(wkws) || String(ws.keywords ?? ''),
                pointsCost: String(ws.pointsCost ?? ''),
                weaponKeywords: wkws,
              };
            }),
          } as HaloCardData;
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
        if (!dirty.has(card.id) || isHaloCardBlank(card)) continue;

        await withRetry(async () => {
          let dbId = card.dbId;

          if (!dbId) {
            const { data, error } = await supabase
              .from('cards')
              .insert({ deck_id: deckId, name: card.unitName || 'Unnamed Unit', stats: toHaloStats(card), portrait_style: card.portraitStyle, sort_order: ci })
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
              .update({ name: card.unitName || 'Unnamed Unit', stats: toHaloStats(card), portrait_style: card.portraitStyle, sort_order: ci })
              .eq('id', dbId);
            if (error) throw error;
          }

          // Sync card_addons: delete all then re-insert in order
          await supabase.from('card_addons').delete().eq('card_id', dbId);
          if (card.weapons.length > 0) {
            const { error } = await supabase.from('card_addons').insert(
              card.weapons.map((w, i) => ({ card_id: dbId!, addon_id: w.addonId, sort_order: i }))
            );
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
          stats: toHaloStats(activeCard),
          portrait_style: activeCard.portraitStyle,
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

  // ── Add Weapon modal ─────────────────────────────────────────────────────────
  const [weaponModalOpen, setWeaponModalOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen]           = useState(false);
  const [deletePortraitConfirm, setDeletePortraitConfirm] = useState(false);
  const [deletingPortrait, setDeletingPortrait]           = useState(false);
  const [unitKeywordModalOpen, setUnitKeywordModalOpen]  = useState(false);
  const [viewingUnitKeyword, setViewingUnitKeyword]      = useState<LocalKeywordAttachment | null>(null);
  const [editingUnitKw, setEditingUnitKw]                = useState<LocalKeywordAttachment | null>(null);
  const [editingWeaponKw, setEditingWeaponKw]            = useState<LocalKeywordAttachment | null>(null);
  const [viewingWeapon, setViewingWeapon]                = useState<LocalWeapon | null>(null);
  const [editingWeaponAddon, setEditingWeaponAddon]      = useState<Addon | null>(null);
  const [savingWeaponEdit, setSavingWeaponEdit]          = useState(false);

  const handleWeaponAdded = (addon: Addon) => {
    const s = addon.stats as Record<string, unknown>;
    const weapon: LocalWeapon = {
      addonId:    addon.id,
      name:       addon.name,
      type:       String(s.type       ?? ''),
      range:      String(s.range      ?? ''),
      ap:         String(s.ap         ?? ''),
      keywords:   String(s.keywords   ?? ''),
      pointsCost: String(s.pointsCost ?? ''),
      weaponKeywords: [],
    };
    updateActiveCard({ weapons: [...activeCard.weapons, weapon] });
  };

  const handleWeaponDeleted = (addonId: string) => {
    cards.forEach(c => {
      if (c.weapons.some(w => w.addonId === addonId)) dirtyCardsRef.current.add(c.id);
    });
    setCardState(s => ({
      ...s,
      cards: s.cards.map(c => ({
        ...c,
        weapons: c.weapons.filter(w => w.addonId !== addonId),
      })),
    }));
  };

  // ── Remove portrait handler ──────────────────────────────────────────────────
  const handleDeletePortrait = async () => {
    if (!activeCard.dbId) return;
    setDeletingPortrait(true);
    try {
      // 1. Get card_images rows for this card
      const { data: images } = await supabase
        .from('card_images')
        .select('id, file_path')
        .eq('card_id', activeCard.dbId);

      if (images && images.length > 0) {
        // 2. Delete files from storage
        const paths = images.map(img => img.file_path);
        await supabase.storage.from('card-images').remove(paths);

        // 3. Delete card_images rows
        await supabase
          .from('card_images')
          .delete()
          .eq('card_id', activeCard.dbId);
      }

      // 4. Clear portrait_style on the card
      await supabase
        .from('cards')
        .update({ portrait_style: null })
        .eq('id', activeCard.dbId);

      // 5. Update local state
      updateActiveCard({ portraitUrl: null, portraitStyle: null });
      setDeletePortraitConfirm(false);
    } catch (err) {
      console.error('[BattleCards] Failed to delete portrait:', err);
    } finally {
      setDeletingPortrait(false);
    }
  };

  // ── Card scaling ─────────────────────────────────────────────────────────────
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

  const phaseRef      = useRef<'idle' | 'transitioning'>('idle');
  const pendingIdRef  = useRef<string | null>(null);
  const draggingRef   = useRef(false);
  const dragStartXRef = useRef(0);

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

  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      <Navbar fixed={false} />

      {/* ── Page body ────────────────────────────────────────────────────── */}
      <div
        className="flex flex-1 overflow-hidden"
      >

        {/* ── Left panel: unit list ──────────────────────────────────────── */}
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
                    avatarSrc={card.avatarUrl ?? iconHaloFlashpoint}
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

        {/* ── Center: carousel card display ─────────────────────────────── */}
        <main className="flex-1 flex flex-col items-center overflow-hidden bg-gray-950">
          <div className="flex items-center justify-center w-full shrink-0 py-3">
            <img src={logoHaloFlashpoint} alt="Halo Flashpoint" className="h-10 w-auto" />
          </div>

          {/* Carousel viewport */}
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
                      <HaloFlashpointCard
                        unitName={prevCard.unitName || 'Unit Name'}
                        keywords={prevCard.keywords || ''}
                        ra={prevCard.ra} fi={prevCard.fi} sv={prevCard.sv}
                        advanceValue={prevCard.advance} sprintValue={prevCard.sprint}
                        ar={prevCard.armour} hp={prevCard.hp}
                        portrait={prevCard.portraitUrl ?? undefined}
                        portraitStyle={prevCard.portraitStyle}
                        weapons={prevCard.weapons.map(w => ({ type: w.type, name: w.name, range: w.range, ap: w.ap, keywords: w.keywords }))}
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
                      <HaloFlashpointCard
                        unitName={activeCard.unitName   || 'Unit Name'}
                        keywords={activeCard.keywords   || ''}
                        keywordData={activeCard.unitKeywords.map(k => ({
                          label: k.paramValue != null ? `${k.keywordName} (${k.paramValue})` : k.keywordName,
                          name: k.keywordName,
                          description: k.description,
                        }))}
                        ra={activeCard.ra}
                        fi={activeCard.fi}
                        sv={activeCard.sv}
                        advanceValue={activeCard.advance}
                        sprintValue={activeCard.sprint}
                        ar={activeCard.armour}
                        hp={activeCard.hp}
                        portrait={activeCard.portraitUrl ?? undefined}
                        portraitStyle={activeCard.portraitStyle}
                        weapons={activeCard.weapons.map(w => ({
                          type:     w.type,
                          name:     w.name,
                          range:    w.range,
                          ap:       w.ap,
                          keywords: w.keywords,
                          keywordData: w.weaponKeywords.map(k => ({
                            label: k.paramValue != null ? `${k.keywordName} (${k.paramValue})` : k.keywordName,
                            name: k.keywordName,
                            description: k.description,
                          })),
                        }))}
                        onUnitNameChange={v     => updateActiveCard({ unitName: v })}
                        onKeywordsChange={v     => updateActiveCard({ keywords: v })}
                        onRaChange={v           => updateActiveCard({ ra:       v })}
                        onFiChange={v           => updateActiveCard({ fi:       v })}
                        onSvChange={v           => updateActiveCard({ sv:       v })}
                        onAdvanceValueChange={v => updateActiveCard({ advance:  v })}
                        onSprintValueChange={v  => updateActiveCard({ sprint:   v })}
                        onArChange={v           => updateActiveCard({ armour:   v })}
                        onHpChange={v           => updateActiveCard({ hp:       v })}
                        onEditKeyword={(kw) => {
                          // Check unit keywords first
                          const unitKw = activeCard.unitKeywords.find(k => k.keywordName === kw.name);
                          if (unitKw) {
                            setEditingUnitKw(unitKw);
                            return;
                          }
                          // Check weapon keywords
                          for (const w of activeCard.weapons) {
                            const weaponKw = w.weaponKeywords.find(k => k.keywordName === kw.name);
                            if (weaponKw) {
                              setEditingWeaponKw(weaponKw);
                              return;
                            }
                          }
                        }}
                        onWeaponClick={(hw) => {
                          const match = activeCard.weapons.find(w => w.name === hw.name);
                          if (match) setViewingWeapon(match);
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
                      <HaloFlashpointCard
                        unitName={nextCard.unitName || 'Unit Name'}
                        keywords={nextCard.keywords || ''}
                        ra={nextCard.ra} fi={nextCard.fi} sv={nextCard.sv}
                        advanceValue={nextCard.advance} sprintValue={nextCard.sprint}
                        ar={nextCard.armour} hp={nextCard.hp}
                        portrait={nextCard.portraitUrl ?? undefined}
                        portraitStyle={nextCard.portraitStyle}
                        weapons={nextCard.weapons.map(w => ({ type: w.type, name: w.name, range: w.range, ap: w.ap, keywords: w.keywords }))}
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

        {/* ── Right panel: editor ───────────────────────────────────────── */}
        <aside className="w-64 shrink-0 flex flex-col bg-gray-900
                          border-l border-gray-700 overflow-hidden">
          <div className="px-4 py-4 border-b border-gray-700 shrink-0">
            <h2 className="font-heading text-sm font-bold text-white uppercase tracking-wide">
              Edit Card
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">

            {/* ── Basic Details ──────────────────────────────────────── */}
            <section className="space-y-3">
              <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Basic Details
              </p>
              <Input
                label="Unit Name"
                required
                placeholder="e.g. Spartan CQB, Banished Elite"
                leftIcon={<UserRounded className="w-4 h-4" />}
                value={activeCard.unitName}
                onChange={e => updateActiveCard({ unitName: e.target.value })}
              />
              {/* Unit Keywords */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium font-body text-gray-900 dark:text-white">
                  Keywords
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
                            keywords: buildKeywordsDisplayString(updated),
                          });
                        }}
                      >
                        <button
                          type="button"
                          className="underline text-blue-600 dark:text-blue-400 hover:text-blue-500"
                          onClick={() => setViewingUnitKeyword(k)}
                        >
                          {k.paramValue != null ? `${k.keywordName} (${k.paramValue})` : k.keywordName}
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<AddCircle className="w-4 h-4" />}
                    onClick={() => setUnitKeywordModalOpen(true)}
                  >
                    Add Keyword
                  </Button>
                </div>
              </div>

              <AddKeywordModal
                open={unitKeywordModalOpen}
                onClose={() => setUnitKeywordModalOpen(false)}
                gameSlug="halo-flashpoint"
                onKeywordSelected={(kw) => {
                  const updated = [...activeCard.unitKeywords, kw];
                  updateActiveCard({
                    unitKeywords: updated,
                    keywords: buildKeywordsDisplayString(updated),
                  });
                  setUnitKeywordModalOpen(false);
                }}
                excludeKeywordIds={activeCard.unitKeywords.map(k => k.keywordId)}
              />

              <KeywordInfoModal
                open={!!viewingUnitKeyword}
                onClose={() => setViewingUnitKeyword(null)}
                name={viewingUnitKeyword?.keywordName ?? ''}
                description={viewingUnitKeyword?.description ?? ''}
                onEdit={() => {
                  setEditingUnitKw(viewingUnitKeyword);
                  setViewingUnitKeyword(null);
                }}
              />

              <AddKeywordModal
                open={!!editingUnitKw}
                onClose={() => setEditingUnitKw(null)}
                gameSlug="halo-flashpoint"
                editingKeyword={editingUnitKw ? {
                  id: editingUnitKw.keywordId,
                  name: editingUnitKw.keywordName,
                  description: editingUnitKw.description,
                  hasParams: editingUnitKw.hasParams,
                } : null}
                onKeywordSelected={() => {}}
                onKeywordUpdated={(updated) => {
                  propagateKeywordUpdate(updated.keywordId, updated.keywordName, updated.description, updated.hasParams);
                  setEditingUnitKw(null);
                }}
              />

              {/* Edit weapon keyword (opened from card's weapon table) */}
              <AddKeywordModal
                open={!!editingWeaponKw}
                onClose={() => setEditingWeaponKw(null)}
                gameSlug="halo-flashpoint"
                editingKeyword={editingWeaponKw ? {
                  id: editingWeaponKw.keywordId,
                  name: editingWeaponKw.keywordName,
                  description: editingWeaponKw.description,
                  hasParams: editingWeaponKw.hasParams,
                } : null}
                onKeywordSelected={() => {}}
                onKeywordUpdated={(updated) => {
                  propagateKeywordUpdate(updated.keywordId, updated.keywordName, updated.description, updated.hasParams);
                  setEditingWeaponKw(null);
                }}
              />

              <Counter
                label="Points Cost"
                min={0}
                value={activeCard.pointsCost}
                onChange={v => updateActiveCard({ pointsCost: v })}
              />
            </section>

            {/* ── Images ────────────────────────────────────────────── */}
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

            {/* ── Unit Stats ─────────────────────────────────────────── */}
            <section className="space-y-3">
              <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Unit Stats
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <Counter
                  label="Ranged"
                  required
                  min={0}
                  value={activeCard.ra}
                  onChange={v => updateActiveCard({ ra: v })}
                  className="w-full"
                />
                <Counter
                  label="Fight"
                  required
                  min={0}
                  value={activeCard.fi}
                  onChange={v => updateActiveCard({ fi: v })}
                  className="w-full"
                />
              </div>
              <Counter
                label="Survive"
                required
                min={0}
                value={activeCard.sv}
                onChange={v => updateActiveCard({ sv: v })}
              />
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <Counter
                  label="Advance"
                  required
                  min={0}
                  value={activeCard.advance}
                  onChange={v => updateActiveCard({ advance: v })}
                  className="w-full"
                />
                <Counter
                  label="Sprint"
                  required
                  min={0}
                  value={activeCard.sprint}
                  onChange={v => updateActiveCard({ sprint: v })}
                  className="w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <Counter
                  label="Hit Points"
                  required
                  min={0}
                  value={activeCard.hp}
                  onChange={v => updateActiveCard({ hp: v })}
                  className="w-full"
                />
                <Counter
                  label="Armour"
                  min={0}
                  value={activeCard.armour}
                  onChange={v => updateActiveCard({ armour: v })}
                  className="w-full"
                />
              </div>
            </section>

            {/* ── Weapons ────────────────────────────────────────────── */}
            <section className="space-y-3">
              <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Weapons
              </p>

              {/* Attached weapons */}
              {activeCard.weapons.map(w => (
                <div
                  key={w.addonId}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-500 transition-colors"
                  onClick={() => setViewingWeapon(w)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-medium text-gray-200 truncate">
                      {w.name}
                    </p>
                    <p className="font-body text-xs text-gray-500 truncate">
                      {[w.type, w.range && `R${w.range}`, w.ap && `AP ${w.ap}`, w.keywords]
                        .filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${w.name}`}
                    onClick={e => {
                      e.stopPropagation();
                      updateActiveCard({
                        weapons: activeCard.weapons.filter(x => x.addonId !== w.addonId),
                      });
                    }}
                    className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <CloseCircle className="size-4" />
                  </button>
                </div>
              ))}

              <Button
                leftIcon={<AddCircle className="w-4 h-4" />}
                variant="outline"
                size="sm"
                className="w-full"
                disabled={activeCard.weapons.length >= 3}
                onClick={() => setWeaponModalOpen(true)}
              >
                Add Weapon
              </Button>
            </section>

          </div>
        </aside>

      </div>

      {/* ── Delete portrait confirmation modal ──────────────────────────── */}
      <Modal
        open={deletePortraitConfirm}
        onClose={() => !deletingPortrait && setDeletePortraitConfirm(false)}
        className="max-w-sm"
      >
        <div className="p-5 flex flex-col gap-3">
          <TrashBinMinimalistic className="w-8 h-8 text-blue-500" />
          <h3 className="font-heading text-xl text-white tracking-tight">
            Delete this image?
          </h3>
          <p className="font-body text-base text-gray-300">
            This can't be undone, but you can upload a different image.
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={deletingPortrait}
              onClick={() => setDeletePortraitConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              size="sm"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              loading={deletingPortrait}
              onClick={handleDeletePortrait}
            >
              Yes, Delete this portrait image
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete card confirmation modal ─────────────────────────────── */}
      <Modal
        open={deleteCardConfirmOpen}
        onClose={() => !deletingCard && setDeleteCardConfirmOpen(false)}
        className="max-w-sm"
      >
        <div className="p-5 flex flex-col gap-3">
          <TrashBinMinimalistic className="w-8 h-8 text-blue-500" />
          <h3 className="font-heading text-xl text-white tracking-tight">
            Delete this unit?
          </h3>
          <p className="font-body text-base text-gray-300">
            This will permanently delete {cardPendingDelete?.unitName ? `“${cardPendingDelete.unitName}”` : 'this unit'}.
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={deletingCard}
              onClick={() => setDeleteCardConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              size="sm"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              loading={deletingCard}
              onClick={handleConfirmDeleteCard}
            >
              Yes, Delete Unit
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Upload Photo modal ────────────────────────────────────────────── */}
      <UploadPhotoModal
        open={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        game="halo-flashpoint"
        cardDbId={activeCard.dbId}
        unitName={activeCard.unitName || undefined}
        onImageUploaded={(url, pStyle) => updateActiveCard({ portraitUrl: url, portraitStyle: pStyle })}
        onAvatarUploaded={url => updateActiveCard({ avatarUrl: url })}
      />

      {/* ── Add Weapon modal ──────────────────────────────────────────────── */}
      <AddAddonModal
        open={weaponModalOpen}
        onClose={() => setWeaponModalOpen(false)}
        gameSlug="halo-flashpoint"
        addonTypeSlug="weapons"
        addonTypeName="Weapon"
        excludeAddonIds={activeCard.weapons.map(w => w.addonId)}
        onAdd={handleWeaponAdded}
        onDeleted={handleWeaponDeleted}
        getSubtitle={getWeaponSubtitle}
        CreateFormComponent={HaloWeaponForm}
      />

      {/* ── Weapon detail modal ────────────────────────────────────────────── */}
      <WeaponInfoModal
        open={!!viewingWeapon}
        onClose={() => setViewingWeapon(null)}
        weapon={viewingWeapon}
        onKeywordClick={(kw) => {
          setViewingWeapon(null);
          setViewingUnitKeyword(kw as LocalKeywordAttachment);
        }}
        onEdit={() => {
          if (!viewingWeapon) return;
          const addonId = viewingWeapon.addonId;
          setViewingWeapon(null);
          // Fetch the full Addon row to pass to HaloWeaponForm
          supabase
            .from('addons')
            .select('*')
            .eq('id', addonId)
            .single()
            .then(({ data }) => {
              if (data) setEditingWeaponAddon(data as Addon);
            });
        }}
      />

      {/* ── Edit Weapon modal (direct form, skips picker) ──────────────────── */}
      {editingWeaponAddon && (
        <Modal open onClose={() => setEditingWeaponAddon(null)} className="max-w-md">
          <HaloWeaponForm
            editingAddon={editingWeaponAddon}
            onSave={async (name, description, stats) => {
              setSavingWeaponEdit(true);
              try {
                const { error } = await supabase
                  .from('addons')
                  .update({ name, description, stats })
                  .eq('id', editingWeaponAddon.id);
                if (error) throw error;

                // Refresh weapon data in all cards that use this addon
                const ws = stats as Record<string, unknown>;
                setCardState(s => ({
                  ...s,
                  cards: s.cards.map(c => ({
                    ...c,
                    weapons: c.weapons.map(w =>
                      w.addonId === editingWeaponAddon.id
                        ? {
                            ...w,
                            name,
                            type:       String(ws.type       ?? ''),
                            range:      String(ws.range      ?? ''),
                            ap:         String(ws.ap         ?? ''),
                            pointsCost: String(ws.pointsCost ?? ''),
                            keywords:   String(ws.keywords   ?? ''),
                          }
                        : w,
                    ),
                  })),
                }));

                setEditingWeaponAddon(null);
                return editingWeaponAddon.id;
              } catch (err) {
                console.error('[BattleCards] weapon edit error:', err);
                return '';
              } finally {
                setSavingWeaponEdit(false);
              }
            }}
            onCancel={() => setEditingWeaponAddon(null)}
            saving={savingWeaponEdit}
          />
        </Modal>
      )}
    </div>
  );
};

export default CardBuilderHaloFlashpoint;
