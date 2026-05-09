/**
 * CardBuilderStarcraft.tsx — StarCraft card builder screen
 *
 * Three-panel layout:
 *   • Left:   simple card list + add
 *   • Center: live StarcraftCard preview of the active card, scaled to fit
 *   • Right:  editor form (Figma node 809:3460):
 *               EDIT CARD
 *               ├─ Basic Details  — Unit Name, Unit Type, Unit Tags,
 *                                   Edit Supply Costs button, Points Cost
 *               ├─ Images         — Change / Remove portrait
 *               ├─ Unit Stats     — 2-col grid of 5 counters
 *               ├─ Abilities      — Add Ability (modal, TBD)
 *               ├─ Weapons        — Add Weapon (picker + create form)
 *               └─ Save as Template / Delete Card
 *
 * Data model: all card content is stored inside `cards.stats` JSONB, matching
 * the StarcraftStats shape from database.types.ts. Rules/weapons/supply tiers
 * ride along as arrays inside the stats blob.
 *
 * Modal flows for Supply Limits / Abilities / Weapons are coming in a
 * follow-up PR. The Add buttons are wired to local stubs that log a TODO;
 * existing data on the card is preserved but not currently editable from the
 * panel. Footer counts (“N tiers / N abilities / N weapons”) surface the
 * data so users know it's there.
 *
 * Route: /app/builder/starcraft?deckId=<uuid>
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar      from '../components/Navbar';
import EditSubnav  from '../components/EditSubnav';
import BuilderShell from '../components/BuilderShell';
import CardListPanel from '../components/CardListPanel';
import EditorPanel from '../components/EditorPanel';
import CenterViewport from '../components/CenterViewport';
import { useCardBuilder } from '../hooks/useCardBuilder';
import Button      from '../components/Button';
import Input       from '../components/Input';
import Counter     from '../components/Counter';
import HR          from '../components/HR';
import Modal       from '../components/Modal';
import StarcraftCard, {
  type StarcraftAbility,
  type StarcraftWeapon,
  type StarcraftSupplyTier,
  type StarcraftKeywordAttachment,
} from '../components/StarcraftCard';
import UploadPhotoModal     from '../components/UploadPhotoModal';
import AddAddonModal        from '../components/AddAddonModal';
import StarcraftWeaponForm  from '../components/StarcraftWeaponForm';
import StarcraftAbilityForm from '../components/StarcraftAbilityForm';
import UnitListEntry        from '../components/UnitListEntry';
import CardCarousel         from '../components/CardCarousel';
import AttachedAddonRow     from '../components/AttachedAddonRow';
import StarcraftSupplyTiersModal from '../components/StarcraftSupplyTiersModal';
import AddCircle             from '../icons/AddCircle';
import TrashBinMinimalistic  from '../icons/TrashBinMinimalistic';
import UserRounded           from '../icons/UserRounded';
import Diskette              from '../icons/Diskette';
import Pen2                  from '../icons/Pen2';
import { supabase } from '../lib/supabase';
import type { Addon, DeckWithGame, StarcraftStats, StarcraftWeaponStats, StarcraftRuleStats } from '../lib/database.types';
import logoStarcraft from '../assets/games/logo-starcraft.svg';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — path contains spaces
import iconStarcraft from '../assets/games/card assets/starcraft/icon.svg';

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_W = 1270;
const CARD_H = 890;

// ── Local card shape ──────────────────────────────────────────────────────────

interface StarcraftCardData {
  /** Stable local React key. */
  id:           string;
  /** Supabase row id, null until the card is persisted. */
  dbId:         string | null;
  /** Required type / group (e.g. "Marines"). Persists in `cards.name`. */
  unitType:     string;
  /** Optional specific name for a hero / named unit (e.g. "Jim Raynor"). */
  unitName:     string;
  /** Base die threshold, rendered on the card as "{evade}+". */
  evade:        number;
  /** Base die threshold, rendered on the card as "{armour}+". */
  armour:       number;
  speed:        number;
  hitPoints:    number;
  size:         number;
  pointsCost:   number;
  supplyTiers:  StarcraftSupplyTier[];
  tags:         string;
  /**
   * Resolved abilities and weapons attached to this card. Both come from
   * `card_addons` joined with `addons` (+ `addon_keywords` + `keywords`)
   * — they are NOT stored inside `cards.stats` JSONB.
   */
  abilities:    StarcraftAbility[];
  weapons:      StarcraftWeapon[];
  /** Public URL of the hi-res portrait image (not yet rendered on the card). */
  portraitUrl:  string | null;
  /** Public URL of the square avatar image used on deck-list thumbnails. */
  avatarUrl:    string | null;
  /** Matches the column on public.cards — null = default layout. */
  portraitStyle: string | null;
}

const defaultCard = (): StarcraftCardData => ({
  id:            crypto.randomUUID(),
  dbId:          null,
  unitType:      '',
  unitName:      '',
  speed:         0,
  evade:         0,
  armour:        0,
  hitPoints:     0,
  size:          0,
  pointsCost:    0,
  supplyTiers:   [],
  tags:          '',
  abilities:     [],
  weapons:       [],
  portraitUrl:   null,
  avatarUrl:     null,
  portraitStyle: null,
});

