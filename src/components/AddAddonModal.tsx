/**
 * AddAddonModal.tsx — Two-step wizard for adding addons to a card
 *
 * STEP 1 (pick): Shows existing eligible addons with pagination.
 *   If there are no eligible addons, skips directly to step 2.
 *   The user can select an existing addon and click "Add this {type}",
 *   or click "Create New {type}" to go to step 2.
 *   The ⋯ menu on each item allows Edit (→ step 2 pre-filled) or Delete.
 *
 * STEP 2 (create / edit): Renders the game-specific form supplied by the
 *   caller via the `CreateFormComponent` prop. On save:
 *   - Creating: inserts the addon into the DB, calls onAdd, closes.
 *   - Editing:  updates the addon in the DB, returns to the picker.
 *
 * USAGE:
 *   <AddAddonModal
 *     open={modalOpen}
 *     onClose={() => setModalOpen(false)}
 *     gameSlug="halo-flashpoint"
 *     addonTypeSlug="weapons"
 *     addonTypeName="Weapon"
 *     excludeAddonIds={activeCard.weapons.map(w => w.addonId)}
 *     onAdd={addon => attachWeapon(addon)}
 *     onDeleted={addonId => detachWeapon(addonId)}
 *     getSubtitle={addon => buildWeaponSubtitle(addon)}
 *     CreateFormComponent={HaloWeaponForm}
 *   />
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Modal from './Modal';
import AddonListItem from './AddonListItem';
import Button from './Button';
import Input from './Input';
import AddCircle from '../icons/AddCircle';
import Magnifer from '../icons/Magnifer';
import CheckCircle from '../icons/CheckCircle';
import AltArrowLeft from '../icons/AltArrowLeft';
import AltArrowRight from '../icons/AltArrowRight';
import Lock from '../icons/Lock';
import { supabase } from '../lib/supabase';
import type { Addon, AddonPrerequisites } from '../lib/database.types';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Props passed into the game-specific create/edit form component */
export interface AddonFormProps {
  /** The addon being edited, or null when creating a new one */
  editingAddon: Addon | null;
  /** Call this to persist the addon (insert or update). Returns the addon ID. */
  onSave: (
    name: string,
    description: string | null,
    stats: Record<string, unknown>,
  ) => Promise<string>;
  /** Call this to go back (to picker if available, otherwise closes the modal) */
  onCancel: () => void;
  /** True while the save request is in flight */
  saving: boolean;
}

