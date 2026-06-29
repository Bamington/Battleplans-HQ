/**
 * PackEditor.tsx — The pack-editing page
 *
 * Layout:
 *   Navbar                                       (plain — no mode switcher)
 *   Pack name title                              (centered; double-click to edit inline)
 *   Units panel                                  (full width)
 *   Rules panel                                  (full width; only when game.rule_types non-empty)
 *   Addon panel × N                              (one per game's addon_types; 2-col grid)
 *   Keywords panel                               (in the same grid as the addon panels)
 *
 * Add buttons are currently stubbed (console.log + alert) — the Add Unit / Add
 * Rule flows are awaiting design; the Add Addon / Add Keyword flows need the
 * existing AddAddonModal / AddKeywordModal to be adapted for pack context
 * (those modals currently pick from the user's library and attach to a card,
 * which doesn't translate directly). Both will land in a follow-up tranche.
 *
 * Game-specific card preview rendering in the Unit / Rule panels is also
 * deferred — each card currently renders as a "name plate" tile until there's
 * a way to test it with real data via the Add Unit flow.
 *
 * Route: /app/packs/:packId/edit
 */

import { useState, useEffect, useMemo, useRef, type ComponentType } from 'react';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Button from '../components/Button';
import AddonListItem from '../components/AddonListItem';
import AddToPackModal from '../components/AddToPackModal';
import AddKeywordModal from '../components/AddKeywordModal';
import StarcraftAddKeywordModal from '../components/StarcraftAddKeywordModal';
import type { AddonFormProps } from '../components/AddAddonModal';
import HaloWeaponForm from '../components/HaloWeaponForm';
import KillTeamWeaponForm from '../components/KillTeamWeaponForm';
import KillTeamAbilityForm from '../components/KillTeamAbilityForm';
import StarcraftWeaponForm from '../components/StarcraftWeaponForm';
import StarcraftAbilityForm from '../components/StarcraftAbilityForm';
import RygWarriorTypeForm from '../components/RygWarriorTypeForm';
import RygTalentForm from '../components/RygTalentForm';
import RygWeaponForm from '../components/RygWeaponForm';
import RygSimpleAddonForm from '../components/RygSimpleAddonForm';
import RygSpellForm from '../components/RygSpellForm';
import RygSeptForm from '../components/RygSeptForm';
import RygDestinyForm from '../components/RygDestinyForm';
import RygSeptBenefitForm from '../components/RygSeptBenefitForm';
import RygGodForm from '../components/RygGodForm';
import HaloFlashpointCard from '../components/HaloFlashpointCard';
import HaloFlashpointRuleCard from '../components/HaloFlashpointRuleCard';
import BloodBowlCard from '../components/BloodBowlCard';
import KillTeamCard from '../components/KillTeamCard';
import KillTeamRuleCard from '../components/KillTeamRuleCard';
import StarcraftCard from '../components/StarcraftCard';
import HaloCardForm from '../components/HaloCardForm';
import BloodBowlCardForm from '../components/BloodBowlCardForm';
import KillTeamCardForm from '../components/KillTeamCardForm';
import StarcraftCardForm from '../components/StarcraftCardForm';
import UploadPhotoModal from '../components/UploadPhotoModal';
import AddCircle from '../icons/AddCircle';
import UserRounded from '../icons/UserRounded';
import FileText from '../icons/FileText';
import Star from '../icons/Star';
import Bookmark from '../icons/Bookmark';
import MenuDots from '../icons/MenuDots';
import Pen2 from '../icons/Pen2';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';
import Copy from '../icons/Copy';
import AltArrowLeft from '../icons/AltArrowLeft';
import AltArrowRight from '../icons/AltArrowRight';
import CheckCircle from '../icons/CheckCircle';
import CloseCircle from '../icons/CloseCircle';
import Dropdown, { DropdownItem } from '../components/Dropdown';
import Modal from '../components/Modal';
import Input from '../components/Input';
import { supabase } from '../lib/supabase';
import type {
  PackWithGame, Card, Addon, Keyword, AddonType, Json,
} from '../lib/database.types';
import {
  dbRowsToHaloFlashpointProps,
  dbRowsToHaloFlashpointRuleProps,
  type HaloCardDbRow,
} from '../lib/cardShape/haloFlashpoint';
import {
  dbRowsToBloodBowlProps,
  type BloodBowlCardDbRow,
} from '../lib/cardShape/bloodBowl';
import {
  dbRowsToKillTeamProps,
  dbRowsToKillTeamRuleProps,
  type KillTeamCardDbRow,
} from '../lib/cardShape/killTeam';
import {
  dbRowsToStarcraftProps,
  type StarcraftCardDbRow,
} from '../lib/cardShape/starcraft';
import { ADDON_SUBTITLE_FORMATTERS } from '../lib/addonSubtitles';

// ── Local types ──────────────────────────────────────────────────────────────

type RuleType = { value: string; label: string; plural: string };

/** A pack card with its addon + keyword joins materialised, so the
 *  per-game card preview can render without extra round-trips.
 *  The joins are kept as `unknown[]` here — each per-game shaper has
 *  its own DbRow type and casts through unknown at the call site. */
type CardWithJoins = Card & {
  card_addons?:   unknown[];
  card_keywords?: unknown[];
  card_images?:   { file_path: string; image_type: string }[];
};

/** Everything AddToPackModal needs to render itself. PackEditor keeps one
 *  of these in state to drive which Add picker is currently open. */
type AddModalCtx = {
  entityType:     'card' | 'addon' | 'keyword';
  cardType?:      'operative' | 'rule';
  addonTypeId?:   string;
  title:          string;
  description?:   string;
  newButtonLabel: string;
  /** Formats addon rows' descriptive subtitle in the picker — bound to
   *  the panel's addon type so the stat-schema formatter knows which
   *  fields to read. */
  getAddonSubtitle?: (row: {
    description?: string | null;
    stats?:       Record<string, unknown>;
  }) => string;
};

// ── Stub for actions still awaiting their own flow ───────────────────────────
// Covers the "New X" button inside AddToPackModal (user said don't worry
// about that yet) and the Edit / Delete actions on existing pack rows
// (need confirmation modals + edit forms to be designed).
function stubNotImplemented(what: string) {
  alert(`${what} — coming soon`);
}

// ── Per-game addon edit forms ─────────────────────────────────────────────────
// An entry here gives that game/addon-type's rows an Edit item in their ⋯
// menu; the form renders directly inside a Modal (no picker step needed when
// editing a specific row). These are the same forms the builders feed to
// AddAddonModal — their builder-only context props (pending-keyword hand-offs,
// cross-card propagation) are optional and simply omitted here; the pack
// editor reloads from the DB after save instead.
//
// Blood Bowl has a `skills` addon type in the DB but its builder models
// skills as keywords (no skill-addon creation path), so it has no entry —
// those rows keep a delete-only menu, and skills edit through the Keywords
// panel. Its "New Skill" button stays stubbed for the same reason.
//
// The same forms also serve the "New X" create flow: rendered with
// editingAddon=null, they create a LIBRARY addon (matching their own copy:
// "Once created, you can add this X to other units…"), and onSaveComplete
// — fired after the form's addon_keywords sync — triggers the deep clone
// into the pack. Forms without the optional onSaveComplete prop still
// typecheck here; they just can't drive the create flow yet.
type PackAddonFormProps = AddonFormProps & {
  onSaveComplete?: (addonId: string) => void;
  onPendingTalents?: (talents: { id: string; name: string; description: string }[]) => void;
  /** Passed to forms that create keywords, so new keywords are scoped to
   *  the pack instead of the user's personal library. */
  packId?: string;
};
function RygArmorFormForPack(props: PackAddonFormProps) {
  return (
    <RygSimpleAddonForm
      {...props}
      showCost
      namePlaceholder="Armor Name"
      descPlaceholder="Describe the armor's effect…"
      saveLabel="Save Armor"
    />
  );
}

