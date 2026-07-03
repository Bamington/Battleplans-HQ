/**
 * AddToPackModal.tsx — Generic "Add X to Pack" picker
 *
 * Used by every "Add" button in the pack editor (Add Unit, Add Rule Card,
 * Add [Addon Type], Add Keyword). Lets the user either spin off a brand
 * new entity (via onCreateNew — currently stubbed by the caller) or pick
 * one or more existing entities from their other packs and copy them
 * into the current pack via the corresponding copy_*_to_pack RPC.
 *
 * Matches the Figma "Add Card to Pack" modal (node 919:13437).
 *
 * USAGE:
 *   <AddToPackModal
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     entityType="card"
 *     cardType="operative"
 *     gameId={pack.game_id}
 *     targetPackId={pack.id}
 *     title="Add Unit to Pack"
 *     description="Adding this card will also add all the addons and keywords associated with it to the pack."
 *     newButtonLabel="New Unit"
 *     onCreateNew={() => alert('New unit flow coming soon')}
 *     onAdded={count => { setOpen(false); reloadPack(); }}
 *   />
 *
 * PROPS:
 *   entityType    — 'card' | 'addon' | 'keyword'. Drives the table queried
 *                   and the RPC called on submit.
 *   cardType      — Required when entityType='card'. 'operative' | 'rule'.
 *   addonTypeId   — Required when entityType='addon'. Scopes the picker.
 *   gameId        — Must match the target pack's game.
 *   targetPackId  — The pack being edited. Excluded from the picker
 *                   (you can't copy from yourself).
 *   title / description / newButtonLabel — Display copy.
 *   onCreateNew   — Fired when the user clicks "New X" (modal stays open
 *                   so the caller can decide whether to close it before
 *                   opening a follow-up flow).
 *   onAdded(n)    — Fired after a successful copy; n is the count returned
 *                   by the RPC. Caller typically closes the modal and
 *                   reloads its panel data.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import SelectableListItem from './SelectableListItem';
import AddCircle from '../icons/AddCircle';
import AltArrowLeft  from '../icons/AltArrowLeft';
import AltArrowRight from '../icons/AltArrowRight';
import Magnifer from '../icons/Magnifer';
import { supabase } from '../lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

type EntityType = 'card' | 'addon' | 'keyword';
type CardType   = 'operative' | 'rule';

export interface AddToPackModalProps {
  open: boolean;
  onClose: () => void;

  entityType:   EntityType;
  cardType?:    CardType;
  addonTypeId?: string;
  gameId:       string;
  targetPackId: string;

  title:           string;
  description?:    string;
  newButtonLabel:  string;

  /** Builds the descriptive subtitle for ADDON rows (e.g. Halo weapons
   *  "Ranged, R5, AP 1"). The pack editor passes its stat-schema
   *  formatter here. Falls back to the addon's description when omitted.
   *  Keyword rows always use the keyword's description; card rows keep
   *  their source label. */
  getAddonSubtitle?: (row: {
    description?: string | null;
    stats?:       Record<string, unknown>;
  }) => string;

  /** When true, items already in the target pack are included in the
   *  picker list (labelled "This Pack") instead of being hidden. Use
   *  this when the goal is to attach existing pack items to a specific
   *  card rather than to copy new items into the pack. The fingerprint
   *  dedup still collapses identical rows from other sources so you
   *  never see the same item twice. */
  includeTargetPack?: boolean;

  /** When true, an "Add Portrait Image" button is shown in the rename
   *  step (single-card selections only). Caller sets this for games
   *  that support portrait images (all except StarCraft). */
  enablePortrait?:  boolean;

  onCreateNew:      () => void;
  onAdded:          (count: number) => void;
  /** Called after a successful copy with the resulting pack-scoped IDs
   *  (addon or keyword entity types only). Useful when the caller needs
   *  to attach the copied items to a specific card via card_addons /
   *  card_keywords immediately after the copy. */
  onAddedWithIds?:  (ids: string[]) => void;
  /** Called instead of onAdded when the user clicks "Add Portrait Image"
   *  in the rename step. Receives the new pack-scoped card ID and the
   *  final card name so the caller can open the portrait upload flow. */
  onAddedWithPortraitIntent?: (newCardId: string, cardName: string) => void;
}