export interface AddAddonModalProps {
  open: boolean;
  onClose: () => void;
  /** Slug of the game — used to look up the addon_type in Supabase */
  gameSlug: string;
  /** Slug of the addon type (e.g. "weapons", "skills") */
  addonTypeSlug: string;
  /** Human label used in button text, e.g. "Weapon" or "Skill" */
  addonTypeName: string;
  /** IDs of addons already attached to this card — excluded from the picker list */
  excludeAddonIds?: string[];
  /**
   * Context used to evaluate prerequisites. Each entry describes an addon
   * already on the card: its addonId, type slug, and the params stored in card_addons.
   * Addons whose prerequisites are not met are shown greyed-out.
   */
  prerequisiteContext?: Array<{ addonId: string; name?: string; typeSlug: string; params?: Record<string, string[]> }>;
  /**
   * When true, fetch all addons in one batch and sort those whose prerequisites
   * are met to the top of the list (client-side). Requires prerequisiteContext.
   */
  prioritiseByPrerequisites?: boolean;
  /** Called when an addon is attached to the card (new or existing) */
  onAdd: (addon: Addon) => void;
  /** Called when an addon is deleted from the user's library */
  onDeleted: (addonId: string) => void;
  /** Returns the subtitle shown under the addon name in the picker list */
  getSubtitle: (addon: Addon) => string;
  /** Game-specific form component rendered in the create/edit step */
  CreateFormComponent: React.ComponentType<AddonFormProps>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 5;

type Step = 'loading' | 'pick' | 'create' | 'edit';

// ── Component ─────────────────────────────────────────────────────────────────

/** Returns true if all prerequisite rules are met by the given card addons. */
function meetsPrerequisites(
  addon: Addon,
  context: Array<{ addonId: string; typeSlug: string; name?: string; params?: Record<string, string[]> }>,
): boolean {
  const prereqs = addon.prerequisites as AddonPrerequisites | null;
  if (!prereqs || prereqs.items.length === 0) return true;

  const check = (item: AddonPrerequisites['items'][number]) => {
    return context.some(ca => {
      // Match by addonId, or fall back to name when IDs differ (e.g. pack copy vs library original)
      const idMatch   = ca.addonId === item.addonId;
      const nameMatch = !!ca.name && ca.name === item.name;
      if (!idMatch && !nameMatch) return false;
      // If the prerequisite specifies params, they must match
      const requiredParams = Object.entries(item.params);
      if (requiredParams.length === 0) return true;
      return requiredParams.every(([key, vals]) =>
        vals.length === 0 || (ca.params?.[key] ?? []).some(v => vals.includes(v)),
      );
    });
  };

  return prereqs.requireAll
    ? prereqs.items.every(check)
    : prereqs.items.some(check);
}

const AddAddonModal = ({
  open,
  onClose,
  gameSlug,
  addonTypeSlug,
  addonTypeName,
  excludeAddonIds = [],
  prerequisiteContext = [],
  prioritiseByPrerequisites = false,
  onAdd,
  onDeleted,
  getSubtitle,
  CreateFormComponent,
}: AddAddonModalProps) => {
  const [step, setStep]                 = useState<Step>('loading');
  const [addons, setAddons]             = useState<Addon[]>([]);
  const [totalCount, setTotalCount]     = useState(0);
  const [page, setPage]                 = useState(0);
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null);
  const [saving, setSaving]             = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [unfilteredCount, setUnfilteredCount] = useState(0);
  // Source tabs: 'pack' = addons in a pack, 'library' = personal library.
  // null = show all (tabs are hidden when only one source has items).
  const [tabFilter,   setTabFilter]   = useState<'pack' | 'library' | null>(null);
  const [packCount,   setPackCount]   = useState(0);
  const [libraryCount, setLibraryCount] = useState(0);

  // Resolved Supabase IDs — stored in refs so fetchPage can always read
  // the latest value without being included in effect dependencies.
  const addonTypeIdRef         = useRef<string | null>(null);
  const userIdRef              = useRef<string | null>(null);
  const excludeRef             = useRef(excludeAddonIds);
  const openRef                = useRef(open);
  const tabFilterRef           = useRef<'pack' | 'library' | null>(null);
  const packNameMapRef         = useRef<Map<string, string>>(new Map());
  const prerequisiteContextRef = useRef(prerequisiteContext);
  const clientModeRef          = useRef(prioritiseByPrerequisites);
  // Holds all sorted addons when in client-side pagination mode.
  const sortedAllRef           = useRef<Addon[]>([]);

  useEffect(() => { excludeRef.current            = excludeAddonIds;            }, [excludeAddonIds]);
  useEffect(() => { openRef.current               = open;                       }, [open]);
  useEffect(() => { tabFilterRef.current          = tabFilter;                  }, [tabFilter]);
  useEffect(() => { prerequisiteContextRef.current = prerequisiteContext;        }, [prerequisiteContext]);
  useEffect(() => { clientModeRef.current          = prioritiseByPrerequisites;  }, [prioritiseByPrerequisites]);

  // ── Fetch a page of eligible addons ───────────────────────────────────────