/** Row shape returned by the cards-with-images query. */
interface CardRow {
  id:             string;
  name:           string;
  stats:          unknown;
  portrait_style: string | null;
  card_images:    Array<{ file_path: string; image_type: string; sort_order: number }>;
}

/**
 * Convert a DB row → local card shape. Abilities and weapons are loaded
 * separately via `loadCardWeapons` / `loadCardAbilities` once we know the
 * card.dbId — they live in `card_addons`, not in stats JSONB.
 */
const cardFromDb = (row: CardRow): StarcraftCardData => {
  const s = (row.stats ?? {}) as StarcraftStats;

  let portraitUrl: string | null = null;
  let avatarUrl:   string | null = null;
  for (const img of row.card_images ?? []) {
    const { data } = supabase.storage.from('card-images').getPublicUrl(img.file_path);
    if (img.image_type === 'portrait') portraitUrl = data.publicUrl;
    if (img.image_type === 'avatar')   avatarUrl   = data.publicUrl;
  }

  return {
    id:            crypto.randomUUID(),
    dbId:          row.id,
    // cards.name (required column) holds the Unit Type. The optional
    // Unit Name lives inside stats.unitName.
    unitType:      row.name,
    unitName:      typeof s.unitName === 'string' ? s.unitName : '',
    speed:         typeof s.speed      === 'number' ? s.speed      : 0,
    evade:         typeof s.evade      === 'number' ? s.evade      : 0,
    armour:        typeof s.armour     === 'number' ? s.armour     : 0,
    hitPoints:     typeof s.hitPoints  === 'number' ? s.hitPoints  : 0,
    size:          typeof s.size       === 'number' ? s.size       : 0,
    pointsCost:    typeof s.pointsCost === 'number' ? s.pointsCost : 0,
    supplyTiers:   Array.isArray(s.supplyTiers) ? s.supplyTiers : [],
    tags:          typeof s.tags === 'string' ? s.tags : '',
    abilities:     [],   // resolved below via card_addons
    weapons:       [],   // resolved below via card_addons
    portraitUrl,
    avatarUrl,
    portraitStyle: row.portrait_style,
  };
};

// ── Helpers: load weapons/abilities for a card from card_addons ─────────────

/**
 * Row shape returned by the card_addons → addons → addon_keywords query.
 * Supabase joins are typed loosely here (cast at the call site).
 */
interface AttachedAddonRow {
  sort_order: number | null;
  addons: {
    id:               string;
    name:             string;
    description:      string | null;
    stats:            unknown;
    parent_addon_id:  string | null;
    addon_type:       { slug: string };
    addon_keywords:   Array<{
      params: Record<string, unknown> | null;
      sort_order: number | null;
      keywords: {
        id:            string;
        name:          string;
        description:   string | null;
        params_schema: Array<{ key: string; type: string; label: string }>;
      } | null;
    }>;
  } | null;
}

const SELECT_CARD_ADDONS = `
  sort_order,
  addons (
    id, name, description, stats, parent_addon_id,
    addon_type:addon_types ( slug ),
    addon_keywords (
      params, sort_order,
      keywords ( id, name, description, params_schema )
    )
  )
`;

/** Resolve the keyword-attachment list once — shared by weapons + abilities. */
const rowToKeywords = (a: NonNullable<AttachedAddonRow['addons']>): StarcraftKeywordAttachment[] =>
  (a.addon_keywords ?? [])
    .filter(ak => ak.keywords != null)
    .sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0))
    .map(ak => ({
      keywordId:   ak.keywords!.id,
      name:        ak.keywords!.name,
      description: ak.keywords!.description ?? '',
      hasValue:    Array.isArray(ak.keywords!.params_schema) && ak.keywords!.params_schema.length > 0,
      value:       typeof ak.params?.value === 'string' ? (ak.params!.value as string) : null,
    }));

const rowsToWeapons = (rows: AttachedAddonRow[]): StarcraftWeapon[] =>
  rows
    .filter(r => r.addons != null && r.addons.addon_type.slug === 'weapons')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(r => {
      const a = r.addons!;
      const stats = (a.stats ?? {}) as StarcraftWeaponStats;
      return {
        id:        a.id,
        name:      a.name,
        phase:     stats.phase ?? null,
        timing:    stats.timing ?? null,
        range:     stats.range,
        roa:       stats.roa,
        hit:       stats.hit,
        dmg:       stats.dmg,
        surgeType: stats.surgeType,
        sDice:     stats.sDice,
        keywords:  rowToKeywords(a),
        parentId:  a.parent_addon_id,
      };
    });

const rowsToAbilities = (rows: AttachedAddonRow[]): StarcraftAbility[] =>
  rows
    .filter(r => r.addons != null && r.addons.addon_type.slug === 'rules')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(r => {
      const a = r.addons!;
      const stats = (a.stats ?? {}) as StarcraftRuleStats;
      return {
        id:           a.id,
        name:         a.name,
        phase:        stats.phase ?? null,
        timing:       stats.timing ?? null,
        cpCost:       stats.cpCost ?? null,
        description:  typeof stats.description === 'string' ? stats.description : '',
        keywords:     rowToKeywords(a),
        isUpgrade:    stats.isUpgrade ?? false,
        upgradeCost:  stats.upgradeCost ?? null,
      };
    });