interface PickerItem {
  id:       string;
  name:     string;
  /** Addon rows: the per-game stat string. Keyword rows: the keyword's
   *  description. Card rows: empty (source is shown in packLabel). */
  subtitle: string;
  /** Source label shown top-right: pack name, deck name, or "My Library". */
  packLabel?: string;
  /** Cards only: true when the source card has a portrait image. */
  hasPortrait?: boolean;
  /** Whether this item came from one of the user's packs ('pack') or
   *  from their personal library / decks ('library'). Used to drive the
   *  Packs / My Library tab filter. */
  source: 'pack' | 'library';
}

const RPC_NAME: Record<EntityType, string> = {
  card:    'copy_cards_to_pack',
  addon:   'copy_addons_to_pack',
  keyword: 'copy_keywords_to_pack',
};

/** Loose row shape covering the union of fields we read across the
 *  three entity tables. All fields are optional because Supabase
 *  returns table-specific shapes per select(). */
type Row = {
  id:           string;
  name:         string;
  description?: string | null;
  stats?:       Record<string, unknown>;
  card_type?:   string;
  addon_type_id?: string;
  params_schema?: unknown;
  extra?:         unknown;
  pack_id?:     string | null;
  deck_id?:     string | null;
  is_template?: boolean;
  card_images?: Array<{ file_path: string; image_type: string }> | null;
};

/** Build a content fingerprint for dedup. Items with identical
 *  fingerprints are treated as the same row, regardless of which
 *  source they came from. */