  const fetchPage = useCallback(async (p: number, search = '') => {
    const addonTypeId = addonTypeIdRef.current;
    const userId      = userIdRef.current;
    if (!addonTypeId || !userId) return;

    const excluded = excludeRef.current;
    const tf = tabFilterRef.current;

    // ── Client-side pagination mode (prioritiseByPrerequisites) ───────────────
    if (clientModeRef.current) {
      let query = supabase
        .from('addons')
        .select('*')
        .eq('user_id', userId)
        .eq('addon_type_id', addonTypeId)
        .order('name');
      if (excluded.length > 0) query = query.not('id', 'in', `(${excluded.join(',')})`);
      if (tf === 'pack')    query = query.not('pack_id', 'is', null);
      if (tf === 'library') query = query.is('pack_id', null);

      let unfilteredQuery = supabase
        .from('addons')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('addon_type_id', addonTypeId);
      if (excluded.length > 0) unfilteredQuery = unfilteredQuery.not('id', 'in', `(${excluded.join(',')})`);

      const [res, unfilteredRes] = await Promise.all([query, unfilteredQuery]);
      if (!openRef.current) return;
      if (res.error) { console.error('[AddAddonModal] fetch error:', res.error); return; }

      const ctx = prerequisiteContextRef.current;
      const all = (res.data as Addon[]) ?? [];
      const sorted = [
        ...all.filter(a => meetsPrerequisites(a, ctx)),
        ...all.filter(a => !meetsPrerequisites(a, ctx)),
      ];
      sortedAllRef.current = sorted;
      setUnfilteredCount(unfilteredRes.count ?? 0);
      setTotalCount(sorted.length);
      setAddons(sorted.slice(0, PAGE_SIZE));
      setStep(sorted.length === 0 ? 'create' : 'pick');
      return;
    }

    // ── Server-side pagination mode (default) ─────────────────────────────────
    let query = supabase
      .from('addons')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('addon_type_id', addonTypeId)
      .order('name')
      .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1);

    if (excluded.length > 0) {
      query = query.not('id', 'in', `(${excluded.join(',')})`);
    }
    if (search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`);
    }
    if (tf === 'pack')    query = query.not('pack_id', 'is', null);
    if (tf === 'library') query = query.is('pack_id', null);

    // Also fetch unfiltered count (all items, no tab/search filter) to decide
    // whether to show the search bar.
    let unfilteredQuery = supabase
      .from('addons')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('addon_type_id', addonTypeId);
    if (excluded.length > 0) {
      unfilteredQuery = unfilteredQuery.not('id', 'in', `(${excluded.join(',')})`);
    }

    const [filtered, unfiltered] = await Promise.all([query, unfilteredQuery]);
    if (!openRef.current) return;
    if (filtered.error) { console.error('[AddAddonModal] fetch error:', filtered.error); return; }

    const total = filtered.count ?? 0;
    setAddons((filtered.data as Addon[]) ?? []);
    setTotalCount(total);
    setUnfilteredCount(unfiltered.count ?? 0);
    setStep(total === 0 && !search.trim() ? 'create' : 'pick');
  }, []);

  // ── Initialise when modal opens ────────────────────────────────────────────

  useEffect(() => {
    if (!open) {
      // Reset all state when closed
      setStep('loading');
      setAddons([]);
      setTotalCount(0);
      setPage(0);
      setSelectedId(null);
      setEditingAddon(null);
      setSaving(false);
      setSearchQuery('');
      setUnfilteredCount(0);
      setTabFilter(null);
      setPackCount(0);
      setLibraryCount(0);
      tabFilterRef.current   = null;
      addonTypeIdRef.current = null;
      userIdRef.current      = null;
      packNameMapRef.current = new Map();
      sortedAllRef.current   = [];
      return;
    }

    let cancelled = false;

    const init = async () => {
      // Get the current user
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session) return;
      userIdRef.current = session.user.id;

      // Resolve game → addon_type
      const { data: game } = await supabase
        .from('games')
        .select('id')
        .eq('slug', gameSlug)
        .single();
      if (cancelled || !game) return;

      const { data: addonType } = await supabase
        .from('addon_types')
        .select('id')
        .eq('game_id', game.id)
        .eq('slug', addonTypeSlug)
        .single();
      if (cancelled || !addonType) return;

      addonTypeIdRef.current = addonType.id;

      // Determine which sources have items so we know whether to show tabs.
      const excluded = excludeRef.current;
      let packCountQ = supabase
        .from('addons')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('addon_type_id', addonType.id)
        .not('pack_id', 'is', null);
      let libCountQ = supabase
        .from('addons')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('addon_type_id', addonType.id)
        .is('pack_id', null);
      if (excluded.length > 0) {
        packCountQ = packCountQ.not('id', 'in', `(${excluded.join(',')})`);
        libCountQ  = libCountQ.not('id', 'in', `(${excluded.join(',')})`);
      }
      const [packRes, libRes, packsNamesRes] = await Promise.all([
        packCountQ,
        libCountQ,
        supabase.from('packs').select('id, name').eq('owner_user_id', session.user.id).eq('game_id', game.id),
      ]);
      if (cancelled) return;

      packNameMapRef.current = new Map(
        ((packsNamesRes.data ?? []) as { id: string; name: string }[]).map(p => [p.id, p.name]),
      );

      const pc = packRes.count ?? 0;
      const lc = libRes.count ?? 0;
      const initialFilter = pc > 0 && lc > 0 ? 'pack' : null;
      // Set the ref synchronously so the following fetchPage call picks it up.
      tabFilterRef.current = initialFilter;
      setPackCount(pc);
      setLibraryCount(lc);
      setTabFilter(initialFilter);

      await fetchPage(0);
    };

    init();
    return () => { cancelled = true; };
  }, [open, gameSlug, addonTypeSlug, fetchPage]);

  // ── Re-fetch / re-slice when page, search, or tab filter changes ──────────

  useEffect(() => {
    // Server mode: always go to the server
    if (!prioritiseByPrerequisites) {
      if (step === 'pick') fetchPage(page, searchQuery);
      return;
    }
    // Client mode: tab filter change needs a fresh fetch; reset to page 0.
    if (step === 'pick') {
      sortedAllRef.current = [];
      setPage(0);
      setSearchQuery('');
      fetchPage(0, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFilter]);

  useEffect(() => {
    // Client mode: page or search changes are handled purely client-side
    if (!prioritiseByPrerequisites || sortedAllRef.current.length === 0) return;
    const q = searchQuery.trim().toLowerCase();
    const base = q
      ? sortedAllRef.current.filter(a => a.name.toLowerCase().includes(q))
      : sortedAllRef.current;
    setAddons(base.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE));
    setTotalCount(base.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchQuery]);

  useEffect(() => {
    // Server mode only: re-fetch on page/search change
    if (prioritiseByPrerequisites) return;
    if (step === 'pick') fetchPage(page, searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchQuery]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleAddExisting = () => {
    const selected = addons.find(a => a.id === selectedId);
    if (!selected) return;
    onAdd(selected);
    onClose();
  };

  const handleDelete = async (addonId: string) => {
    const { error } = await supabase.from('addons').delete().eq('id', addonId);
    if (error) { console.error('[AddAddonModal] delete error:', error); return; }

    if (selectedId === addonId) setSelectedId(null);
    onDeleted(addonId);

    // Recalculate page after removal
    const remaining = totalCount - 1;
    const newPage   = page > 0 && addons.length === 1 ? page - 1 : page;
    setPage(newPage);

    if (remaining === 0) {
      setAddons([]);
      setTotalCount(0);
      setStep('create');
    } else {
      await fetchPage(newPage, searchQuery);
    }
  };

  const handleSave = async (
    name: string,
    description: string | null,
    stats: Record<string, unknown>,
  ): Promise<string> => {
    const addonTypeId = addonTypeIdRef.current;
    const userId      = userIdRef.current;
    if (!addonTypeId || !userId) return '';

    setSaving(true);
    try {
      if (editingAddon) {
        // Update existing
        const { error } = await supabase
          .from('addons')
          .update({ name, description, stats })
          .eq('id', editingAddon.id);
        if (error) throw error;

        const id = editingAddon.id;
        setEditingAddon(null);
        await fetchPage(page, searchQuery);
        setStep('pick');
        return id;
      } else {
        // Create new and immediately attach to card
        const { data, error } = await supabase
          .from('addons')
          .insert({ user_id: userId, addon_type_id: addonTypeId, name, description, stats })
          .select()
          .single();
        if (error) throw error;

        onAdd(data as Addon);
        onClose();
        return (data as Addon).id;
      }
    } catch (err) {
      console.error('[AddAddonModal] save error:', err);
      return '';
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCancel = () => {
    if (editingAddon) {
      // Return to picker after aborting an edit
      setEditingAddon(null);
      setStep('pick');
      return;
    }
    // Return to picker if there are eligible addons to pick from, else close
    if (addons.length > 0 || totalCount > 0) {
      setStep('pick');
    } else {
      onClose();
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────

  const showTabs   = packCount > 0 && libraryCount > 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">

      {/* ── Step: loading ─────────────────────────────────────────────────── */}
      {step === 'loading' && (
        <div className="p-5 flex items-center justify-center min-h-[120px]">
          <p className="font-body text-sm text-gray-400">Loading…</p>
        </div>
      )}

      {/* ── Step: pick ────────────────────────────────────────────────────── */}
      {step === 'pick' && (
        <div className="p-5 flex flex-col gap-3">

          {/* Header */}
          <h5 className="font-heading text-xl text-white">
            Create new {addonTypeName}
          </h5>

          {/* Create New button */}
          <Button
            variant="outline"
            color="primary"
            leftIcon={<AddCircle className="size-4" />}
            className="w-full justify-center"
            onClick={() => { setEditingAddon(null); setStep('create'); }}
          >
            Create New {addonTypeName}
          </Button>

          {/* OR divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="font-body text-sm font-medium text-gray-500">OR</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          {/* Existing addons heading */}
          <h5 className="font-heading text-xl text-white">
            Add Existing {addonTypeName}
          </h5>

          {/* Source tabs — only shown when both packs and library have items */}
          {showTabs && (
            <div className="flex">
              {(['pack', 'library'] as const).map((tab, idx) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    tabFilterRef.current = tab;
                    setTabFilter(tab);
                    setPage(0);
                    setSelectedId(null);
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

          {/* Search — shown only when there are more than 5 possible addons */}
          {unfilteredCount > 5 && (
            <Input
              leftIcon={<Magnifer className="size-4" />}
              placeholder={`Search for a ${addonTypeName}`}
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
            />
          )}

          {/* List */}
          <div className="flex flex-col gap-1.5">
            {addons.map(addon => {
              const locked = prerequisiteContext.length > 0 && !meetsPrerequisites(addon, prerequisiteContext);
              const prereqs = addon.prerequisites as AddonPrerequisites | null;
              const lockTip = locked && prereqs && prereqs.items.length > 0
                ? `Requires: ${prereqs.items.map(p => p.name).join(prereqs.requireAll ? ' and ' : ' or ')}`
                : undefined;
              return (
                <div key={addon.id} className={locked ? 'relative' : undefined}>
                  <AddonListItem
                    name={addon.name}
                    subtitle={locked && lockTip ? lockTip : getSubtitle(addon)}
                    packLabel={addon.pack_id ? packNameMapRef.current.get(addon.pack_id) : undefined}
                    selected={!locked && selectedId === addon.id}
                    onSelect={locked ? undefined : () => setSelectedId(addon.id)}
                    onEdit={locked ? undefined : () => { setEditingAddon(addon); setStep('edit'); }}
                    onDelete={locked ? undefined : () => handleDelete(addon.id)}
                    addonTypeName={addonTypeName}
                    className={locked ? 'opacity-40 pointer-events-none select-none' : undefined}
                  />
                  {locked && (
                    <div className="absolute inset-0 flex items-center justify-end pr-3 pointer-events-none">
                      <Lock className="size-4 text-gray-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center">
              {/* Prev */}
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="size-9 flex items-center justify-center
                           bg-gray-900 border border-gray-700 rounded-l-lg
                           text-gray-400 hover:text-white hover:bg-gray-800
                           disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors"
                aria-label="Previous page"
              >
                <AltArrowLeft className="size-4" />
              </button>

              {/* Page numbers */}
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i)}
                  className={[
                    'size-9 flex items-center justify-center font-body text-sm',
                    'border-y border-r border-gray-700 transition-colors',
                    i === page
                      ? 'bg-gray-800 text-gray-50'
                      : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white',
                  ].join(' ')}
                >
                  {i + 1}
                </button>
              ))}

              {/* Next */}
              <button
                type="button"
                disabled={page === totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="size-9 flex items-center justify-center
                           bg-gray-900 border-y border-r border-gray-700 rounded-r-lg
                           text-gray-400 hover:text-white hover:bg-gray-800
                           disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors"
                aria-label="Next page"
              >
                <AltArrowRight className="size-4" />
              </button>
            </div>
          )}

          {/* CTAs */}
          <div className="flex items-center justify-end gap-1 flex-wrap">
            <Button variant="ghost" color="danger" onClick={onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              rightIcon={<CheckCircle className="size-4" />}
              disabled={!selectedId}
              onClick={handleAddExisting}
            >
              Add this {addonTypeName}
            </Button>
          </div>

        </div>
      )}

      {/* ── Step: create / edit ───────────────────────────────────────────── */}
      {(step === 'create' || step === 'edit') && (
        <CreateFormComponent
          key={editingAddon?.id ?? 'new'}
          editingAddon={step === 'edit' ? editingAddon : null}
          onSave={handleSave}
          onCancel={handleCreateCancel}
          saving={saving}
        />
      )}

    </Modal>
  );
};

export default AddAddonModal;
