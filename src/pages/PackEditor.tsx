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

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Button from '../components/Button';
import AddonListItem from '../components/AddonListItem';
import AddToPackModal from '../components/AddToPackModal';
import AddKeywordModal from '../components/AddKeywordModal';
import HaloWeaponForm from '../components/HaloWeaponForm';
import HaloFlashpointCard from '../components/HaloFlashpointCard';
import BloodBowlCard from '../components/BloodBowlCard';
import KillTeamCard from '../components/KillTeamCard';
import KillTeamRuleCard from '../components/KillTeamRuleCard';
import StarcraftCard from '../components/StarcraftCard';
import AddCircle from '../icons/AddCircle';
import UserRounded from '../icons/UserRounded';
import FileText from '../icons/FileText';
import Star from '../icons/Star';
import Bookmark from '../icons/Bookmark';
import MenuDots from '../icons/MenuDots';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';
import AltArrowLeft from '../icons/AltArrowLeft';
import AltArrowRight from '../icons/AltArrowRight';
import Dropdown, { DropdownItem } from '../components/Dropdown';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabase';
import type {
  PackWithGame, Card, Addon, Keyword, AddonType, Json,
} from '../lib/database.types';
import {
  dbRowsToHaloFlashpointProps,
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

// ── Local types ──────────────────────────────────────────────────────────────

type RuleType = { value: string; label: string; plural: string };

/** A pack card with its addon + keyword joins materialised, so the
 *  per-game card preview can render without extra round-trips.
 *  The joins are kept as `unknown[]` here — each per-game shaper has
 *  its own DbRow type and casts through unknown at the call site. */
type CardWithJoins = Card & {
  card_addons?:   unknown[];
  card_keywords?: unknown[];
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
};

// ── Stub for actions still awaiting their own flow ───────────────────────────
// Covers the "New X" button inside AddToPackModal (user said don't worry
// about that yet) and the Edit / Delete actions on existing pack rows
// (need confirmation modals + edit forms to be designed).
function stubNotImplemented(what: string) {
  alert(`${what} — coming soon`);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PackEditor() {
  const { packId } = useParams<{ packId: string }>();
  const navigate = useNavigate();

  // ── State ────────────────────────────────────────────────────────────────

  const [pack,        setPack]        = useState<PackWithGame | null>(null);
  const [addonTypes,  setAddonTypes]  = useState<AddonType[]>([]);
  const [cards,       setCards]       = useState<CardWithJoins[]>([]);
  const [addons,      setAddons]      = useState<Addon[]>([]);
  const [keywords,    setKeywords]    = useState<Keyword[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);

  // Pack-name inline-edit state
  const [editingName, setEditingName] = useState(false);
  const [nameDraft,   setNameDraft]   = useState('');
  const [savingName,  setSavingName]  = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // The AddToPackModal is reused for every "Add X" button. Null when closed;
  // a context object describing what to show otherwise.
  const [addModal, setAddModal] = useState<AddModalCtx | null>(null);

  // The keyword to edit. When non-null, AddKeywordModal opens in edit
  // mode (skips the picker step and shows the form pre-populated).
  // RLS allows pack owners to UPDATE keywords with pack_id matching one
  // they own, so the modal's update path works without changes.
  const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null);

  // The Halo weapon addon to edit. When non-null, a Modal renders
  // HaloWeaponForm directly (no picker step). Other game/addon
  // combinations don't have per-game forms extracted yet, so they
  // omit the Edit menu item entirely.
  const [editingWeaponAddon, setEditingWeaponAddon] = useState<Addon | null>(null);
  const [savingWeaponEdit,   setSavingWeaponEdit]   = useState(false);

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
              keywords(name, description, params_schema))
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

  // ── Pack name inline edit ────────────────────────────────────────────────

  function startEditingName() {
    if (!pack || savingName) return;
    setNameDraft(pack.name);
    setEditingName(true);
    // Focus + select after the input mounts.
    setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 0);
  }

  function cancelEditingName() {
    setEditingName(false);
    setNameDraft('');
  }

  async function commitName() {
    const trimmed = nameDraft.trim();
    if (!pack) return;
    if (trimmed.length === 0 || trimmed === pack.name) {
      cancelEditingName();
      return;
    }
    setSavingName(true);
    const { error } = await supabase
      .from('packs')
      .update({ name: trimmed, updated_at: new Date().toISOString() })
      .eq('id', pack.id);
    setSavingName(false);
    if (error) {
      // Soft-fail: keep editing so the user can retry / cancel.
      alert("Couldn't save the new name. Please try again.");
      return;
    }
    setPack({ ...pack, name: trimmed });
    setEditingName(false);
  }

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
    return grouped;
  }, [addons, addonTypes]);

  // games.rule_types is a jsonb column added by the rule-types feature
  // branch — on content-packs alone the column may not exist yet, in which
  // case the property is just absent on the returned row. Cast through
  // unknown and treat absent / empty as "no rule cards for this game."
  const gameHasRules = Boolean(
    (pack?.game as unknown as { rule_types?: RuleType[] } | undefined)
      ?.rule_types?.length,
  );

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

            {/* Pack name — centered, double-click to edit inline */}
            <div className="flex justify-center">
              {editingName ? (
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameDraft}
                  maxLength={99}
                  disabled={savingName}
                  onChange={e => setNameDraft(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  { e.preventDefault(); commitName(); }
                    if (e.key === 'Escape') { e.preventDefault(); cancelEditingName(); }
                  }}
                  className="font-heading text-[24px] leading-8 text-white text-center bg-gray-800 border border-blue-500 rounded px-3 py-1 outline-none min-w-[300px]"
                />
              ) : (
                <h1
                  onDoubleClick={startEditingName}
                  title="Double-click to rename"
                  className="font-heading text-[24px] leading-8 text-white text-center cursor-text select-none"
                >
                  {pack.name}
                </h1>
              )}
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
                  />
                )}
              </PackPanel>
            )}

            {/* Addon + Keyword panels in a responsive 2-col grid.
                Kill Team has 2 addon types → 3 panels total (Weapons,
                Abilities, Keywords) and the third wraps onto a new row. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {addonTypes.map(at => {
                const singular = singularise(at.name);
                // Only Halo weapons have an extracted edit form so far.
                // Other game/addon-type combos will gain Edit menu items
                // as their forms get extracted in follow-up tranches.
                const canEdit =
                  pack.game.slug === 'halo-flashpoint' && at.slug === 'weapons';
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
                    })}
                  >
                    {(() => {
                      const list = addonsByType.get(at.id) ?? [];
                      if (list.length === 0) {
                        return (
                          <EmptyPanelState
                            message={`No ${at.name.toLowerCase()} yet. Click Add ${singular} to create one.`}
                          />
                        );
                      }
                      return (
                        <div className="flex flex-col gap-2 w-full">
                          {list.map(a => (
                            <AddonListItem
                              key={a.id}
                              name={a.name}
                              subtitle={addonSubtitle(a, at)}
                              addonTypeName={singular}
                              onEdit={canEdit ? () => setEditingWeaponAddon(a) : undefined}
                              onDelete={() => requestDelete('addon', a.id, a.name, singular)}
                            />
                          ))}
                        </div>
                      );
                    })()}
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
                {keywords.length === 0 ? (
                  <EmptyPanelState message="No keywords yet. Click Add Keyword to create one." />
                ) : (
                  <div className="flex flex-col gap-2 w-full">
                    {keywords.map(k => (
                      <AddonListItem
                        key={k.id}
                        name={k.name}
                        subtitle={k.description ?? ''}
                        addonTypeName="Keyword"
                        onEdit={() => setEditingKeyword(k)}
                        onDelete={() => requestDelete('keyword', k.id, k.name, 'Keyword')}
                      />
                    ))}
                  </div>
                )}
              </PackPanel>

            </div>

          </>

        )}

      </div>

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
          onCreateNew={() => stubNotImplemented(addModal.newButtonLabel)}
          onAdded={() => {
            setAddModal(null);
            loadAll();
          }}
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

      {/* Edit Halo weapon modal — renders HaloWeaponForm directly inside a
          Modal (no picker step needed when editing one specific row). The
          form writes addon row + addon_keywords joins, then we reload the
          pack so the subtitle / keyword counts refresh. The pack editor
          doesn't have in-memory weapon-keyword caches the way builders do,
          so it ignores the form's onPendingKeywords /
          onPropagateKeywordUpdate side-channels. */}
      {editingWeaponAddon && (
        <Modal
          open
          onClose={() => !savingWeaponEdit && setEditingWeaponAddon(null)}
          className="max-w-md"
        >
          <HaloWeaponForm
            editingAddon={editingWeaponAddon}
            saving={savingWeaponEdit}
            onCancel={() => setEditingWeaponAddon(null)}
            onSave={async (name, description, stats) => {
              setSavingWeaponEdit(true);
              try {
                const { error } = await supabase
                  .from('addons')
                  .update({ name, description, stats: stats as Json })
                  .eq('id', editingWeaponAddon.id);
                if (error) throw error;
                const savedId = editingWeaponAddon.id;
                setEditingWeaponAddon(null);
                await loadAll();
                return savedId;
              } catch (err) {
                console.error('[BattleCards] weapon edit error:', err);
                return '';
              } finally {
                setSavingWeaponEdit(false);
              }
            }}
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

const PREVIEW_LONG_EDGE = 237;

interface PreviewDims {
  nativeW: number;
  nativeH: number;
  scale:   number;
  /** Final on-screen width of the preview tile. */
  w:       number;
  /** Final on-screen height of the preview tile. */
  h:       number;
}

/** Compute scale + final on-screen size so the longer edge fits
 *  PREVIEW_LONG_EDGE while preserving aspect ratio. */
function dimsFor(nativeW: number, nativeH: number): PreviewDims {
  const longEdge = Math.max(nativeW, nativeH);
  const scale = PREVIEW_LONG_EDGE / longEdge;
  return {
    nativeW,
    nativeH,
    scale,
    w: Math.round(nativeW * scale),
    h: Math.round(nativeH * scale),
  };
}

// Native dimensions per card component. Sourced from each card file's
// CARD_W / CARD_H constants. Halo / Kill Team operative / Starcraft are
// landscape; Blood Bowl + Kill Team rule are portrait.
const HALO_DIMS           = dimsFor(1270, 890);
const BLOOD_BOWL_DIMS     = dimsFor(750, 1100);
const KILL_TEAM_DIMS      = dimsFor(1270, 890);
const KILL_TEAM_RULE_DIMS = dimsFor(700, 1200);
const STARCRAFT_DIMS      = dimsFor(1270, 890);

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
  dims,
  title,
  children,
  typeLabel = 'Card',
  onEdit,
  onDelete,
}: {
  dims:   PreviewDims;
  title?: string;
  children: React.ReactNode;
  /** Used in the menu item copy: "Delete {typeLabel}", "Edit {typeLabel}". */
  typeLabel?: string;
  onEdit?:   () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      // No overflow-hidden so the Dropdown panel can escape the tile.
      className="shrink-0 rounded-[6px] border border-gray-700 bg-gray-800"
      style={{ width: dims.w }}
    >
      {/* Card area — fixed height, clips the scaled-down native card.
          Has its own rounded-t so the top corners match the outer's
          rounded-[6px] without relying on the outer's overflow-hidden. */}
      <div
        className="overflow-hidden rounded-t-[6px]"
        style={{ height: dims.h }}
        title={title}
      >
        <div
          style={{
            width:           dims.nativeW,
            height:          dims.nativeH,
            transform:       `scale(${dims.scale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>

      {/* Footer band — card name (uppercase Space Grotesk Bold) + ⋯ */}
      <div className="flex items-center p-1">
        <p className="flex-1 min-w-0 truncate font-body font-bold text-xs leading-4 tracking-[1.2px] uppercase text-gray-300 px-1">
          {title ?? ''}
        </p>

        {(onEdit || onDelete) && (
          <Dropdown
            align="right"
            menuClassName="w-36"
            trigger={
              <button
                type="button"
                aria-label={`${typeLabel} options`}
                className="shrink-0 p-1 opacity-50 hover:opacity-100 transition-opacity text-gray-300 hover:text-white"
              >
                <MenuDots className="size-4" />
              </button>
            }
          >
            {onEdit && (
              <DropdownItem onClick={onEdit}>
                Edit {typeLabel}
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
        )}
      </div>
    </div>
  );
}

/** Per-card preview render — switches on game slug + card_type and
 *  delegates to the right shaper + card component. The caller-supplied
 *  onDelete is wired into PreviewTile's Dropdown so each card's
 *  ⋯ menu can request a delete confirmation. */
function renderPreview(
  c: CardWithJoins,
  gameSlug: string,
  onDelete: () => void,
): React.ReactNode {
  // Operative cards are called "Unit" in copy, rule cards "Rule Card".
  const typeLabel = c.card_type === 'rule' ? 'Rule Card' : 'Unit';

  const common = { key: c.id, title: c.name, typeLabel, onDelete };

  if (gameSlug === 'halo-flashpoint') {
    return (
      <PreviewTile {...common} dims={HALO_DIMS}>
        <HaloFlashpointCard
          {...dbRowsToHaloFlashpointProps(c as unknown as HaloCardDbRow)}
        />
      </PreviewTile>
    );
  }

  if (gameSlug === 'blood-bowl') {
    return (
      <PreviewTile {...common} dims={BLOOD_BOWL_DIMS}>
        <BloodBowlCard
          {...dbRowsToBloodBowlProps(c as unknown as BloodBowlCardDbRow)}
        />
      </PreviewTile>
    );
  }

  if (gameSlug === 'kill-team') {
    if (c.card_type === 'rule') {
      return (
        <PreviewTile {...common} dims={KILL_TEAM_RULE_DIMS}>
          <KillTeamRuleCard
            {...dbRowsToKillTeamRuleProps(c as unknown as KillTeamCardDbRow)}
          />
        </PreviewTile>
      );
    }
    return (
      <PreviewTile {...common} dims={KILL_TEAM_DIMS}>
        {/* Force the desktop (landscape) layout so the scale assumption
            holds — without this the card flips to a portrait mobile
            layout on narrow viewports. */}
        <KillTeamCard
          {...dbRowsToKillTeamProps(c as unknown as KillTeamCardDbRow)}
          forceLayout="desktop"
        />
      </PreviewTile>
    );
  }

  if (gameSlug === 'starcraft') {
    return (
      <PreviewTile {...common} dims={STARCRAFT_DIMS}>
        <StarcraftCard
          {...dbRowsToStarcraftProps(c as unknown as StarcraftCardDbRow)}
        />
      </PreviewTile>
    );
  }

  // Fallback for any future game that lands before its shaper does.
  // Uses PreviewTile so the footer chrome is consistent; the card area
  // shows a name placeholder instead of a real game card.
  return (
    <PreviewTile {...common} dims={HALO_DIMS}>
      <div
        className="flex items-center justify-center p-3 bg-gray-700"
        style={{ width: HALO_DIMS.nativeW, height: HALO_DIMS.nativeH }}
      >
        <p className="font-heading text-[80px] text-white text-center truncate">
          {c.name}
        </p>
      </div>
    </PreviewTile>
  );
}

function CardPreviewRow({
  cards,
  gameSlug,
  onDeleteCard,
}: {
  cards:    CardWithJoins[];
  gameSlug: string;
  /** Per-card delete request — opens the shared confirmation modal. */
  onDeleteCard: (card: CardWithJoins) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto">
      {cards.map(c => renderPreview(c, gameSlug, () => onDeleteCard(c)))}
    </div>
  );
}

/** Crude but readable subtitle for an addon row. The real subtitle would
 *  come from a per-game formatter (Halo formats weapons "Ranged, R5, AP 1");
 *  for v1 we list the stat values present, in stat-schema order. */
function addonSubtitle(addon: Addon, addonType: AddonType): string {
  const parts: string[] = [];
  for (const f of addonType.stat_schema) {
    const v = (addon.stats as Record<string, Json>)[f.key];
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