function fingerprint(row: Row, entityType: EntityType): string {
  switch (entityType) {
    case 'card':
      return JSON.stringify([row.name, row.card_type ?? '', row.stats ?? {}]);
    case 'addon':
      return JSON.stringify([
        row.name, row.description ?? '', row.addon_type_id ?? '', row.stats ?? {},
      ]);
    case 'keyword':
      return JSON.stringify([
        row.name, row.description ?? '', row.params_schema ?? [], row.extra ?? {},
      ]);
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AddToPackModal({
  open,
  onClose,
  entityType,
  cardType,
  addonTypeId,
  gameId,
  targetPackId,
  title,
  description,
  newButtonLabel,
  includeTargetPack = false,
  getAddonSubtitle,
  enablePortrait,
  onCreateNew,
  onAdded,
  onAddedWithIds,
  onAddedWithPortraitIntent,
}: AddToPackModalProps) {

  // ── State ──────────────────────────────────────────────────────────────

  const [items,    setItems]    = useState<PickerItem[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // IDs of items that already live in the target pack (populated when
  // includeTargetPack=true). These bypass the copy RPC at commit time.
  const samePackIds = useRef<Set<string>>(new Set());
  const [search,     setSearch]     = useState('');
  const [adding,     setAdding]     = useState(false);
  const [page,       setPage]       = useState(0);
  // 'pack' | 'library' — only active when both sources have items.
  const [tabFilter,  setTabFilter]  = useState<'pack' | 'library'>('pack');

  // Two-step modal: 'picker' shows the list to choose from, 'rename'
  // shows one editable name input per selected card before commit.
  // The rename step is only used for entityType='card'; addons and
  // keywords commit directly from 'picker'.
  const [step,           setStep]           = useState<'picker' | 'rename'>('picker');
  const [renameDrafts,   setRenameDrafts]   = useState<Record<string, string>>({});
  // Whether to copy portrait images alongside the card (only sent to the
  // card RPC when entityType='card'). Defaults to true.
  const [retainPortrait, setRetainPortrait] = useState(true);
  // Ref tracking whether the pending commit was triggered by "Add Portrait
  // Image" — if so we query for the new card ID and call
  // onAddedWithPortraitIntent rather than onAdded.
  const portraitIntentRef = useRef(false);

  // ── Fetch picker items each time the modal opens ───────────────────────
  // Source scope:
  //   - Cards: caller's other packs (same game) + caller's decks (same game) +
  //            caller's standalone templates (is_template=true, no pack/deck)
  //   - Addons: caller's other packs (same game) + caller's library addons
  //             (pack_id null, same game, same addon_type)
  //   - Keywords: caller's other packs (same game) + caller's library
  //               keywords (pack_id null, same game)
  // After loading, we content-fingerprint dedup against the target pack's
  // existing rows (so a copy that would land as a no-op is hidden) and
  // within the picker (so identical rows from multiple sources collapse
  // to a single visible option).

  useEffect(() => {
    if (!open) return;
    // Reset every open so the user gets a fresh list and no stale selection.
    setItems([]);
    setSelected(new Set());
    setStep('picker');
    setRenameDrafts({});
    setSearch('');
    setError(null);
    setRetainPortrait(true);
    setTabFilter('pack');
    portraitIntentRef.current = false;
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entityType, cardType, addonTypeId, gameId, targetPackId]);

  async function loadItems() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      // Per-entity-type select shapes — we pull the content fields needed
      // for the fingerprint, plus source FKs for the subtitle.
      const cardSelect    = 'id, name, card_type, stats, pack_id, deck_id, is_template, card_images(file_path, image_type)';
      const addonSelect   = 'id, name, description, stats, addon_type_id, pack_id';
      const keywordSelect = 'id, name, description, params_schema, extra, pack_id';

      // 1) Fetch all the source rows in parallel.
      const [
        ownPacksRes,
        ownDecksRes,
        packRowsRes,
        deckCardsRes,
        libraryRes,
        targetRowsRes,
      ] = await Promise.all([

        // a) Other packs the caller owns (excluding target). We need names
        //    too so we can label sources as "Pack: <name>".
        supabase
          .from('packs')
          .select('id, name')
          .eq('owner_user_id', user.id)
          .eq('game_id', gameId)
          .neq('id', targetPackId),

        // b) Caller's decks (same game). Cards use these for the source
        //    label; addons/keywords use them to resolve which deck a
        //    library row is used in (via the usage joins fetched below).
        supabase
          .from('decks')
          .select('id, name')
          .eq('user_id', user.id)
          .eq('game_id', gameId),

        // c) Entities in the caller's other packs (deferred filter — we
        //    don't know the source pack ids yet, so we fetch ALL and
        //    filter client-side once ownPacks resolves). Simpler than
        //    chaining two awaits.
        supabase
          .from(entityType === 'card' ? 'cards' : entityType === 'addon' ? 'addons' : 'keywords')
          .select(entityType === 'card' ? cardSelect : entityType === 'addon' ? addonSelect : keywordSelect)
          .not('pack_id', 'is', null)
          .eq(entityType === 'card' ? 'game_id'
               : entityType === 'addon' ? 'game_id'
               : 'game_id', gameId)
          .order('name'),

        // d) Cards-only: caller's deck cards (joined to deck for the name).
        entityType === 'card' && cardType
          ? supabase
              .from('cards')
              .select(`${cardSelect}, deck:decks!inner(id, name, user_id, game_id)`)
              .not('deck_id', 'is', null)
              .eq('card_type', cardType)
              .order('name')
          : Promise.resolve({ data: [] as Row[], error: null }),

        // e) Standalone user-owned rows (no pack, no deck). For cards that
        //    means is_template = true; for addons/keywords it's just the
        //    caller's personal library (pack_id null).
        entityType === 'card'
          ? (() => {
              let q = supabase
                .from('cards')
                .select(cardSelect)
                .eq('user_id', user.id)
                .eq('game_id', gameId)
                .eq('is_template', true)
                .is('pack_id', null)
                .is('deck_id', null);
              if (cardType) q = q.eq('card_type', cardType);
              return q.order('name');
            })()

          : supabase
              .from(entityType === 'addon' ? 'addons' : 'keywords')
              .select(entityType === 'addon' ? addonSelect : keywordSelect)
              .eq('user_id', user.id)
              .eq('game_id', gameId)
              .is('pack_id', null)
              .order('name'),

        // f) Target pack's existing rows — used for content-fingerprint
        //    dedup. We only need the fingerprint fields, but reuse the
        //    full select for brevity.
        supabase
          .from(entityType === 'card' ? 'cards' : entityType === 'addon' ? 'addons' : 'keywords')
          .select(entityType === 'card' ? cardSelect : entityType === 'addon' ? addonSelect : keywordSelect)
          .eq('pack_id', targetPackId),
      ]);

      const ownPackMap = new Map(
        ((ownPacksRes.data ?? []) as { id: string; name: string }[]).map(p => [p.id, p.name]),
      );
      // When showing same-pack items (card-form context), inject the target
      // pack into the map so packRows doesn't filter its items out.
      samePackIds.current = new Set();
      if (includeTargetPack) ownPackMap.set(targetPackId, 'This Pack');
      const ownDeckMap = new Map(
        ((ownDecksRes.data ?? []) as { id: string; name: string }[]).map(d => [d.id, d.name]),
      );

      // Supabase's TS parser doesn't fully resolve the dynamic select
      // strings above (mixed table/column unions), so we cast each
      // response through unknown. The runtime shape matches Row.
      const packRowsAll = (packRowsRes.data ?? []) as unknown as Row[];
      const packRows = packRowsAll
        .filter(r => r.pack_id && ownPackMap.has(r.pack_id))
        .filter(r => entityType !== 'card'  || !cardType    || r.card_type === cardType)
        .filter(r => entityType !== 'addon' || !addonTypeId || r.addon_type_id === addonTypeId);

      // Deck cards arrive with a nested `deck` for the source label. Filter
      // to decks the user actually owns (the inner join already does the
      // ownership check, but be defensive).
      const deckCardsRaw = (deckCardsRes.data ?? []) as unknown as (Row & {
        deck?: { id: string; name: string } | { id: string; name: string }[];
      })[];
      const deckRows: Row[] = [];
      for (const r of deckCardsRaw) {
        const deck = Array.isArray(r.deck) ? r.deck[0] : r.deck;
        if (!deck || !ownDeckMap.has(deck.id)) continue;
        deckRows.push({ ...r, deck_id: deck.id });
      }

      const libraryRows = ((libraryRes.data ?? []) as unknown as Row[])
        .filter(r => entityType !== 'card'  || !cardType    || r.card_type === cardType)
        .filter(r => entityType !== 'addon' || !addonTypeId || r.addon_type_id === addonTypeId);

      // ── Resolve a concrete source for library addons/keywords ──────────
      // Library rows have no deck of their own — they're user-scoped —
      // but the user thinks of them as belonging to the deck where
      // they're used. Walk the usage joins to find that deck: addons via
      // card_addons; keywords via card_keywords (attached to a card
      // directly) or addon_keywords → card_addons (attached to a weapon/
      // ability). An item used in several decks gets the first deck
      // found; an unused item falls back to "My Library".
      const libraryDeckName = new Map<string, string>(); // row id → deck name
      if (entityType !== 'card' && libraryRows.length > 0) {
        // NOTE: deck cards carry a NULL game_id (the deck owns the game),
        // so don't filter on it here — ownDeckMap is already scoped to
        // this game and user, and the client-side filter below applies it.
        const { data: deckCards } = await supabase
          .from('cards')
          .select('id, deck_id')
          .not('deck_id', 'is', null);
        const cardDeck = new Map(
          ((deckCards ?? []) as { id: string; deck_id: string }[])
            .filter(c => ownDeckMap.has(c.deck_id))
            .map(c => [c.id, c.deck_id]),
        );

        const claim = (rowId: string, cardId: string) => {
          if (libraryDeckName.has(rowId)) return;
          const deckId = cardDeck.get(cardId);
          if (deckId) libraryDeckName.set(rowId, ownDeckMap.get(deckId)!);
        };

        if (entityType === 'addon') {
          const { data: ca } = await supabase
            .from('card_addons')
            .select('card_id, addon_id');
          for (const j of (ca ?? []) as { card_id: string; addon_id: string }[]) {
            claim(j.addon_id, j.card_id);
          }
        } else {
          const [ckRes, akRes, caRes] = await Promise.all([
            supabase.from('card_keywords').select('card_id, keyword_id'),
            supabase.from('addon_keywords').select('addon_id, keyword_id'),
            supabase.from('card_addons').select('card_id, addon_id'),
          ]);
          for (const j of (ckRes.data ?? []) as { card_id: string; keyword_id: string }[]) {
            claim(j.keyword_id, j.card_id);
          }
          // keyword → addon → card → deck
          const addonCard = new Map(
            ((caRes.data ?? []) as { card_id: string; addon_id: string }[])
              .filter(j => cardDeck.has(j.card_id))
              .map(j => [j.addon_id, j.card_id]),
          );
          for (const j of (akRes.data ?? []) as { addon_id: string; keyword_id: string }[]) {
            const cardId = addonCard.get(j.addon_id);
            if (cardId) claim(j.keyword_id, cardId);
          }
        }
      }

      // ── Build the unified picker list ───────────────────────────────────
      // Cards keep the original layout (plain name, source as subtitle).
      // Addons/keywords show "Name (source)" as the title and descriptive
      // content as the subtitle.
      const sourceFor = (r: Row): string => {
        if (r.pack_id && ownPackMap.has(r.pack_id)) return ownPackMap.get(r.pack_id)!;
        return libraryDeckName.get(r.id) ?? 'My Library';
      };
      const contentSubtitle = (r: Row): string => {
        if (entityType === 'keyword') return r.description ?? '';
        return getAddonSubtitle?.(r) ?? r.description ?? '';
      };

      const cardPackLabelFor = (r: Row): string => {
        if (r.pack_id && ownPackMap.has(r.pack_id)) return ownPackMap.get(r.pack_id)!;
        if (r.deck_id && ownDeckMap.has(r.deck_id)) return ownDeckMap.get(r.deck_id)!;
        return 'My Templates';
      };

      const candidates: { row: Row; pick: PickerItem }[] = [];
      const pushAll = (rows: Row[], source: 'pack' | 'library') => {
        for (const r of rows) {
          candidates.push({
            row: r,
            pick: entityType === 'card'
              ? {
                  id: r.id,
                  name: r.name,
                  subtitle: '',
                  packLabel: cardPackLabelFor(r),
                  hasPortrait: Boolean(r.card_images?.some(ci => ci.image_type === 'portrait')),
                  source,
                }
              : { id: r.id, name: r.name, subtitle: contentSubtitle(r), packLabel: sourceFor(r), source },
          });
        }
      };
      // Push target-pack rows before other-pack rows so they always win
      // the fingerprint dedup. Without this, a same-fingerprint item from
      // another pack can crowd out the current pack's version.
      const targetPackRows = packRows.filter(r => r.pack_id === targetPackId);
      const otherPackRows  = packRows.filter(r => r.pack_id !== targetPackId);
      pushAll(targetPackRows, 'pack');
      // Record which items can bypass the copy RPC at commit time.
      // In the card-form context (includeTargetPack=true) we're attaching
      // existing items to a card, not importing from elsewhere, so:
      //   • target-pack items  — already in the pack, use ID directly
      //   • library items      — user-owned, no pack scope conflict;
      //                          attach directly via card_addons/card_keywords
      // Items from OTHER packs still go through the copy RPC so they get
      // cloned into the target pack first.
      if (includeTargetPack) {
        for (const r of targetPackRows) samePackIds.current.add(r.id);
      }
      pushAll(otherPackRows, 'pack');
      pushAll(deckRows,      'library');
      pushAll(libraryRows,   'library');
      if (includeTargetPack) {
        for (const r of libraryRows) samePackIds.current.add(r.id);
      }

      // Content-fingerprint dedup: skip any candidate whose fingerprint
      // already exists in the target pack OR has already been added to
      // the picker (collapses identical rows from multiple sources).
      // When includeTargetPack is true, don't pre-seed from target-pack
      // rows — we WANT those to show up; the per-candidate dedup still
      // collapses identical rows from other sources.
      const seen = new Set<string>(
        includeTargetPack
          ? []
          : ((targetRowsRes.data ?? []) as unknown as Row[]).map(r => fingerprint(r, entityType)),
      );
      const final: PickerItem[] = [];
      for (const { row, pick } of candidates) {
        const fp = fingerprint(row, entityType);
        if (seen.has(fp)) continue;
        seen.add(fp);
        final.push(pick);
      }
      // Stable sort by name (most queries already do this, but the merge
      // can interleave sources out of order).
      final.sort((a, b) => a.name.localeCompare(b.name));

      setItems(final);
    } catch (e) {
      setError(
        (e as { message?: string })?.message
          ?? 'Failed to load the picker. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────

  const hasPackItems    = useMemo(() => items.some(i => i.source === 'pack'),    [items]);
  const hasLibraryItems = useMemo(() => items.some(i => i.source === 'library'), [items]);
  const showTabs        = hasPackItems && hasLibraryItems;

  const filtered = useMemo(() => {
    let list = showTabs ? items.filter(i => i.source === tabFilter) : items;
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(i => i.name.toLowerCase().includes(q));
  }, [items, search, showTabs, tabFilter]);

  const PAGE_SIZE   = 5;
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage    = Math.min(page, totalPages - 1);
  const paginated   = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Reset to first page whenever the filtered list changes.
  useEffect(() => { setPage(0); }, [filtered]);

  const canSubmit = selected.size > 0 && !adding;

  // ── Handlers ───────────────────────────────────────────────────────────

  function toggle(id: string, isChecked: boolean) {
    setSelected(prev => {
      const next = new Set(prev);
      if (isChecked) next.add(id);
      else           next.delete(id);
      return next;
    });
  }

  // Selected items in their `items` order — used by the rename step.
  const selectedItems = useMemo(
    () => items.filter(i => selected.has(i.id)),
    [items, selected],
  );

  /** Footer CTA from the picker step:
   *   - Cards: advance to rename step (pre-populate drafts from source names)
   *   - Addons / keywords: commit directly via the RPC
   */
  async function handleSubmit() {
    if (!canSubmit) return;

    if (entityType === 'card') {
      const drafts: Record<string, string> = {};
      for (const it of selectedItems) drafts[it.id] = it.name;
      setRenameDrafts(drafts);
      setStep('rename');
      setError(null);
      return;
    }

    await commit(undefined);
  }

  /** Footer CTA from the rename step: commit with the user's edited names
   *  packed into the RPC's p_card_overrides param. */
  async function handleCommitRenames() {
    for (const it of selectedItems) {
      if (!(renameDrafts[it.id] ?? '').trim()) return;
    }
    const overrides: Record<string, { name: string }> = {};
    for (const it of selectedItems) {
      overrides[it.id] = { name: renameDrafts[it.id].trim() };
    }
    portraitIntentRef.current = false;
    await commit(overrides);
  }

  /** "Add Portrait Image" button in rename step: same as handleCommitRenames
   *  but flags portrait intent so commit() calls onAddedWithPortraitIntent
   *  with the new card ID instead of onAdded. */
  const handleCommitWithPortrait = useCallback(async () => {
    if (selectedItems.length !== 1) return;
    const [it] = selectedItems;
    if (!(renameDrafts[it.id] ?? '').trim()) return;
    portraitIntentRef.current = true;
    await commit({ [it.id]: { name: renameDrafts[it.id].trim() } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItems, renameDrafts]);

  /** Shared submit path. `overrides` is only sent for the card RPC. */
  async function commit(overrides: Record<string, { name: string }> | undefined) {
    setAdding(true);
    setError(null);

    const selectedArr = Array.from(selected);

    const directIds  = selectedArr.filter(id =>  samePackIds.current.has(id));
    const copyIds    = selectedArr.filter(id => !samePackIds.current.has(id));
    const rpcIds = entityType === 'card' ? selectedArr : copyIds;

    let resultIds: string[] = [...directIds];

    if (rpcIds.length > 0) {
      const args: Record<string, unknown> = {
        p_target_pack_id: targetPackId,
        p_source_ids:     rpcIds,
      };
      if (entityType === 'card' && overrides) {
        args.p_card_overrides = overrides;
      }
      if (entityType === 'card') {
        args.p_retain_portraits = retainPortrait;
      }

      const { data, error: rpcErr } = await supabase.rpc(RPC_NAME[entityType], args);

      setAdding(false);

      if (rpcErr) {
        setError("Couldn't add the selected items. Please try again.");
        return;
      }

      if (entityType === 'card') {
        // Portrait intent: query for the new card's ID then hand off to caller.
        if (portraitIntentRef.current && onAddedWithPortraitIntent && selectedArr.length === 1) {
          const overrideName = overrides?.[selectedArr[0]]?.name ?? '';
          const { data: newCards } = await supabase
            .from('cards')
            .select('id')
            .eq('pack_id', targetPackId)
            .eq('name', overrideName)
            .order('created_at', { ascending: false })
            .limit(1);
          const newCardId = (newCards as Array<{ id: string }> | null)?.[0]?.id;
          if (newCardId) {
            onAddedWithPortraitIntent(newCardId, overrideName);
            return;
          }
        }
        onAdded(Number(data ?? selected.size));
        return;
      }

      // Both RPCs now return uuid[] (the target-pack IDs, new or reused).
      // Fall back to a name-lookup for older DB versions that still return
      // an integer count.
      if (Array.isArray(data) && (data as unknown[]).length > 0) {
        resultIds = [...resultIds, ...(data as string[])];
      } else if (entityType === 'keyword') {
        // Fallback: resolve keyword IDs by name in target pack.
        const { data: srcKws } = await supabase
          .from('keywords').select('name').in('id', rpcIds);
        const names = (srcKws ?? []).map((k: { name: string }) => k.name);
        if (names.length > 0) {
          const { data: tgtKws } = await supabase
            .from('keywords').select('id')
            .eq('pack_id', targetPackId).in('name', names);
          resultIds = [...resultIds, ...(tgtKws ?? []).map((k: { id: string }) => k.id)];
        }
      } else {
        // Fallback: resolve addon IDs by (name, addon_type_id) in target pack.
        const { data: srcMeta } = await supabase
          .from('addons').select('name, addon_type_id').in('id', rpcIds);
        const srcEntries = (srcMeta ?? []) as { name: string; addon_type_id: string }[];
        if (srcEntries.length > 0) {
          const names = [...new Set(srcEntries.map(a => a.name))];
          const { data: tgtMatches } = await supabase
            .from('addons').select('id, name, addon_type_id')
            .eq('pack_id', targetPackId).in('name', names);
          const tgtRows = (tgtMatches ?? []) as { id: string; name: string; addon_type_id: string }[];
          for (const src of srcEntries) {
            const match = tgtRows.find(t => t.name === src.name && t.addon_type_id === src.addon_type_id);
            if (match && !resultIds.includes(match.id)) resultIds.push(match.id);
          }
        }
      }
    } else {
      setAdding(false);
    }

    onAddedWithIds?.(resultIds);
    onAdded(resultIds.length);
  }

  // True only on the rename step when every input has trimmed content.
  const renamesValid = selectedItems.every(
    i => (renameDrafts[i.id] ?? '').trim().length > 0,
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Modal open={open} onClose={() => !adding && onClose()}>
      <div className="flex flex-col gap-3 p-5">

        <h2 className="font-heading text-xl text-white">{title}</h2>

        {step === 'picker' ? (

          // ── Step 1: pick existing entities ─────────────────────────────
          <>
            {description && (
              <p className="font-body text-base text-gray-300">{description}</p>
            )}

            {/* "New X" button — full width, outlined. Calling code handles
                the actual create flow (currently stubbed). */}
            <Button
              variant="outline"
              color="primary"
              className="w-full"
              leftIcon={<AddCircle className="size-4" />}
              onClick={onCreateNew}
            >
              {newButtonLabel}
            </Button>

            {/* OR divider. HR's "text" variant has my-8 baked in which is
                too much for a modal — render the same visual inline. */}
            <div className="flex items-center gap-3 py-1">
              <hr className="flex-1 h-px border-0 bg-gray-700" />
              <span className="font-body text-xs font-medium text-gray-400 uppercase tracking-wider">
                or
              </span>
              <hr className="flex-1 h-px border-0 bg-gray-700" />
            </div>

            {/* Source tabs — only shown when both packs and library have items */}
            {showTabs && (
              <div className="flex">
                {(['pack', 'library'] as const).map((tab, idx) => (
                  <button
                    key={tab}
                    type="button"
                    disabled={adding}
                    onClick={() => {
                      setTabFilter(tab);
                      setPage(0);
                      setSelected(new Set());
                    }}
                    className={[
                      'flex-1 font-body text-sm font-medium px-4 py-2.5 text-center transition-colors',
                      idx === 0 ? 'rounded-l-lg' : 'rounded-r-lg',
                      tabFilter === tab
                        ? 'bg-blue-600 text-white'
                        : 'border border-blue-500 text-blue-500',
                    ].join(' ')}
                  >
                    {tab === 'pack' ? 'From Packs' : 'Your Content'}
                  </button>
                ))}
              </div>
            )}

            {/* Search — purely client-side filter over the loaded list. */}
            <Input
              placeholder={`Search ${title.replace(/^Add /, '').replace(/ to Pack$/, '').toLowerCase()}s`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              leftIcon={<Magnifer className="size-4" />}
              disabled={loading || adding}
            />

            {/* Picker list — paginated to 5 items */}
            <div className="flex flex-col gap-1.5">
              {loading ? (
                <p className="font-body text-sm text-gray-400 text-center py-6">
                  Loading…
                </p>
              ) : filtered.length === 0 ? (
                <p className="font-body text-sm text-gray-400 text-center py-6">
                  {items.length === 0
                    ? (includeTargetPack
                        ? `No ${title.replace(/^Add /, '').toLowerCase()}s available yet.`
                        : "Nothing in your other packs to copy from yet.")
                    : "No matches."}
                </p>
              ) : (
                paginated.map(item => (
                  <SelectableListItem
                    key={item.id}
                    name={item.name}
                    subtitle={item.subtitle || undefined}
                    packLabel={item.packLabel}
                    checked={selected.has(item.id)}
                    onCheckedChange={c => toggle(item.id, c)}
                    disabled={adding}
                  />
                ))
              )}
            </div>

            {/* Pagination controls — only shown when the list spans multiple pages */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  color="secondary"
                  size="sm"
                  leftIcon={<AltArrowLeft className="size-4" />}
                  disabled={safePage === 0 || adding}
                  onClick={() => setPage(p => p - 1)}
                >
                  Prev
                </Button>
                <span className="font-body text-xs text-gray-400">
                  {safePage + 1} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  color="secondary"
                  size="sm"
                  rightIcon={<AltArrowRight className="size-4" />}
                  disabled={safePage >= totalPages - 1 || adding}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}

            {error && (
              <p className="font-body text-sm text-red-400">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                color="danger"
                disabled={adding}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                disabled={!canSubmit}
                loading={adding && entityType !== 'card'}
                rightIcon={<AltArrowRight className="size-4" />}
                onClick={handleSubmit}
              >
                Add Selected
              </Button>
            </div>
          </>

        ) : (

          // ── Step 2: review names before commit (cards only) ────────────
          <>
            <p className="font-body text-base text-gray-300">
              {selectedItems.length === 1
                ? `Update this ${cardType === 'rule' ? 'card' : 'unit'}'s name to be generic before adding it to the pack.`
                : `Update each name to be generic before adding to the pack.`}
            </p>

            <div className="flex flex-col gap-3 max-h-[280px] overflow-y-auto">
              {selectedItems.map((item, idx) => (
                <Input
                  key={item.id}
                  label={selectedItems.length === 1
                    ? (cardType === 'rule' ? 'Card Name' : 'Unit Name')
                    : `${cardType === 'rule' ? 'Card' : 'Unit'} ${idx + 1} Name`}
                  required
                  value={renameDrafts[item.id] ?? ''}
                  onChange={e => setRenameDrafts(prev => ({
                    ...prev, [item.id]: e.target.value,
                  }))}
                  maxLength={99}
                  disabled={adding}
                  autoFocus={idx === 0}
                />
              ))}
            </div>

            {selectedItems.some(i => i.hasPortrait) && (
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={retainPortrait}
                  onChange={e => setRetainPortrait(e.target.checked)}
                  disabled={adding}
                  className="w-4 h-4 accent-blue-500 shrink-0"
                />
                <span className="font-body text-sm text-gray-300">Retain portrait image</span>
              </label>
            )}

            {error && (
              <p className="font-body text-sm text-red-400">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                color="danger"
                disabled={adding}
                onClick={onClose}
              >
                Cancel
              </Button>
              {enablePortrait && selectedItems.length === 1 && (
                <Button
                  variant="outline"
                  color="primary"
                  disabled={!renamesValid || adding}
                  onClick={handleCommitWithPortrait}
                >
                  Add Portrait Image
                </Button>
              )}
              <Button
                disabled={!renamesValid || adding}
                loading={adding}
                rightIcon={<AltArrowRight className="size-4" />}
                onClick={handleCommitRenames}
              >
                Add to Pack
              </Button>
            </div>
          </>

        )}

      </div>
    </Modal>
  );
}