/**
 * Convert local card → DB stats blob.
 * Excludes unitType (lives on cards.name) and abilities/weapons (live in
 * card_addons).
 */
const cardToStats = (c: StarcraftCardData) => ({
  unitName:    c.unitName,
  speed:       c.speed,
  evade:       c.evade,
  armour:      c.armour,
  hitPoints:   c.hitPoints,
  size:        c.size,
  pointsCost:  c.pointsCost,
  supplyTiers: c.supplyTiers,
  tags:        c.tags,
});

// ── Component ─────────────────────────────────────────────────────────────────

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready' };

const CardBuilderStarcraft = () => {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const deckId         = searchParams.get('deckId');

  const [loadState, setLoadState] = useState<LoadState>(() =>
    deckId ? { kind: 'loading' } : { kind: 'error', message: 'No deck selected.' },
  );
  // ── Shared builder chrome (panel toggles, responsive, deck-name) ──────────
  const builder = useCardBuilder({ deckId });
  const {
    cardListOpen, editorOpen, toggleCardList, toggleEditor,
    isShortHeight, mobilePanelOpen,
    deckName, setDeckName, editingDeckName, setEditingDeckName,
    deckNameInputRef, startDeckNameEdit, commitDeckName,
  } = builder;

  const [cards, setCards]               = useState<StarcraftCardData[]>([]);
  const [activeCardId, setActiveCardId] = useState<string>('');
  const activeCard = cards.find(c => c.id === activeCardId) ?? null;

  const dirtyCardsRef = useRef<Set<string>>(new Set());

  /** Total points cost across all cards in the deck — surfaced in the header. */
  const deckPointsTotal = cards.reduce((sum, c) => sum + (c.pointsCost || 0), 0);

  // ── Image upload / delete state ───────────────────────────────────────────
  const [uploadOpen,    setUploadOpen]    = useState(false);
  const [deleteImgOpen, setDeleteImgOpen] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);

  // ── Delete-card confirmation ───────────────────────────────────────────────
  const [deleteCardOpen, setDeleteCardOpen] = useState(false);
  const [deletingCard,   setDeletingCard]   = useState(false);

  // ── Load deck + cards from DB ─────────────────────────────────────────────
  useEffect(() => {
    if (!deckId) return;

    let cancelled = false;
    (async () => {
      const { data: deckRow, error: deckErr } = await supabase
        .from('decks')
        .select('*, game:games(id, name, slug, stat_schema, print_size, bleed_size, created_at)')
        .eq('id', deckId)
        .single();

      if (cancelled) return;
      if (deckErr || !deckRow) {
        setLoadState({ kind: 'error', message: 'We couldn’t load that deck.' });
        return;
      }

      const deck = deckRow as DeckWithGame;
      if (deck.game?.slug !== 'starcraft') {
        setLoadState({ kind: 'error', message: 'That deck isn’t a StarCraft deck.' });
        return;
      }

      setDeckName(deck.name);

      const { data: cardRows } = await supabase
        .from('cards')
        .select(`
          id, name, stats, sort_order, portrait_style,
          card_images(file_path, image_type, sort_order),
          card_addons(${SELECT_CARD_ADDONS})
        `)
        .eq('deck_id', deckId)
        .order('sort_order', { ascending: true, nullsFirst: false });

      if (cancelled) return;

      const loaded = (cardRows ?? []).map(r => {
        const card = cardFromDb(r as CardRow);
        const attachments = ((r as unknown as { card_addons?: AttachedAddonRow[] }).card_addons ?? []);
        card.weapons   = rowsToWeapons(attachments);
        card.abilities = rowsToAbilities(attachments);
        return card;
      });

      if (loaded.length === 0) {
        const blank = defaultCard();
        setCards([blank]);
        setActiveCardId(blank.id);
      } else {
        setCards(loaded);
        setActiveCardId(loaded[0].id);
      }
      setLoadState({ kind: 'ready' });
    })();

    return () => { cancelled = true; };
  }, [deckId]);

  // ── Debounced save ────────────────────────────────────────────────────────
  const [savingCount, setSavingCount] = useState(0);

  const flushDirtyCards = useCallback(async () => {
    if (!deckId) return;
    const dirty = [...dirtyCardsRef.current];
    if (dirty.length === 0) return;
    dirtyCardsRef.current = new Set();
    setSavingCount(c => c + dirty.length);

    for (const localId of dirty) {
      const c = cards.find(x => x.id === localId);
      if (!c) continue;

      try {
        if (c.dbId) {
          await supabase
            .from('cards')
            .update({ name: c.unitType || 'Untitled', stats: cardToStats(c) })
            .eq('id', c.dbId);
        } else {
          const { data } = await supabase
            .from('cards')
            .insert({
              deck_id: deckId,
              name:    c.unitName || 'Untitled',
              stats:   cardToStats(c),
            })
            .select('id')
            .single();
          if (data?.id) {
            setCards(prev => prev.map(x => x.id === c.id ? { ...x, dbId: data.id } : x));
          }
        }
      } catch (err) {
        console.error('[BattleCards] Save failed', err);
      } finally {
        setSavingCount(n => Math.max(0, n - 1));
      }
    }
  }, [cards, deckId]);

  useEffect(() => {
    if (loadState.kind !== 'ready') return;
    const handle = setInterval(() => { void flushDirtyCards(); }, 1000);
    return () => clearInterval(handle);
  }, [loadState.kind, flushDirtyCards]);

  // ── Card CRUD ─────────────────────────────────────────────────────────────
  const updateActive = useCallback((patch: Partial<StarcraftCardData>) => {
    if (!activeCard) return;
    dirtyCardsRef.current.add(activeCard.id);
    setCards(prev => prev.map(c => c.id === activeCard.id ? { ...c, ...patch } : c));
  }, [activeCard]);

  const addCard = () => {
    const next = defaultCard();
    dirtyCardsRef.current.add(next.id);
    setCards(prev => [...prev, next]);
    setActiveCardId(next.id);
  };

  const deleteActiveCard = async () => {
    if (!activeCard) return;
    if (cards.length === 1) return;
    setDeletingCard(true);
    try {
      if (activeCard.dbId) {
        await supabase.from('cards').delete().eq('id', activeCard.dbId);
      }
      setCards(prev => {
        const next = prev.filter(c => c.id !== activeCard.id);
        setActiveCardId(next[0]?.id ?? '');
        return next;
      });
      dirtyCardsRef.current.delete(activeCard.id);
      setDeleteCardOpen(false);
    } finally {
      setDeletingCard(false);
    }
  };

  // ── Image handlers ────────────────────────────────────────────────────────
  // UploadPhotoModal has already written to storage, card_images, and
  // cards.portrait_style by the time these fire — we just update local state.

  const handleImageUploaded = useCallback((publicUrl: string, portraitStyle: string | null) => {
    updateActive({ portraitUrl: publicUrl, portraitStyle });
    if (activeCard) dirtyCardsRef.current.delete(activeCard.id);
  }, [updateActive, activeCard]);

  const handleAvatarUploaded = useCallback((avatarUrl: string) => {
    updateActive({ avatarUrl });
    if (activeCard) dirtyCardsRef.current.delete(activeCard.id);
  }, [updateActive, activeCard]);

  const handleDeleteImage = async () => {
    if (!activeCard?.dbId) return;
    setDeletingImage(true);
    try {
      const { data: images } = await supabase
        .from('card_images')
        .select('id, file_path')
        .eq('card_id', activeCard.dbId);

      if (images && images.length > 0) {
        const paths = images.map(img => img.file_path);
        await supabase.storage.from('card-images').remove(paths);
        await supabase.from('card_images').delete().eq('card_id', activeCard.dbId);
      }

      await supabase
        .from('cards')
        .update({ portrait_style: null })
        .eq('id', activeCard.dbId);

      updateActive({ portraitUrl: null, avatarUrl: null, portraitStyle: null });
      if (activeCard) dirtyCardsRef.current.delete(activeCard.id);
      setDeleteImgOpen(false);
    } catch (err) {
      console.error('[BattleCards] Failed to delete portrait:', err);
    } finally {
      setDeletingImage(false);
    }
  };

  // ── Add-modal state ──────────────────────────────────────────────────────
  // Weapons + Abilities both go through AddAddonModal with their own
  // CreateFormComponent. Supply tiers has its own dedicated modal.
  const [addWeaponOpen,   setAddWeaponOpen]   = useState(false);
  const [addAbilityOpen,  setAddAbilityOpen]  = useState(false);
  const [supplyTiersOpen, setSupplyTiersOpen] = useState(false);

  const handleSaveAsTmpl  = () => { console.info('[BattleCards] Save as Template — TBD'); };

  /** Refresh the active card's attached weapons + abilities from the DB. */
  const refreshActiveCardAddons = useCallback(async () => {
    if (!activeCard?.dbId) return;
    const { data } = await supabase
      .from('card_addons')
      .select(SELECT_CARD_ADDONS)
      .eq('card_id', activeCard.dbId);
    const rows      = (data ?? []) as unknown as AttachedAddonRow[];
    const weapons   = rowsToWeapons(rows);
    const abilities = rowsToAbilities(rows);
    setCards(prev => prev.map(c => c.id === activeCard.id ? { ...c, weapons, abilities } : c));
  }, [activeCard]);

  /** Attach an addon (weapon or ability) to the active card. */
  const attachAddon = useCallback(async (addon: Addon, currentCount: number) => {
    if (!activeCard?.dbId) return;
    await supabase
      .from('card_addons')
      .insert({ card_id: activeCard.dbId, addon_id: addon.id, sort_order: currentCount });
    await refreshActiveCardAddons();
  }, [activeCard, refreshActiveCardAddons]);

  const handleAttachWeapon  = useCallback(
    (addon: Addon) => attachAddon(addon, activeCard?.weapons.length   ?? 0),
    [attachAddon, activeCard],
  );
  const handleAttachAbility = useCallback(
    (addon: Addon) => attachAddon(addon, activeCard?.abilities.length ?? 0),
    [attachAddon, activeCard],
  );

  /** Called by AddAddonModal when an addon is deleted from the user's library. */
  const handleAddonLibraryDeleted = useCallback((addonId: string) => {
    // The DB cascade will remove card_addons rows; reflect that in local state
    // so the card preview drops the addon immediately.
    setCards(prev => prev.map(c => ({
      ...c,
      weapons:   c.weapons.filter(w   => w.id !== addonId),
      abilities: c.abilities.filter(a => a.id !== addonId),
    })));
  }, []);

  /** Detach a weapon or ability from the active card without deleting the library row. */
  const handleDetachAddon = useCallback(async (addonId: string) => {
    if (!activeCard?.dbId) return;
    await supabase
      .from('card_addons')
      .delete()
      .eq('card_id', activeCard.dbId)
      .eq('addon_id', addonId);
    await refreshActiveCardAddons();
  }, [activeCard, refreshActiveCardAddons]);

  /**
   * Capitalize a single phase / state value, mapping the multi-word
   * `special_abilities` to `Special`. Used for weapon subtitles in both
   * the picker and the attached-weapon list.
   */
  const formatPhase = (p: string | null | undefined): string | null => {
    if (!p) return null;
    if (p === 'special_abilities') return 'Special';
    return p[0].toUpperCase() + p.slice(1);
  };

  /** Subtitle for an attached weapon in the editor list (and the picker). */
  const formatWeaponSubtitle = useCallback((stats: StarcraftWeaponStats, weapon?: StarcraftWeapon): string => {
    const parts: string[] = [];
    const phase  = formatPhase(stats.phase);
    const timing = formatPhase(stats.timing);
    if (phase)               parts.push(phase);
    if (timing)              parts.push(timing);
    if (stats.range != null) parts.push(stats.range === 0 ? 'Melee' : `R${stats.range}`);
    if (stats.hit   != null) parts.push(`${stats.hit}+ Hit`);
    if (stats.dmg   != null) parts.push(`${stats.dmg} Dmg`);
    // Trailing keyword summary — only the names, comma-joined, truncated by CSS.
    if (weapon?.keywords && weapon.keywords.length > 0) {
      parts.push(weapon.keywords.map(k => k.name).join(', '));
    }
    return parts.join(', ');
  }, []);

  /** Subtitle in the picker list — same formatter, no keyword data available. */
  const getWeaponSubtitle = useCallback((addon: Addon): string =>
    formatWeaponSubtitle((addon.stats ?? {}) as StarcraftWeaponStats),
  [formatWeaponSubtitle]);

  /** Subtitle for an attached ability in the editor list (and the picker). */
  const formatAbilitySubtitle = useCallback((stats: StarcraftRuleStats, ability?: StarcraftAbility): string => {
    const parts: string[] = [];
    const phase  = formatPhase(stats.phase);
    const timing = formatPhase(stats.timing);
    if (phase)                  parts.push(phase);
    if (timing)                 parts.push(timing);
    if (stats.cpCost)           parts.push(`${stats.cpCost} Cost`);
    if (stats.isUpgrade && stats.upgradeCost) parts.push(`${stats.upgradeCost} Min`);
    if (ability?.keywords && ability.keywords.length > 0) {
      parts.push(ability.keywords.map(k => k.name).join(', '));
    }
    return parts.join(', ');
  }, []);

  const getAbilitySubtitle = useCallback((addon: Addon): string =>
    formatAbilitySubtitle((addon.stats ?? {}) as StarcraftRuleStats),
  [formatAbilitySubtitle]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loadState.kind === 'loading') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="font-body text-sm text-gray-400">Loading deck…</p>
      </div>
    );
  }
  if (loadState.kind === 'error') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <img src={logoStarcraft} alt="StarCraft" className="h-10 opacity-70" />
          <p className="font-body text-base text-gray-300">{loadState.message}</p>
          <Button variant="outline" color="secondary" onClick={() => navigate('/app')}>
            Back to decks
          </Button>
        </div>
      </div>
    );
  }

  return (
    <BuilderShell
      navbar={<Navbar fixed={false} />}
      topBar={
        <EditSubnav
          className="lg:hidden"
          cardListOpen={cardListOpen}
          onToggleCardList={toggleCardList}
          editorOpen={editorOpen}
          onToggleEditor={toggleEditor}
        />
      }
      leftPanelOpen={cardListOpen}
      leftPanel={
        <CardListPanel
          deckName={deckName}
          editingDeckName={editingDeckName}
          inputRef={deckNameInputRef}
          onStartEdit={startDeckNameEdit}
          onCommit={commitDeckName}
          onCancelEdit={() => setEditingDeckName(false)}
          headerSubtitle={
            <p className="font-body text-xs font-bold text-gray-500 uppercase tracking-[1.2px] truncate">
              {deckPointsTotal} Points
              {savingCount > 0 && <span className="ml-2 text-blue-400 normal-case tracking-normal">Saving…</span>}
            </p>
          }
          headerAction={
            <button
              type="button"
              onClick={startDeckNameEdit}
              className="p-1 rounded hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
              title="Rename deck"
            >
              <Pen2 className="w-4 h-4" />
            </button>
          }
          footer={
            <>
              <HR className="!my-0" />
              <Button
                leftIcon={<AddCircle className="w-4 h-4" />}
                variant="outline"
                size="sm"
                className="w-full"
                onClick={addCard}
              >
                Add Unit
              </Button>
              <Button
                leftIcon={<AddCircle className="w-4 h-4" />}
                variant="outline"
                size="sm"
                className="w-full"
                disabled
                onClick={() => { /* TBD: open Add Rule modal once Starcraft rule cards are wired */ }}
              >
                Add Rule
              </Button>
            </>
          }
        >
          {cards.map(c => (
            <UnitListEntry
              key={c.id}
              status={c.dbId ? 'complete' : 'blank'}
              unitName={c.unitName || c.unitType || undefined}
              unitType={c.unitName ? c.unitType : undefined}
              avatarSrc={c.avatarUrl ?? (iconStarcraft as string)}
              active={c.id === activeCardId}
              onClick={() => setActiveCardId(c.id)}
            />
          ))}
          {/* Deck-scoped rule cards (Halo-style) — modal coming next round.
              List entries will render here once the rule data model lands. */}
        </CardListPanel>
      }
      center={
        <CenterViewport
          logo={<img src={logoStarcraft} alt="StarCraft" className="h-10 w-auto" />}
          mobilePanelOpen={mobilePanelOpen}
          isShortHeight={isShortHeight}
        >
          <CardCarousel
            items={cards}
            activeId={activeCardId}
            onActiveChange={setActiveCardId}
            cardWidth={CARD_W}
            cardHeight={CARD_H}
            initialZoom={isShortHeight ? 1.0 : 0.7}
            layoutDeps={builder.layoutDeps}
            renderItem={card => (
              <StarcraftCard
                unitType={card.unitType}
                unitName={card.unitName}
                speed={card.speed}
                evade={card.evade}
                armour={card.armour}
                hitPoints={card.hitPoints}
                size={card.size}
                pointsCost={card.pointsCost}
                supplyTiers={card.supplyTiers}
                tags={card.tags}
                abilities={card.abilities}
                weapons={card.weapons}
              />
            )}
            className={`w-full ${mobilePanelOpen ? 'flex-none' : 'flex-1 min-h-0'}`}
          />
        </CenterViewport>
      }
      rightPanelOpen={editorOpen}
      rightPanel={
        <EditorPanel title="Edit Card">
          {activeCard && (
            <CardEditor
              card={activeCard}
              onChange={updateActive}
              onUploadImage={() => setUploadOpen(true)}
              onDeleteImage={() => setDeleteImgOpen(true)}
              onAddTier={() => setSupplyTiersOpen(true)}
              onAddAbility={() => setAddAbilityOpen(true)}
              onDetachAbility={(id) => { void handleDetachAddon(id); }}
              onAddWeapon={() => setAddWeaponOpen(true)}
              onDetachWeapon={(id) => { void handleDetachAddon(id); }}
              formatWeaponSubtitle={formatWeaponSubtitle}
              formatAbilitySubtitle={formatAbilitySubtitle}
              onSaveAsTemplate={handleSaveAsTmpl}
              onDeleteCard={() => setDeleteCardOpen(true)}
              canDeleteCard={cards.length > 1}
            />
          )}
        </EditorPanel>
      }
      modals={<>
        {/* ── Upload photo modal ────────────────────────────────────────── */}
        <UploadPhotoModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          game="starcraft"
          cardDbId={activeCard?.dbId ?? null}
          unitName={activeCard?.unitName || activeCard?.unitType}
          onImageUploaded={handleImageUploaded}
          onAvatarUploaded={handleAvatarUploaded}
        />

        {/* ── Delete image confirmation ─────────────────────────────────── */}
        <ConfirmModal
          open={deleteImgOpen}
          title="Remove photo?"
          body="This will delete the portrait and avatar for this card. You can upload a new one at any time."
          confirmLabel="Remove"
          busy={deletingImage}
          onClose={() => !deletingImage && setDeleteImgOpen(false)}
          onConfirm={handleDeleteImage}
        />

        {/* ── Delete card confirmation ──────────────────────────────────── */}
        <ConfirmModal
          open={deleteCardOpen}
          title="Delete this card?"
          body="This removes the card from the deck. This cannot be undone."
          confirmLabel="Delete"
          busy={deletingCard}
          onClose={() => !deletingCard && setDeleteCardOpen(false)}
          onConfirm={deleteActiveCard}
        />

        {/* ── Add Weapon modal — picker + Create Weapon form ────────────── */}
        <AddAddonModal
          open={addWeaponOpen}
          onClose={() => setAddWeaponOpen(false)}
          gameSlug="starcraft"
          addonTypeSlug="weapons"
          addonTypeName="Weapon"
          excludeAddonIds={activeCard?.weapons.map(w => w.id) ?? []}
          onAdd={addon => { void handleAttachWeapon(addon); }}
          onDeleted={handleAddonLibraryDeleted}
          getSubtitle={getWeaponSubtitle}
          CreateFormComponent={StarcraftWeaponForm}
        />

        {/* ── Add Ability modal — picker + Create Ability form ──────────── */}
        <AddAddonModal
          open={addAbilityOpen}
          onClose={() => setAddAbilityOpen(false)}
          gameSlug="starcraft"
          addonTypeSlug="rules"
          addonTypeName="Ability"
          excludeAddonIds={activeCard?.abilities.map(a => a.id) ?? []}
          onAdd={addon => { void handleAttachAbility(addon); }}
          onDeleted={handleAddonLibraryDeleted}
          getSubtitle={getAbilitySubtitle}
          CreateFormComponent={StarcraftAbilityForm}
        />

        {/* ── Supply Tiers modal ─────────────────────────────────────────── */}
        <StarcraftSupplyTiersModal
          open={supplyTiersOpen}
          tiers={activeCard?.supplyTiers ?? []}
          onSave={tiers => updateActive({ supplyTiers: tiers })}
          onClose={() => setSupplyTiersOpen(false)}
        />
      </>}
    />
  );
};

