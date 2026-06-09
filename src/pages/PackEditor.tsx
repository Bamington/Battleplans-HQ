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
import AltArrowLeft from '../icons/AltArrowLeft';
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
                <CardPreviewRow cards={operativeCards} gameSlug={pack.game.slug} />
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
                  <CardPreviewRow cards={ruleCards} gameSlug={pack.game.slug} />
                )}
              </PackPanel>
            )}

            {/* Addon + Keyword panels in a responsive 2-col grid.
                Kill Team has 2 addon types → 3 panels total (Weapons,
                Abilities, Keywords) and the third wraps onto a new row. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {addonTypes.map(at => {
                const singular = singularise(at.name);
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
                              onEdit={() => stubNotImplemented(`Edit ${singular}`)}
                              onDelete={() => stubNotImplemented(`Delete ${singular}`)}
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
                        onEdit={() => stubNotImplemented('Edit Keyword')}
                        onDelete={() => stubNotImplemented('Delete Keyword')}
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

/** Shared wrapper that draws the card-shaped bounding box and applies
 *  the CSS transform that scales the native-size card into the tile. */
function PreviewTile({
  dims,
  title,
  children,
}: {
  dims:   PreviewDims;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="shrink-0 rounded-lg border border-gray-700 overflow-hidden bg-gray-950"
      style={{ width: dims.w, height: dims.h }}
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
  );
}

/** Per-card preview render — switches on game slug + card_type and
 *  delegates to the right shaper + card component. */
function renderPreview(c: CardWithJoins, gameSlug: string): React.ReactNode {
  if (gameSlug === 'halo-flashpoint') {
    return (
      <PreviewTile key={c.id} dims={HALO_DIMS} title={c.name}>
        <HaloFlashpointCard
          {...dbRowsToHaloFlashpointProps(c as unknown as HaloCardDbRow)}
        />
      </PreviewTile>
    );
  }

  if (gameSlug === 'blood-bowl') {
    return (
      <PreviewTile key={c.id} dims={BLOOD_BOWL_DIMS} title={c.name}>
        <BloodBowlCard
          {...dbRowsToBloodBowlProps(c as unknown as BloodBowlCardDbRow)}
        />
      </PreviewTile>
    );
  }

  if (gameSlug === 'kill-team') {
    if (c.card_type === 'rule') {
      return (
        <PreviewTile key={c.id} dims={KILL_TEAM_RULE_DIMS} title={c.name}>
          <KillTeamRuleCard
            {...dbRowsToKillTeamRuleProps(c as unknown as KillTeamCardDbRow)}
          />
        </PreviewTile>
      );
    }
    return (
      <PreviewTile key={c.id} dims={KILL_TEAM_DIMS} title={c.name}>
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
      <PreviewTile key={c.id} dims={STARCRAFT_DIMS} title={c.name}>
        <StarcraftCard
          {...dbRowsToStarcraftProps(c as unknown as StarcraftCardDbRow)}
        />
      </PreviewTile>
    );
  }

  // Fallback for any future game that lands before its shaper does.
  return (
    <div
      key={c.id}
      className="shrink-0 rounded-lg border border-gray-700 bg-gray-800 flex items-center justify-center p-3"
      style={{ width: HALO_DIMS.w, height: HALO_DIMS.h }}
    >
      <p className="font-heading text-base text-white text-center truncate">
        {c.name}
      </p>
    </div>
  );
}

function CardPreviewRow({
  cards,
  gameSlug,
}: {
  cards:    CardWithJoins[];
  gameSlug: string;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto">
      {cards.map(c => renderPreview(c, gameSlug))}
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