function RygItemFormForPack(props: PackAddonFormProps) {
  return (
    <RygSimpleAddonForm
      {...props}
      showCost
      namePlaceholder="Item Name"
      descPlaceholder="Describe the item's effect…"
      saveLabel="Save Item"
    />
  );
}

const ADDON_EDIT_FORMS: Record<string, Record<string, ComponentType<PackAddonFormProps>>> = {
  'halo-flashpoint': { weapons: HaloWeaponForm },
  'kill-team':       { weapons: KillTeamWeaponForm, abilities: KillTeamAbilityForm },
  'starcraft':       { weapons: StarcraftWeaponForm, rules: StarcraftAbilityForm },
  'ryg':             { 'warrior-type': RygWarriorTypeForm, 'talents': RygTalentForm, 'weapons': RygWeaponForm, 'armor': RygArmorFormForPack, 'items': RygItemFormForPack, 'spells': RygSpellForm, 'septs': RygSeptForm, 'destinies': RygDestinyForm, 'sept-benefits': RygSeptBenefitForm, 'gods': RygGodForm },
};

// ── Per-game addon panel layout ───────────────────────────────────────────────
// Slugs listed here render full-width (outside the 2-col grid), directly below
// the Unit Cards panel. All other addon types stay in the grid.
const FULL_WIDTH_ADDON_SLUGS: Record<string, string[]> = {};

// Slugs listed here are hidden from the pack editor entirely. Use for addon
// types that are managed elsewhere (e.g. as part of another addon's flow).
const HIDDEN_ADDON_SLUGS: Record<string, string[]> = {
  'ryg': ['special-ability'],
};

// Explicit sort order for addon panels per game. Slugs not listed fall to the
// end in their original DB order. Keywords always renders last in the grid.
const ADDON_TYPE_ORDER: Record<string, string[]> = {
  'ryg': ['warrior-type', 'talents', 'weapons', 'armor', 'items', 'spells', 'septs', 'destinies', 'sept-benefits', 'gods'],
};

// ── Per-game card creation forms ──────────────────────────────────────────────
// Each form handles the two-phase creation flow (stats → weapons/abilities/
// keywords) for its game. PackEditor resolves the right form from this map
// and renders it in a Modal when the user clicks "New Unit" / "New Rule Card".

type PackCardFormProps = {
  packId:      string;
  gameId:      string;
  addonTypes:  AddonType[];
  cardType?:   'operative' | 'rule';
  onSaved:     (cardId: string) => void;
  onCancel:    () => void;
  editingCard?: { id: string; name: string; stats: Record<string, unknown> | null };
};
const CARD_EDIT_FORMS: Record<string, ComponentType<PackCardFormProps>> = {
  'halo-flashpoint': HaloCardForm,
  // BloodBowlCardForm has no addonTypes/cardType — cast to shared props type;
  // React ignores extra props that the component doesn't declare.
  'blood-bowl':      BloodBowlCardForm as ComponentType<PackCardFormProps>,
  'kill-team':       KillTeamCardForm,
  'starcraft':       StarcraftCardForm,
};

// ── Pagination helpers ────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

interface PaginatedAddonListProps {
  list:         Addon[];
  describe:     (a: Addon) => string;
  singular:     string;
  EditForm?:    ComponentType<PackAddonFormProps>;
  onEdit:       (a: Addon) => void;
  onDelete:     (id: string, name: string) => void;
  emptyMessage: string;
}