// ── Confirm modal (shared for photo + card delete) ──────────────────────────

const ConfirmModal = ({
  open,
  title,
  body,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
}: {
  open:         boolean;
  title:        string;
  body:         string;
  confirmLabel: string;
  busy:         boolean;
  onClose:      () => void;
  onConfirm:    () => void;
}) => (
  <Modal open={open} onClose={onClose} className="max-w-xs">
    <div className="flex flex-col gap-3 p-5">
      <TrashBinMinimalistic className="size-8 text-blue-400" />
      <h2 className="font-heading text-xl text-white">{title}</h2>
      <p className="font-body text-base text-gray-300">{body}</p>
      <div className="flex items-center gap-3 pt-1">
        <Button variant="ghost" color="danger" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button loading={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  </Modal>
);

// ── Editor panel ──────────────────────────────────────────────────────────────

interface CardEditorProps {
  card:                  StarcraftCardData;
  onChange:              (patch: Partial<StarcraftCardData>) => void;
  onUploadImage:         () => void;
  onDeleteImage:         () => void;
  onAddTier:             () => void;
  onAddAbility:          () => void;
  /** Detach an attached ability from this card (× button on the row). */
  onDetachAbility:       (addonId: string) => void;
  /** Format the subtitle text for an attached ability row. */
  formatAbilitySubtitle: (stats: StarcraftRuleStats, ability?: StarcraftAbility) => string;
  onAddWeapon:           () => void;
  /** Detach an attached weapon from this card (× button on the row). */
  onDetachWeapon:        (addonId: string) => void;
  /** Format the subtitle text for an attached weapon row. */
  formatWeaponSubtitle:  (stats: StarcraftWeaponStats, weapon?: StarcraftWeapon) => string;
  onSaveAsTemplate:      () => void;
  onDeleteCard:          () => void;
  canDeleteCard:         boolean;
}

const CardEditor = ({
  card,
  onChange,
  onUploadImage,
  onDeleteImage,
  onAddTier,
  onAddAbility,
  onDetachAbility,
  formatAbilitySubtitle,
  onAddWeapon,
  onDetachWeapon,
  formatWeaponSubtitle,
  onSaveAsTemplate,
  onDeleteCard,
  canDeleteCard,
}: CardEditorProps) => (
  <div className="flex flex-col">
    {/* Panel heading + leading HR are now provided by <EditorPanel>. */}

    {/* ── Basic Details ──────────────────────────────────────────────── */}
    <EditorSection title="Basic Details">
      <Input
        label="Unit Name"
        value={card.unitName}
        onChange={e => onChange({ unitName: e.target.value })}
        placeholder="eg. Jim Raynor"
        leftIcon={<UserRounded className="size-4" />}
      />
      <Input
        label="Unit Type"
        required
        value={card.unitType}
        onChange={e => onChange({ unitType: e.target.value })}
        placeholder="eg. Marines, Marauders"
        leftIcon={<UserRounded className="size-4" />}
      />
      <Input
        label="Unit Tags"
        required
        value={card.tags}
        onChange={e => onChange({ tags: e.target.value })}
        placeholder="eg. Core, Light, Biological, etc."
        leftIcon={<UserRounded className="size-4" />}
      />
      <AddRow label="Edit Supply Costs" onClick={onAddTier} />
      <Counter
        label="Points Cost"
        value={card.pointsCost}
        onChange={v => onChange({ pointsCost: v })}
        min={0} max={9999}
        helperText="Include the cost of weapons and upgrades (if any)"
      />
    </EditorSection>

    <SectionDivider />

    {/* ── Images ─────────────────────────────────────────────────────── */}
    <PhotoEditor
      card={card}
      onUpload={onUploadImage}
      onDelete={onDeleteImage}
    />

    <SectionDivider />

    {/* ── Unit Stats ─────────────────────────────────────────────────── */}
    <EditorSection title="Unit Stats">
      <div className="grid grid-cols-2 gap-3">
        <Counter
          label="Speed"
          required
          value={card.speed}
          onChange={v => onChange({ speed: v })}
          min={0} max={20}
        />
        <Counter
          label="Evade"
          required
          value={card.evade}
          onChange={v => onChange({ evade: v })}
          min={0} max={9}
        />
        <Counter
          label="Armour"
          required
          value={card.armour}
          onChange={v => onChange({ armour: v })}
          min={0} max={9}
        />
        <Counter
          label="Hit Points"
          required
          value={card.hitPoints}
          onChange={v => onChange({ hitPoints: v })}
          min={0} max={99}
        />
        <Counter
          label="Size"
          required
          value={card.size}
          onChange={v => onChange({ size: v })}
          min={0} max={9}
        />
      </div>
    </EditorSection>

    <SectionDivider />

    {/* ── Abilities ───────────────────────────────────────────────────
        Lists attached abilities (× detaches without deleting from library).
        Clicking a row will eventually open a viewer / edit modal — for
        now the row is non-interactive (no onClick). */}
    <EditorSection title="Abilities">
      {card.abilities.map(a => (
        <AttachedAddonRow
          key={a.id}
          name={a.name}
          subtitle={formatAbilitySubtitle({
            phase:       a.phase ?? null,
            timing:      a.timing ?? null,
            cpCost:      a.cpCost,
            description: a.description,
            isUpgrade:   a.isUpgrade,
            upgradeCost: a.upgradeCost,
          }, a)}
          onRemove={() => onDetachAbility(a.id)}
        />
      ))}
      <AddRow label="Add Ability" onClick={onAddAbility} />
    </EditorSection>

    <SectionDivider />

    {/* ── Weapons ─────────────────────────────────────────────────────
        Lists attached weapons (× detaches without deleting from library).
        Clicking a row will eventually open a viewer / edit modal — for
        now the row is non-interactive (no onClick). */}
    <EditorSection title="Weapons">
      {card.weapons.map(w => (
        <AttachedAddonRow
          key={w.id}
          name={w.name}
          subtitle={formatWeaponSubtitle({
            phase:     w.phase ?? null,
            timing:    w.timing ?? null,
            range:     w.range,
            roa:       w.roa,
            hit:       w.hit,
            dmg:       w.dmg,
            surgeType: w.surgeType,
            sDice:     w.sDice,
          }, w)}
          onRemove={() => onDetachWeapon(w.id)}
        />
      ))}
      <AddRow label="Add Weapon" onClick={onAddWeapon} />
    </EditorSection>

    <SectionDivider />

    {/* ── Save / Delete card ─────────────────────────────────────────── */}
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        color="primary"
        className="w-full"
        leftIcon={<Diskette className="size-4" />}
        onClick={onSaveAsTemplate}
      >
        Save as Template
      </Button>
      <Button
        variant="ghost"
        color="danger"
        className="w-full"
        leftIcon={<TrashBinMinimalistic className="size-4" />}
        disabled={!canDeleteCard}
        onClick={onDeleteCard}
      >
        Delete Card
      </Button>
    </div>
  </div>
);

const SectionDivider = () => <HR className="m-0 my-5" />;

const EditorSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-3">
    <h3 className="font-heading text-base text-white">{title}</h3>
    <div className="flex flex-col gap-3">{children}</div>
  </section>
);

/**
 * "Add X" full-width outline-blue button used by Supply Limits / Abilities /
 * Weapons sections. The + icon sits on the right per the Figma design.
 */
const AddRow = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <Button
    variant="outline"
    color="primary"
    className="w-full justify-between"
    rightIcon={<AddCircle className="size-4" />}
    onClick={onClick}
  >
    {label}
  </Button>
);

// ── Photo editor ─────────────────────────────────────────────────────────────
// Upload requires the card to already be persisted (we need a cards.id to use
// as the storage folder). New blank cards get persisted on the next save tick
// (~1 s), so the button is briefly disabled right after adding a card.

const PhotoEditor = ({
  card,
  onUpload,
  onDelete,
}: {
  card:     StarcraftCardData;
  onUpload: () => void;
  onDelete: () => void;
}) => {
  const hasImage  = Boolean(card.portraitUrl || card.avatarUrl);
  const canUpload = Boolean(card.dbId);
  const label     = hasImage ? 'Change Portrait Image' : 'Add Portrait Image';

  return (
    <EditorSection title="Images">
      {hasImage && card.portraitUrl && (
        <img
          src={card.portraitUrl}
          alt={card.unitName || card.unitType || 'Card portrait'}
          className="w-full max-h-48 object-contain rounded border border-gray-700 bg-gray-900"
        />
      )}
      <Button
        variant="outline"
        color="primary"
        className="w-full justify-between"
        rightIcon={<AddCircle className="size-4" />}
        onClick={onUpload}
        disabled={!canUpload}
      >
        {label}
      </Button>
      {hasImage && (
        <Button
          variant="ghost"
          color="danger"
          className="w-full"
          leftIcon={<TrashBinMinimalistic className="size-4" />}
          onClick={onDelete}
        >
          Remove Portrait
        </Button>
      )}
      {!canUpload && (
        <p className="font-body text-xs text-gray-500">
          Save the card first — adding a photo needs a saved card.
        </p>
      )}
    </EditorSection>
  );
};

export default CardBuilderStarcraft;