function PaginatedAddonList({ list, describe, singular, EditForm, onEdit, onDelete, emptyMessage }: PaginatedAddonListProps) {
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(list.length / PAGE_SIZE);
  const slice = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (list.length === 0) return <EmptyPanelState message={emptyMessage} />;

  return (
    <div className="flex flex-col gap-2 w-full">
      {slice.map(a => (
        <AddonListItem
          key={a.id}
          name={a.name}
          subtitle={describe(a)}
          addonTypeName={singular}
          onEdit={EditForm ? () => onEdit(a) : undefined}
          onDelete={() => onDelete(a.id, a.name)}
        />
      ))}
      {pageCount > 1 && (
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="font-body text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          <span className="font-body text-xs text-gray-500">
            {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
            disabled={page === pageCount - 1}
            className="font-body text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function PaginatedKeywordList({ keywords, onEdit, onDelete }: {
  keywords: { id: string; name: string; description: string | null }[];
  onEdit:   (k: { id: string; name: string; description: string | null }) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const [page, setPage] = useState(0);
  const sorted = [...keywords].sort((a, b) => a.name.localeCompare(b.name));
  const pageCount = Math.ceil(sorted.length / PAGE_SIZE);
  const slice = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (sorted.length === 0) return <EmptyPanelState message="No keywords yet. Click Add Keyword to create one." />;

  return (
    <div className="flex flex-col gap-2 w-full">
      {slice.map(k => (
        <AddonListItem
          key={k.id}
          name={k.name}
          subtitle={k.description ?? ''}
          addonTypeName="Keyword"
          onEdit={() => onEdit(k)}
          onDelete={() => onDelete(k.id, k.name)}
        />
      ))}
      {pageCount > 1 && (
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="font-body text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          <span className="font-body text-xs text-gray-500">
            {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
            disabled={page === pageCount - 1}
            className="font-body text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PackEditor() {
  const { packId } = useParams<{ packId: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();

  // ── State ────────────────────────────────────────────────────────────────

  const [pack,        setPack]        = useState<PackWithGame | null>(null);
  const [addonTypes,  setAddonTypes]  = useState<AddonType[]>([]);
  const [cards,       setCards]       = useState<CardWithJoins[]>([]);
  const [addons,      setAddons]      = useState<Addon[]>([]);
  const [keywords,    setKeywords]    = useState<Keyword[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);

  // Pack metadata draft state (title, description, published status)
  const [draftName,       setDraftName]       = useState('');
  const [draftDesc,       setDraftDesc]       = useState('');
  const [draftIsPublic,   setDraftIsPublic]   = useState(false);
  const [draftIsOfficial, setDraftIsOfficial] = useState(false);
  const [savingMeta,      setSavingMeta]      = useState(false);

  // The AddToPackModal is reused for every "Add X" button. Null when closed;
  // a context object describing what to show otherwise.
  const [addModal, setAddModal] = useState<AddModalCtx | null>(null);

  // The keyword to edit. When non-null, AddKeywordModal opens in edit
  // mode (skips the picker step and shows the form pre-populated).
  // RLS allows pack owners to UPDATE keywords with pack_id matching one
  // they own, so the modal's update path works without changes.
  const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null);

  // The addon being edited, paired with its game-specific form from
  // ADDON_EDIT_FORMS (resolved at click time, when the addon-type slug is
  // in scope). When non-null, a Modal renders the form directly.
  const [editingAddon, setEditingAddon] = useState<{
    addon:     Addon;
    Form:      ComponentType<PackAddonFormProps>;
    typeLabel: string;
  } | null>(null);
  const [savingAddonEdit, setSavingAddonEdit] = useState(false);

  // Create-new flows launched from AddToPackModal's "New X" button.
  // Addons: the per-game form renders in create mode; the row lands in
  // the user's library first, then onSaveComplete deep-clones it into
  // the pack (cloning earlier would miss the form's addon_keywords sync).
  // Keywords: AddKeywordModal in createOnly mode, then the same
  // create-library-then-copy dance.
  const [creatingAddon, setCreatingAddon] = useState<{
    Form:        ComponentType<PackAddonFormProps>;
    addonTypeId: string;
    typeLabel:   string;
  } | null>(null);
  const [savingAddonCreate, setSavingAddonCreate] = useState(false);
  const pendingAddonTalents = useRef<{ id: string; name: string; description: string }[]>([]);
  const [creatingKeyword,   setCreatingKeyword]   = useState(false);

  // Card creation flow — resolves the per-game form from CARD_EDIT_FORMS and
  // renders it in a Modal when the user clicks "New Unit" or "New Rule Card".
  const [creatingCard, setCreatingCard] = useState<{
    cardType: 'operative' | 'rule';
    Form:     ComponentType<PackCardFormProps>;
  } | null>(null);

  // Card editing flow — stores the card being edited alongside its resolved
  // form so the modal can render it pre-filled without re-resolving on every
  // render. Mirrors the creatingCard pattern.
  const [editingCardCtx, setEditingCardCtx] = useState<{
    card: CardWithJoins;
    Form: ComponentType<PackCardFormProps>;
  } | null>(null);

  // Delete-confirmation state. One shared modal for every entity type;
  // `kind` picks the supabase table and the "this cannot be undone"
  // copy in the body. Cleared after a successful delete or cancel.
  const [confirmDelete, setConfirmDelete] = useState<{
    kind:      'card' | 'addon' | 'keyword';
    id:        string;
    name:      string;
    typeLabel: string;
  } | null>(null);
  const [deleting,   setDeleting]   = useState(false);
  const [deleteErr,  setDeleteErr]  = useState<string | null>(null);
  const [previewCard, setPreviewCard] = useState<CardWithJoins | null>(null);

  // Portrait upload flow — opened after AddToPackModal's "Add Portrait Image"
  // button copies a card into the pack. game is stored so UploadPhotoModal
  // can show game-appropriate framing.
  const [portraitUploadCard, setPortraitUploadCard] = useState<{
    id:   string;
    name: string;
    game: string;
  } | null>(null);

  // Publish flow — confirmation modal with editable name + description.
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishName,      setPublishName]      = useState('');
  const [publishDesc,      setPublishDesc]      = useState('');
  const [publishing,       setPublishing]       = useState(false);
  const [publishErr,       setPublishErr]       = useState<string | null>(null);

  // ── Load everything in parallel ──────────────────────────────────────────

  useEffect(() => {
    if (!packId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId]);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);

    try {
      // Pack + nested game. The game's rule_types tells us whether to show
      // the Rules panel; its slug drives per-game card rendering later.
      const { data: packData, error: packError } = await supabase
        .from('packs')
        .select('*, game:games(*)')
        .eq('id', packId!)
        .single();
      if (packError || !packData) throw packError ?? new Error('Pack not found');

      const fetchedPack = packData as PackWithGame;
      setPack(fetchedPack);
      setDraftName(fetchedPack.name);
      setDraftDesc(fetchedPack.description ?? '');
      setDraftIsPublic(fetchedPack.is_public ?? false);
      setDraftIsOfficial(fetchedPack.is_official ?? false);

      // Everything else fetched in parallel for snappy first paint.
      const [atRes, cardsRes, addonsRes, keywordsRes] = await Promise.all([
        supabase
          .from('addon_types')
          .select('*')
          .eq('game_id', fetchedPack.game_id)
          .order('name'),
        // Cards select pulls the full join graph so the preview can render
        // without follow-up fetches. The shape feeds every per-game shaper
        // in src/lib/cardShape/ — each one picks the fields it needs and
        // ignores the rest, so we can keep a single select for all games.
        supabase
          .from('cards')
          .select(`
            *,
            card_addons(addon_id, sort_order, addons(id, name, description,
              stats, parent_addon_id, addon_type:addon_types(slug),
              addon_keywords(keyword_id, params, sort_order,
                keywords(id, name, description, params_schema)))),
            card_keywords(keyword_id, params, sort_order,
              keywords(name, description, params_schema)),
            card_images(file_path, image_type)
          `)
          .eq('pack_id', packId!)
          .order('created_at'),
        supabase
          .from('addons')
          .select('*')
          .eq('pack_id', packId!)
          .order('created_at'),
        supabase
          .from('keywords')
          .select('*')
          .eq('pack_id', packId!)
          .order('name'),
      ]);

      setAddonTypes((atRes.data ?? []) as AddonType[]);
      // The nested select shape doesn't narrow cleanly via Supabase's TS,
      // so cast through unknown. Runtime shape matches CardWithJoins.
      setCards((cardsRes.data ?? []) as unknown as CardWithJoins[]);
      setAddons((addonsRes.data ?? []) as Addon[]);
      setKeywords((keywordsRes.data ?? []) as Keyword[]);
    } catch (e) {
      setLoadError(
        (e as { message?: string })?.message
          ?? 'Failed to load this pack. It may have been deleted or you may not have access.'
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Pack metadata inline edit ────────────────────────────────────────────

  // Meta fields are edited directly in the header inputs; changes are saved
  // on blur via a shared helper so every field goes through the same path.

  async function savePackMeta(patch: { name?: string; description?: string; is_public?: boolean; is_official?: boolean }) {
    if (!pack) return;
    const { error } = await supabase
      .from('packs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', pack.id);
    if (error) {
      console.error('[BattleCards] savePackMeta failed:', error);
      alert('Failed to save pack changes. Please try again.');
      return;
    }
    setPack({ ...pack, ...patch });
  }

  async function commitPackMetaDraft() {
    if (!pack || savingMeta) return;
    setSavingMeta(true);
    await savePackMeta({
      name:        draftName.trim() || pack.name,
      description: draftDesc.trim() || undefined,
      is_public:   draftIsPublic,
      is_official: draftIsOfficial,
    });
    setSavingMeta(false);
  }

  const metaDirty = pack != null && (
    draftName.trim() !== pack.name ||
    (draftDesc.trim() || undefined) !== (pack.description ?? undefined) ||
    draftIsPublic   !== (pack.is_public   ?? false) ||
    draftIsOfficial !== (pack.is_official ?? false)
  );

  // ── Delete (cards / addons / keywords) ─────────────────────────────────
  // The user can request a delete from any ⋯ menu; this opens the shared
  // confirmation modal. Continue then runs the DELETE through Supabase.
  // RLS (pack owner can delete pack rows) handles authz; FK ON DELETE
  // CASCADE on join tables takes care of card_addons / card_keywords /
  // addon_keywords cleanup automatically.

  const DELETE_TABLE: Record<'card' | 'addon' | 'keyword', 'cards' | 'addons' | 'keywords'> = {
    card:    'cards',
    addon:   'addons',
    keyword: 'keywords',
  };

  function requestDelete(
    kind: 'card' | 'addon' | 'keyword',
    id:   string,
    name: string,
    typeLabel: string,
  ) {
    setDeleteErr(null);
    setConfirmDelete({ kind, id, name, typeLabel });
  }

  function cancelDelete() {
    if (deleting) return;
    setConfirmDelete(null);
    setDeleteErr(null);
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    setDeleteErr(null);
    const { error } = await supabase
      .from(DELETE_TABLE[confirmDelete.kind])
      .delete()
      .eq('id', confirmDelete.id);
    setDeleting(false);
    if (error) {
      setDeleteErr(`Couldn't delete "${confirmDelete.name}". Please try again.`);
      return;
    }
    setConfirmDelete(null);
    loadAll();
  }

  const handlePublish = async () => {
    if (!pack || !packId) return;
    setPublishing(true);
    setPublishErr(null);
    try {
      const { error } = await supabase
        .from('packs')
        .update({
          name:        publishName.trim() || pack.name,
          description: publishDesc.trim() || null,
          is_public:   true,
        })
        .eq('id', packId);
      if (error) throw error;
      setPack(prev => prev
        ? { ...prev, name: publishName.trim() || prev.name, description: publishDesc.trim() || null, is_public: true }
        : prev,
      );
      setPublishModalOpen(false);
    } catch (err) {
      console.error('[BattleCards] Publish failed:', err);
      setPublishErr('Failed to publish. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  // ── Derived data per panel ───────────────────────────────────────────────

  const operativeCards = useMemo(
    () => cards.filter(c => c.card_type === 'operative'),
    [cards],
  );
  const ruleCards = useMemo(
    () => cards.filter(c => c.card_type === 'rule'),
    [cards],
  );
  const addonsByType = useMemo(() => {
    const grouped = new Map<string, Addon[]>();
    for (const at of addonTypes) grouped.set(at.id, []);
    for (const a of addons) {
      const list = grouped.get(a.addon_type_id);
      if (list) list.push(a);
    }
    grouped.forEach(list => list.sort((a, b) => a.name.localeCompare(b.name)));
    return grouped;
  }, [addons, addonTypes]);

  // Sort and split addon types per game-specific layout config.
  const sortedAddonTypes = useMemo(() => {
    const order  = pack ? (ADDON_TYPE_ORDER[pack.game.slug]  ?? []) : [];
    const hidden = pack ? (HIDDEN_ADDON_SLUGS[pack.game.slug] ?? []) : [];
    return [...addonTypes].filter(at => !hidden.includes(at.slug)).sort((a, b) => {
      const ai = order.indexOf(a.slug);
      const bi = order.indexOf(b.slug);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [addonTypes, pack]);

  const fullWidthAddonTypes = useMemo(() => {
    if (!pack) return [];
    const slugs = FULL_WIDTH_ADDON_SLUGS[pack.game.slug] ?? [];
    return sortedAddonTypes.filter(at => slugs.includes(at.slug));
  }, [sortedAddonTypes, pack]);

  const gridAddonTypes = useMemo(() => {
    if (!pack) return sortedAddonTypes;
    const slugs = FULL_WIDTH_ADDON_SLUGS[pack.game.slug] ?? [];
    return sortedAddonTypes.filter(at => !slugs.includes(at.slug));
  }, [sortedAddonTypes, pack]);

  // games.rule_types is a jsonb column added by the rule-types feature
  // branch — on content-packs alone the column may not exist yet, in which
  // case the property is just absent on the returned row. Cast through
  // unknown and treat absent / empty as "no rule cards for this game."
  const gameHasRules = Boolean(
    (pack?.game as unknown as { rule_types?: RuleType[] } | undefined)
      ?.rule_types?.length,
  );

  const previewModalDims = useMemo(() => {
    if (!previewCard || !pack) return null;
    const [nW, nH] = nativeDimsFor(previewCard, pack.game.slug);
    return modalDimsFor(nW, nH);
  }, [previewCard, pack]);

  async function handleDuplicateCard(card: CardWithJoins) {
    if (!pack) return;
    await supabase.rpc('copy_cards_to_pack', {
      p_target_pack_id: pack.id,
      p_source_ids:     [card.id],
    });
    await loadAll();
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">

      {/* No mode switcher in the pack editor — pass no children to Navbar. */}
      <Navbar fixed={false} />

      <div className="flex-1 flex flex-col px-3 py-6 md:px-9 md:py-9 gap-8">

        {loading ? (

          // ── Loading ────────────────────────────────────────────────────
          <div className="flex-1 flex items-center justify-center">
            <svg
              className="animate-spin size-8 text-blue-400"
              viewBox="0 0 24 24"
              fill="none"
              aria-label="Loading"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>

        ) : loadError || !pack ? (

          // ── Error / not found ──────────────────────────────────────────
          <div className="flex-1 flex flex-col items-center justify-center gap-3 max-w-md mx-auto text-center">
            <h1 className="font-heading text-2xl text-white">
              We couldn't load this pack
            </h1>
            <p className="font-body text-base text-gray-300">{loadError}</p>
            <Button
              variant="outline"
              color="secondary"
              leftIcon={<AltArrowLeft className="size-4" />}
              onClick={() => navigate('/app')}
              className="mt-2"
            >
              Back to home
            </Button>
          </div>

        ) : (

          // ── Loaded ─────────────────────────────────────────────────────
          <>

            {/* Pack metadata */}
            <div className="flex flex-col gap-3 max-w-xl mx-auto w-full">
              <div className="flex flex-col gap-1">
                <label className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">Pack Title</label>
                <input
                  type="text"
                  value={draftName}
                  maxLength={99}
                  placeholder="Pack title…"
                  onChange={e => setDraftName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className="font-body text-sm text-white bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">Description</label>
                <textarea
                  value={draftDesc}
                  placeholder="Describe what's in this pack…"
                  rows={3}
                  onChange={e => setDraftDesc(e.target.value)}
                  className="font-body text-sm text-white bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wide">Published Status</label>
                <select
                  value={draftIsOfficial ? 'official' : draftIsPublic ? 'public' : 'private'}
                  onChange={e => {
                    const v = e.target.value;
                    setDraftIsOfficial(v === 'official');
                    setDraftIsPublic(v === 'public' || v === 'official');
                  }}
                  className="font-body text-sm text-white bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="private">Private — only visible to you</option>
                  <option value="public">Public — visible to everyone</option>
                  {isAdmin && (
                    <option value="official">Official — auto-added to all new decks</option>
                  )}
                </select>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="filled"
                  color="primary"
                  disabled={!metaDirty || savingMeta}
                  onClick={commitPackMetaDraft}
                >
                  {savingMeta ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </div>

            {/* Units panel — full width */}
            <PackPanel
              icon={<UserRounded className="size-12 text-blue-400" />}
              title="Unit Cards"
              subtitle="Cards that represent units on the battlefield."
              addLabel="Add Unit"
              onAdd={() => setAddModal({
                entityType:    'card',
                cardType:      'operative',
                title:         'Add Unit to Pack',
                description:   'Adding this card will also add all the addons and keywords associated with it to the pack.',
                newButtonLabel:'New Unit',
              })}
            >
              {operativeCards.length === 0 ? (
                <EmptyPanelState message="No units yet. Click Add Unit to create one." />
              ) : (
                <CardPreviewRow
                  cards={operativeCards}
                  gameSlug={pack.game.slug}
                  onDeleteCard={card => requestDelete('card', card.id, card.name, 'Unit')}
                  onPreviewCard={setPreviewCard}
                  onEditCard={card => {
                    const CardForm = CARD_EDIT_FORMS[pack.game.slug];
                    if (CardForm) setEditingCardCtx({ card, Form: CardForm });
                  }}
                  onDuplicateCard={handleDuplicateCard}
                />
              )}
            </PackPanel>

            {/* Rules panel — full width, only when the game has rule_types */}
            {gameHasRules && (
              <PackPanel
                icon={<FileText className="size-12 text-blue-400" />}
                title="Rule Cards"
                subtitle="Faction rules, ploys, equipment and other rule cards."
                addLabel="Add Rule Card"
                onAdd={() => setAddModal({
                  entityType:    'card',
                  cardType:      'rule',
                  title:         'Add Rule Card to Pack',
                  description:   'Adding this card will also add all the addons and keywords associated with it to the pack.',
                  newButtonLabel:'New Rule Card',
                })}
              >
                {ruleCards.length === 0 ? (
                  <EmptyPanelState message="No rule cards yet. Click Add Rule Card to create one." />
                ) : (
                  <CardPreviewRow
                    cards={ruleCards}
                    gameSlug={pack.game.slug}
                    onDeleteCard={card => requestDelete('card', card.id, card.name, 'Rule Card')}
                    onPreviewCard={setPreviewCard}
                    onEditCard={card => {
                      const CardForm = CARD_EDIT_FORMS[pack.game.slug];
                      if (CardForm) setEditingCardCtx({ card, Form: CardForm });
                    }}
                  />
                )}
              </PackPanel>
            )}

            {/* Full-width addon panels (game-specific; e.g. RYG Warrior Types) */}
            {fullWidthAddonTypes.map(at => {
              const singular = singularise(at.name);
              const EditForm = ADDON_EDIT_FORMS[pack.game.slug]?.[at.slug];
              const subtitleFmt = ADDON_SUBTITLE_FORMATTERS[pack.game.slug]?.[at.slug];
              const describe = (a: { name?: string; description?: string | null; stats?: unknown }) =>
                subtitleFmt ? subtitleFmt(a) : addonSubtitle(a, at);
              return (
                <PackPanel
                  key={at.id}
                  icon={<Star className="size-12 text-blue-400" />}
                  title={at.name}
                  subtitle={`All ${at.name.toLowerCase()} in this pack.`}
                  addLabel={`Add ${singular}`}
                  onAdd={() => setAddModal({
                    entityType:    'addon',
                    addonTypeId:   at.id,
                    title:         `Add ${singular} to Pack`,
                    description:   `Adding this ${singular.toLowerCase()} will also add all keywords associated with it to the pack.`,
                    newButtonLabel:`New ${singular}`,
                    getAddonSubtitle: describe,
                  })}
                >
                  <PaginatedAddonList
                    list={addonsByType.get(at.id) ?? []}
                    describe={describe}
                    singular={singular}
                    EditForm={EditForm}
                    onEdit={a => setEditingAddon({ addon: a, Form: EditForm!, typeLabel: singular })}
                    onDelete={(id, name) => requestDelete('addon', id, name, singular)}
                    emptyMessage={`No ${at.name.toLowerCase()} yet. Click Add ${singular} to create one.`}
                  />
                </PackPanel>
              );
            })}

            {/* Addon + Keyword panels in a responsive 2-col grid.
                Kill Team has 2 addon types → 3 panels total (Weapons,
                Abilities, Keywords) and the third wraps onto a new row. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {gridAddonTypes.map(at => {
                const singular = singularise(at.name);
                // Games register their addon edit forms in ADDON_EDIT_FORMS;
                // combos without one (Blood Bowl skills) get no Edit item.
                const EditForm = ADDON_EDIT_FORMS[pack.game.slug]?.[at.slug];
                // Builder-style subtitle ("Ranged, R5, AP 1") where the game
                // registers one; otherwise the generic stat-schema dump.
                const subtitleFmt = ADDON_SUBTITLE_FORMATTERS[pack.game.slug]?.[at.slug];
                const describe = (a: { name?: string; description?: string | null; stats?: unknown }) =>
                  subtitleFmt ? subtitleFmt(a) : addonSubtitle(a, at);
                return (
                  <PackPanel
                    key={at.id}
                    icon={<Star className="size-12 text-blue-400" />}
                    title={at.name}
                    subtitle={`All ${at.name.toLowerCase()} in this pack.`}
                    addLabel={`Add ${singular}`}
                    onAdd={() => setAddModal({
                      entityType:    'addon',
                      addonTypeId:   at.id,
                      title:         `Add ${singular} to Pack`,
                      description:   `Adding this ${singular.toLowerCase()} will also add all keywords associated with it to the pack.`,
                      newButtonLabel:`New ${singular}`,
                      getAddonSubtitle: describe,
                    })}
                  >
                    <PaginatedAddonList
                      list={addonsByType.get(at.id) ?? []}
                      describe={describe}
                      singular={singular}
                      EditForm={EditForm}
                      onEdit={a => setEditingAddon({ addon: a, Form: EditForm!, typeLabel: singular })}
                      onDelete={(id, name) => requestDelete('addon', id, name, singular)}
                      emptyMessage={`No ${at.name.toLowerCase()} yet. Click Add ${singular} to create one.`}
                    />
                  </PackPanel>
                );
              })}

              {/* Keywords panel — always present, sits in the same grid. */}
              <PackPanel
                icon={<Bookmark className="size-12 text-blue-400" />}
                title="Keywords"
                subtitle="Keywords from units and addons."
                addLabel="Add Keyword"
                onAdd={() => setAddModal({
                  entityType:    'keyword',
                  title:         'Add Keyword to Pack',
                  newButtonLabel:'New Keyword',
                })}
              >
                <PaginatedKeywordList
                  keywords={keywords}
                  onEdit={k => setEditingKeyword(k as Keyword)}
                  onDelete={(id, name) => requestDelete('keyword', id, name, 'Keyword')}
                />
              </PackPanel>

            </div>

          </>

        )}

      </div>

      {/* Publish this Pack — fixed bottom-right floating button. Only shown
          while the pack is loaded and not yet public. */}
      {pack && !pack.is_public && (
        <div className="fixed bottom-6 right-6 z-10">
          <Button
            color="primary"
            leftIcon={<CheckCircle className="size-4" />}
            onClick={() => {
              setPublishName(pack.name);
              setPublishDesc(pack.description ?? '');
              setPublishErr(null);
              setPublishModalOpen(true);
            }}
          >
            Publish this Pack
          </Button>
        </div>
      )}

      {/* AddToPackModal — one instance, driven by addModal state. */}
      {pack && addModal && (
        <AddToPackModal
          open={true}
          onClose={() => setAddModal(null)}
          entityType={addModal.entityType}
          cardType={addModal.cardType}
          addonTypeId={addModal.addonTypeId}
          gameId={pack.game_id}
          targetPackId={pack.id}
          title={addModal.title}
          description={addModal.description}
          newButtonLabel={addModal.newButtonLabel}
          getAddonSubtitle={addModal.getAddonSubtitle}
          onCreateNew={() => {
            if (addModal.entityType === 'card') {
              const CardForm = CARD_EDIT_FORMS[pack.game.slug];
              if (CardForm) {
                setAddModal(null);
                setCreatingCard({
                  cardType: addModal.cardType ?? 'operative',
                  Form:     CardForm,
                });
                return;
              }
            } else if (addModal.entityType === 'addon' && addModal.addonTypeId) {
              const at = addonTypes.find(t => t.id === addModal.addonTypeId);
              const Form = at ? ADDON_EDIT_FORMS[pack.game.slug]?.[at.slug] : undefined;
              if (at && Form) {
                setAddModal(null);
                setCreatingAddon({ Form, addonTypeId: at.id, typeLabel: singularise(at.name) });
                return;
              }
            } else if (addModal.entityType === 'keyword') {
              setAddModal(null);
              setCreatingKeyword(true);
              return;
            }
            stubNotImplemented(addModal.newButtonLabel);
          }}
          enablePortrait={
            addModal.entityType === 'card' &&
            ['halo-flashpoint', 'blood-bowl', 'kill-team'].includes(pack.game.slug)
          }
          onAddedWithPortraitIntent={(newCardId, cardName) => {
            setAddModal(null);
            setPortraitUploadCard({ id: newCardId, name: cardName, game: pack.game.slug });
            loadAll();
          }}
          onAdded={() => {
            setAddModal(null);
            loadAll();
          }}
        />
      )}

      {/* Portrait upload modal — opened after "Add Portrait Image" in the
          picker copies a card into the pack. Reloads after upload so the
          preview tile shows the portrait immediately. */}
      {portraitUploadCard && (
        <UploadPhotoModal
          open
          onClose={() => { setPortraitUploadCard(null); loadAll(); }}
          game={portraitUploadCard.game as 'halo-flashpoint' | 'blood-bowl' | 'kill-team' | 'starcraft'}
          cardDbId={portraitUploadCard.id}
          unitName={portraitUploadCard.name}
          onImageUploaded={() => { setPortraitUploadCard(null); loadAll(); }}
        />
      )}

      {/* Edit-keyword modal — reuses the builder's AddKeywordModal in
          its edit-mode path. The modal's UPDATE goes through RLS, which
          allows pack owners to update their pack keywords. After save
          we reload the pack so the row's label / subtitle refresh.
          onKeywordSelected is required by the modal's type but only
          fires from the picker step, which we never reach here. */}
      {pack && editingKeyword && (
        <AddKeywordModal
          open={true}
          onClose={() => setEditingKeyword(null)}
          gameSlug={pack.game.slug}
          editingKeyword={{
            id:          editingKeyword.id,
            name:        editingKeyword.name,
            description: editingKeyword.description ?? '',
            hasParams:   Array.isArray(editingKeyword.params_schema)
                         && editingKeyword.params_schema.length > 0,
          }}
          onKeywordSelected={() => {/* unreachable in edit-only flow */}}
          onKeywordUpdated={() => {
            setEditingKeyword(null);
            loadAll();
          }}
        />
      )}

      {/* Edit addon modal — renders the game-specific form from
          ADDON_EDIT_FORMS directly inside a Modal (no picker step needed
          when editing one specific row). The form writes the addon row +
          addon_keywords joins, then we reload the pack so the subtitle /
          keyword counts refresh. The pack editor doesn't have in-memory
          keyword caches the way builders do, so it omits the forms'
          optional builder-context props. */}
      {editingAddon && (
        <Modal
          open
          onClose={() => !savingAddonEdit && setEditingAddon(null)}
          className="max-w-md"
        >
          <editingAddon.Form
            editingAddon={editingAddon.addon}
            saving={savingAddonEdit}
            onCancel={() => setEditingAddon(null)}
            onSave={async (name, description, stats) => {
              setSavingAddonEdit(true);
              try {
                const { error } = await supabase
                  .from('addons')
                  .update({ name, description, stats: stats as Json })
                  .eq('id', editingAddon.addon.id);
                if (error) throw error;
                const savedId = editingAddon.addon.id;
                setEditingAddon(null);
                await loadAll();
                return savedId;
              } catch (err) {
                console.error(`[BattleCards] ${editingAddon.typeLabel.toLowerCase()} edit error:`, err);
                return '';
              } finally {
                setSavingAddonEdit(false);
              }
            }}
          />
        </Modal>
      )}

      {/* Create addon modal — the per-game form in create mode. onSave
          inserts the addon directly into the pack (pack_id set on insert).
          onSaveComplete handles copying any pending related addons (e.g.
          warrior-type talents) that were created separately in the library. */}
      {pack && creatingAddon && (
        <Modal
          open
          onClose={() => !savingAddonCreate && setCreatingAddon(null)}
          className="max-w-md"
        >
          <creatingAddon.Form
            editingAddon={null}
            saving={savingAddonCreate}
            packId={pack.id}
            onCancel={() => { setCreatingAddon(null); pendingAddonTalents.current = []; }}
            onPendingTalents={talents => { pendingAddonTalents.current = talents; }}
            onSave={async (name, description, stats) => {
              setSavingAddonCreate(true);
              try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('Not signed in');
                const { data, error } = await supabase
                  .from('addons')
                  .insert({
                    user_id:       user.id,
                    addon_type_id: creatingAddon.addonTypeId,
                    pack_id:       pack.id,
                    name,
                    description,
                    stats:         stats as Json,
                  })
                  .select('id')
                  .single();
                if (error) throw error;
                return (data as { id: string }).id;
              } catch (err) {
                console.error(`[BattleCards] ${creatingAddon.typeLabel.toLowerCase()} create error:`, err);
                return '';
              } finally {
                setSavingAddonCreate(false);
              }
            }}
            onSaveComplete={async _addonId => {
              // The main addon was already inserted with pack_id set.
              // Only copy pending related addons (e.g. warrior-type talents).
              const talentIds = pendingAddonTalents.current.map(t => t.id);
              pendingAddonTalents.current = [];
              if (talentIds.length > 0) {
                const { error } = await supabase.rpc('copy_addons_to_pack', {
                  p_target_pack_id: pack.id,
                  p_source_ids:     talentIds,
                });
                if (error) console.error('[BattleCards] copy talents to pack error:', error);
              }
              setCreatingAddon(null);
              await loadAll();
            }}
          />
        </Modal>
      )}

      {/* Create keyword modal — the game's keyword modal in createOnly
          mode (the picker step would duplicate AddToPackModal's job).
          StarCraft uses its own modal because its keyword values are
          strings (params_schema key "value") rather than the numeric "X"
          the shared modal writes. Either way the keyword lands in the
          user's library, then gets copied into the pack. */}
      {pack && creatingKeyword && (
        pack.game.slug === 'starcraft' ? (
          <StarcraftAddKeywordModal
            open
            onClose={() => setCreatingKeyword(false)}
            createOnly
            onKeywordSelected={async kw => {
              const { error } = await supabase.rpc('copy_keywords_to_pack', {
                p_target_pack_id: pack.id,
                p_source_ids:     [kw.keywordId],
              });
              if (error) console.error('[BattleCards] copy new keyword to pack error:', error);
              setCreatingKeyword(false);
              await loadAll();
            }}
          />
        ) : (
          <AddKeywordModal
            open
            onClose={() => setCreatingKeyword(false)}
            gameSlug={pack.game.slug}
            createOnly
            typeName={pack.game.slug === 'blood-bowl' ? 'Skill' : 'Keyword'}
            onKeywordSelected={async kw => {
              const { error } = await supabase.rpc('copy_keywords_to_pack', {
                p_target_pack_id: pack.id,
                p_source_ids:     [kw.keywordId],
              });
              if (error) console.error('[BattleCards] copy new keyword to pack error:', error);
              setCreatingKeyword(false);
              await loadAll();
            }}
          />
        )
      )}

      {/* Card creation modal — two-phase flow (stats → content). The form
          is resolved from CARD_EDIT_FORMS by game slug and stored with the
          state so it doesn't need re-resolution on each render. After the
          user clicks Done the pack is reloaded to show the new card. */}
      {pack && creatingCard && (
        <Modal open onClose={() => setCreatingCard(null)} className="max-w-xl">
          <creatingCard.Form
            packId={pack.id}
            gameId={pack.game_id}
            addonTypes={addonTypes}
            cardType={creatingCard.cardType}
            onSaved={() => {
              setCreatingCard(null);
              loadAll();
            }}
            onCancel={() => setCreatingCard(null)}
          />
        </Modal>
      )}

      {/* Edit card modal — same two-phase form as creation, pre-filled from
          the card's name + stats. Phase 1 saves via UPDATE; Phase 2 loads the
          existing weapons/keywords so the user can modify without losing them. */}
      {pack && editingCardCtx && (
        <Modal open onClose={() => setEditingCardCtx(null)} className="max-w-xl">
          <editingCardCtx.Form
            packId={pack.id}
            gameId={pack.game_id}
            addonTypes={addonTypes}
            cardType={editingCardCtx.card.card_type as 'operative' | 'rule'}
            editingCard={{
              id:    editingCardCtx.card.id,
              name:  editingCardCtx.card.name,
              stats: editingCardCtx.card.stats as Record<string, unknown> | null,
            }}
            onSaved={() => { setEditingCardCtx(null); loadAll(); }}
            onCancel={() => setEditingCardCtx(null)}
          />
        </Modal>
      )}

      {/* Shared delete confirmation modal — used by every ⋯ menu. */}
      <Modal
        open={confirmDelete !== null}
        onClose={cancelDelete}
        className="max-w-xs"
      >
        {confirmDelete && (
          <div className="flex flex-col gap-3 p-5">

            <TrashBinMinimalistic className="size-8 text-blue-400" />

            <h2 className="font-heading text-xl text-white">
              Delete this {confirmDelete.typeLabel.toLowerCase()}?
            </h2>

            <p className="font-body text-base text-gray-300">
              This will remove
              {' '}
              <span className="font-bold text-white">
                {confirmDelete.name || `(unnamed ${confirmDelete.typeLabel.toLowerCase()})`}
              </span>
              {' '}
              from this pack. This cannot be undone.
            </p>

            {deleteErr && (
              <p className="font-body text-sm text-red-400">{deleteErr}</p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="ghost"
                color="danger"
                disabled={deleting}
                onClick={cancelDelete}
              >
                Cancel
              </Button>
              <Button
                color="danger"
                loading={deleting}
                rightIcon={<AltArrowRight className="size-4" />}
                onClick={handleConfirmDelete}
              >
                Continue
              </Button>
            </div>

          </div>
        )}
      </Modal>

      {/* Card preview modal — full-size card */}
      {previewCard && previewModalDims && pack && (
        <Modal open onClose={() => setPreviewCard(null)} className="max-w-[700px]">
          <div className="flex justify-center pt-4 px-4">
            <div style={{ width: previewModalDims.w, height: previewModalDims.h, overflow: 'hidden', borderRadius: 6, flexShrink: 0 }}>
              <div style={{ width: previewModalDims.nativeW, height: previewModalDims.nativeH, transform: `scale(${previewModalDims.scale})`, transformOrigin: 'top left' }}>
                {renderCardOnly(previewCard, pack.game.slug)}
              </div>
            </div>
          </div>
          <div className="px-4 pb-3 pt-2 border-t border-gray-700">
            <p className="font-body font-bold text-sm text-white uppercase tracking-[1px] truncate">
              {previewCard.name}
            </p>
          </div>
        </Modal>
      )}

      {/* Publish confirmation modal */}
      <Modal
        open={publishModalOpen}
        onClose={() => !publishing && setPublishModalOpen(false)}
        className="max-w-md"
      >
        <div className="flex flex-col gap-4 p-5">

          <h2 className="font-heading text-xl text-white">Publish Pack?</h2>

          <p className="font-body text-base text-gray-300">
            This pack will be available for any user to download. You can update
            the name and description before continuing.
          </p>

          <div className="flex flex-col gap-1">
            <label className="font-body text-sm font-medium text-white">
              Pack Name <span className="text-red-400">*</span>
            </label>
            <Input
              placeholder="Enter your pack name"
              value={publishName}
              onChange={e => setPublishName(e.target.value)}
              disabled={publishing}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-body text-sm font-medium text-white">
              Pack Description <span className="text-red-400">*</span>
            </label>
            <textarea
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2
                         font-body text-sm text-white placeholder:text-gray-500
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                         min-h-[110px] resize-y disabled:opacity-50"
              placeholder="What's contained in the pack"
              value={publishDesc}
              disabled={publishing}
              onChange={e => setPublishDesc(e.target.value)}
            />
          </div>

          {publishErr && (
            <p className="font-body text-sm text-red-400">{publishErr}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <Button
              variant="ghost"
              color="danger"
              leftIcon={<CloseCircle className="size-4" />}
              disabled={publishing}
              onClick={() => setPublishModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              leftIcon={<CheckCircle className="size-4" />}
              loading={publishing}
              disabled={!publishName.trim() || publishing}
              onClick={handlePublish}
            >
              Publish
            </Button>
          </div>

        </div>
      </Modal>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
//  Local helpers / sub-components
// ────────────────────────────────────────────────────────────────────────────

/** Shared chrome for every section in the pack editor. Renders a
 *  card-style container with a header row (icon + title + subtitle + Add)
 *  and a content slot below. */
interface PackPanelProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  addLabel: string;
  onAdd: () => void;
  children: React.ReactNode;
}

function PackPanel({ icon, title, subtitle, addLabel, onAdd, children }: PackPanelProps) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-sm overflow-hidden">
      <div className="flex flex-col gap-5 p-5">

        {/* Header — icon (48) on the left, title+subtitle in the middle,
            Add button on the right. Wraps on narrow viewports. */}
        <div className="flex flex-wrap items-start gap-4">
          <div className="shrink-0">{icon}</div>
          <div className="flex-1 min-w-0 flex flex-col">
            <h2 className="font-heading text-[20px] leading-7 text-white">
              {title}
            </h2>
            <p className="font-body text-base leading-6 text-gray-300">
              {subtitle}
            </p>
          </div>
          <Button
            variant="outline"
            color="primary"
            leftIcon={<AddCircle className="size-4" />}
            onClick={onAdd}
          >
            {addLabel}
          </Button>
        </div>

        {/* Content */}
        <div>{children}</div>

      </div>
    </div>
  );
}

/** Inline empty-state message used by every panel. */
function EmptyPanelState({ message }: { message: string }) {
  return (
    <p className="font-body text-base text-gray-400 text-center py-8">
      {message}
    </p>
  );
}

/** Horizontal row of card previews for the Unit / Rule panels.
 *
 *  Each per-game arm renders the actual game card component (the same
 *  one used in the deck builder) inside a CSS-scaled wrapper, so the
 *  preview is pixel-faithful and stays in sync with any future card
 *  layout tweaks. All tiles are sized so their long edge is ~237px,
 *  matching the Figma "Unit List Item" cell. */

const MODAL_LONG_EDGE = 660;

interface PreviewDims {
  nativeW: number;
  nativeH: number;
  scale:   number;
  /** Final on-screen width of the preview tile. */
  w:       number;
  /** Final on-screen height of the preview tile. */
  h:       number;
}

function modalDimsFor(nativeW: number, nativeH: number): PreviewDims {
  const scale = MODAL_LONG_EDGE / Math.max(nativeW, nativeH);
  return { nativeW, nativeH, scale, w: Math.round(nativeW * scale), h: Math.round(nativeH * scale) };
}

/** Returns the [width, height] of the native card component for a given card. */
function nativeDimsFor(c: CardWithJoins, gameSlug: string): [number, number] {
  if (gameSlug === 'blood-bowl') return [750, 1100];
  if (gameSlug === 'kill-team' && c.card_type === 'rule') return [700, 1200];
  if (gameSlug === 'halo-flashpoint' && c.card_type === 'rule') return [1270, 890];
  return [1270, 890];
}

/** Returns the public portrait URL for a card if one exists, otherwise undefined. */
function getPortraitUrl(c: CardWithJoins): string | undefined {
  const img = c.card_images?.find(ci => ci.image_type === 'portrait');
  if (!img) return undefined;
  return supabase.storage.from('card-images').getPublicUrl(img.file_path).data.publicUrl;
}

/** Renders just the game card component — no tile wrapper. Used by both the
 *  preview tile (via renderPreview) and the full-size card preview modal. */
function renderCardOnly(c: CardWithJoins, gameSlug: string): React.ReactNode {
  const portraitUrl = getPortraitUrl(c);
  if (gameSlug === 'halo-flashpoint') {
    if (c.card_type === 'rule') {
      return <HaloFlashpointRuleCard {...dbRowsToHaloFlashpointRuleProps(c as unknown as HaloCardDbRow)} />;
    }
    return <HaloFlashpointCard {...dbRowsToHaloFlashpointProps(c as unknown as HaloCardDbRow, { portraitUrl })} />;
  }
  if (gameSlug === 'blood-bowl') {
    return <BloodBowlCard {...dbRowsToBloodBowlProps(c as unknown as BloodBowlCardDbRow, { portraitUrl })} />;
  }
  if (gameSlug === 'kill-team') {
    if (c.card_type === 'rule') {
      return <KillTeamRuleCard {...dbRowsToKillTeamRuleProps(c as unknown as KillTeamCardDbRow)} />;
    }
    return <KillTeamCard {...dbRowsToKillTeamProps(c as unknown as KillTeamCardDbRow, { portraitUrl })} forceLayout="desktop" />;
  }
  if (gameSlug === 'starcraft') {
    return <StarcraftCard {...dbRowsToStarcraftProps(c as unknown as StarcraftCardDbRow)} />;
  }
  return (
    <div className="flex items-center justify-center bg-gray-700" style={{ width: 1270, height: 890 }}>
      <p className="font-heading text-[80px] text-white text-center truncate">{c.name}</p>
    </div>
  );
}

/** Shared wrapper that draws the card-shaped bounding box, applies the
 *  CSS transform that scales the native-size card into the tile, and
 *  renders the footer label (uppercase card name + ⋯ menu) below the
 *  preview. Matches Figma node 919:16810.
 *
 *  ⋯ renders a Dropdown with Edit / Delete items when their handlers
 *  are provided. The outer container deliberately omits overflow-hidden
 *  so the Dropdown panel can escape — the card area applies its own
 *  overflow-hidden + rounded-t-[6px] to keep the scaled card clipped. */
function PreviewTile({
  title,
  subtitle,
  typeLabel = 'Card',
  onEdit,
  onDuplicate,
  onDelete,
  onPreview,
}: {
  title?:    string;
  subtitle?: string;
  /** Used in the menu item copy: "Delete {typeLabel}", "Edit {typeLabel}". */
  typeLabel?:   string;
  onEdit?:      () => void;
  onDuplicate?: () => void;
  onDelete?:    () => void;
  onPreview?:   () => void;
}) {
  const hasSubtitle = Boolean(subtitle);
  return (
    <div
      className={[
        'group flex gap-1.5 items-start w-full px-[7px]',
        hasSubtitle ? 'py-px h-[66px]' : 'h-[50px]',
        'bg-gray-800 rounded-lg shadow-sm border border-gray-700',
        'hover:border-gray-500 transition-colors',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onPreview}
        disabled={!onPreview}
        className="flex-1 flex flex-col justify-center min-w-0 h-full text-left leading-none disabled:cursor-default"
      >
        <p className="font-heading text-[18px] leading-6 text-gray-300 group-hover:text-white transition-colors truncate">
          {title ?? ''}
        </p>
        {subtitle && (
          <p className="font-body text-[12px] leading-4 text-gray-400 truncate w-full">
            {subtitle}
          </p>
        )}
      </button>

      {(onEdit || onDuplicate || onDelete) && (
        <div className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity self-start pt-[5px]">
          <Dropdown
            align="right"
            menuClassName="w-40"
            trigger={
              <button
                type="button"
                aria-label={`${typeLabel} options`}
                className="p-1 flex items-center justify-center text-gray-300 hover:text-white"
              >
                <MenuDots className="size-4" />
              </button>
            }
          >
            {onEdit && (
              <DropdownItem icon={<Pen2 className="size-4" />} onClick={onEdit}>
                Edit {typeLabel}
              </DropdownItem>
            )}
            {onDuplicate && (
              <DropdownItem icon={<Copy className="size-4" />} onClick={onDuplicate}>
                Duplicate Unit
              </DropdownItem>
            )}
            {onDelete && (
              <DropdownItem
                icon={<TrashBinMinimalistic className="size-4" />}
                onClick={onDelete}
                className="!text-red-400 hover:!text-red-300 dark:!text-red-400 dark:hover:!text-red-300"
              >
                Delete {typeLabel}
              </DropdownItem>
            )}
          </Dropdown>
        </div>
      )}
    </div>
  );
}

/** Subtitle for a card list item: addon names in sort order, falling back
 *  to keyword names if the card has no addons (e.g. games with no addon
 *  types, or cards that only carry keywords). */
function cardSubtitle(c: CardWithJoins): string {
  type AddonJoin = { sort_order: number | null; addons: { name: string } | null };
  type KwJoin    = { sort_order: number | null; keywords: { name: string } | null };

  const addonRows = (c.card_addons as AddonJoin[] | undefined) ?? [];
  const addonNames = addonRows
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(a => a.addons?.name)
    .filter((n): n is string => Boolean(n));
  if (addonNames.length > 0) return addonNames.join(', ');

  const kwRows = (c.card_keywords as KwJoin[] | undefined) ?? [];
  return kwRows
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(k => k.keywords?.name)
    .filter((n): n is string => Boolean(n))
    .join(', ');
}

/** Per-card preview render — delegates to renderCardOnly for the card
 *  component and wraps it in PreviewTile. onPreview opens the full-size
 *  modal; onEdit/onDelete wire into the ⋯ menu. */
function renderPreview(
  c: CardWithJoins,
  _gameSlug: string,
  onDelete:     () => void,
  onPreview:    () => void,
  onEdit:       () => void,
  onDuplicate?: () => void,
): React.ReactNode {
  const typeLabel = c.card_type === 'rule' ? 'Rule Card' : 'Unit';
  return (
    <PreviewTile
      key={c.id}
      title={c.name}
      subtitle={cardSubtitle(c)}
      typeLabel={typeLabel}
      onDelete={onDelete}
      onPreview={onPreview}
      onEdit={onEdit}
      onDuplicate={onDuplicate}
    />
  );
}

function CardPreviewRow({
  cards,
  gameSlug,
  onDeleteCard,
  onPreviewCard,
  onEditCard,
  onDuplicateCard,
}: {
  cards:    CardWithJoins[];
  gameSlug: string;
  onDeleteCard:     (card: CardWithJoins) => void;
  onPreviewCard:    (card: CardWithJoins) => void;
  onEditCard:       (card: CardWithJoins) => void;
  onDuplicateCard?: (card: CardWithJoins) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {cards.map(c => renderPreview(
        c, gameSlug,
        () => onDeleteCard(c),
        () => onPreviewCard(c),
        () => onEditCard(c),
        onDuplicateCard ? () => onDuplicateCard(c) : undefined,
      ))}
    </div>
  );
}

/** Crude but readable subtitle for an addon row. The real subtitle would
 *  come from a per-game formatter (Halo formats weapons "Ranged, R5, AP 1");
 *  for v1 we list the stat values present, in stat-schema order. */
function addonSubtitle(
  addon: { description?: string | null; stats?: unknown },
  addonType: AddonType,
): string {
  const parts: string[] = [];
  for (const f of addonType.stat_schema) {
    const v = ((addon.stats ?? {}) as Record<string, Json>)[f.key];
    if (v === undefined || v === null || v === '') continue;
    parts.push(String(v));
  }
  if (addon.description) parts.push(addon.description);
  return parts.join(', ');
}

/** Map plural addon-type names to a singular label for button copy:
 *  "Weapons" → "Weapon", "Skills" → "Skill", "Abilities" → "Ability".
 *  Falls back to the original string when nothing matches. */
function singularise(name: string): string {
  if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
  if (name.endsWith('s'))   return name.slice(0, -1);
  return name;
}
