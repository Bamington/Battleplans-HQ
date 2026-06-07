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

import { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import SelectableListItem from './SelectableListItem';
import AddCircle from '../icons/AddCircle';
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

  onCreateNew: () => void;
  onAdded:     (count: number) => void;
}

interface PickerItem {
  id:   string;
  name: string;
}

const RPC_NAME: Record<EntityType, string> = {
  card:    'copy_cards_to_pack',
  addon:   'copy_addons_to_pack',
  keyword: 'copy_keywords_to_pack',
};

const TABLE_NAME: Record<EntityType, 'cards' | 'addons' | 'keywords'> = {
  card:    'cards',
  addon:   'addons',
  keyword: 'keywords',
};

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
  onCreateNew,
  onAdded,
}: AddToPackModalProps) {

  // ── State ──────────────────────────────────────────────────────────────

  const [items,    setItems]    = useState<PickerItem[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search,   setSearch]   = useState('');
  const [adding,   setAdding]   = useState(false);

  // ── Fetch picker items each time the modal opens ───────────────────────
  // Scope (per the user's decision): only the caller's OWN packs, same
  // game, excluding the target pack itself.

  useEffect(() => {
    if (!open) return;
    // Reset every open so the user gets a fresh list and no stale selection.
    setItems([]);
    setSelected(new Set());
    setSearch('');
    setError(null);
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entityType, cardType, addonTypeId, gameId, targetPackId]);

  async function loadItems() {
    setLoading(true);
    try {
      // Step 1: find the user's other packs in this game.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const { data: ownPacks, error: packsErr } = await supabase
        .from('packs')
        .select('id')
        .eq('owner_user_id', user.id)
        .eq('game_id', gameId)
        .neq('id', targetPackId);
      if (packsErr) throw packsErr;

      const sourcePackIds = (ownPacks ?? []).map(p => p.id);
      if (sourcePackIds.length === 0) {
        setItems([]);
        return;
      }

      // Step 2: fetch entities of the right type/scope in those packs.
      let query = supabase
        .from(TABLE_NAME[entityType])
        .select('id, name')
        .in('pack_id', sourcePackIds)
        .order('name');

      if (entityType === 'card' && cardType) {
        query = query.eq('card_type', cardType);
      }
      if (entityType === 'addon' && addonTypeId) {
        query = query.eq('addon_type_id', addonTypeId);
      }

      const { data, error: itemsErr } = await query;
      if (itemsErr) throw itemsErr;

      setItems((data ?? []) as PickerItem[]);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => i.name.toLowerCase().includes(q));
  }, [items, search]);

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

  async function handleSubmit() {
    if (!canSubmit) return;
    setAdding(true);
    setError(null);

    const { data, error: rpcErr } = await supabase.rpc(RPC_NAME[entityType], {
      p_target_pack_id: targetPackId,
      p_source_ids:     Array.from(selected),
    });

    setAdding(false);

    if (rpcErr) {
      setError("Couldn't add the selected items. Please try again.");
      return;
    }
    // The RPC returns the count of new rows inserted. Number cast handles
    // both numeric and string returns from supabase-js.
    onAdded(Number(data ?? selected.size));
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Modal open={open} onClose={() => !adding && onClose()}>
      <div className="flex flex-col gap-3 p-5">

        <h2 className="font-heading text-xl text-white">{title}</h2>

        {description && (
          <p className="font-body text-base text-gray-300">{description}</p>
        )}

        {/* "New X" button — full width, outlined. Calling code handles the
            actual create flow (currently stubbed). */}
        <Button
          variant="outline"
          color="primary"
          className="w-full"
          leftIcon={<AddCircle className="size-4" />}
          onClick={onCreateNew}
        >
          {newButtonLabel}
        </Button>

        {/* OR divider. HR's "text" variant has my-8 baked in which is too
            much for a modal — render the same visual inline. */}
        <div className="flex items-center gap-3 py-1">
          <hr className="flex-1 h-px border-0 bg-gray-700" />
          <span className="font-body text-xs font-medium text-gray-400 uppercase tracking-wider">
            or
          </span>
          <hr className="flex-1 h-px border-0 bg-gray-700" />
        </div>

        {/* Search — purely client-side filter over the loaded list. */}
        <Input
          placeholder={`Search ${title.replace(/^Add /, '').replace(/ to Pack$/, '').toLowerCase()}s`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          leftIcon={<Magnifer className="size-4" />}
          disabled={loading || adding}
        />

        {/* Picker list — fixed height + scroll so the modal doesn't
            jump around as the user filters. */}
        <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto">
          {loading ? (
            <p className="font-body text-sm text-gray-400 text-center py-6">
              Loading…
            </p>
          ) : filtered.length === 0 ? (
            <p className="font-body text-sm text-gray-400 text-center py-6">
              {items.length === 0
                ? "Nothing in your other packs to copy from yet."
                : "No matches."}
            </p>
          ) : (
            filtered.map(item => (
              <SelectableListItem
                key={item.id}
                name={item.name}
                checked={selected.has(item.id)}
                onCheckedChange={c => toggle(item.id, c)}
                disabled={adding}
              />
            ))
          )}
        </div>

        {error && (
          <p className="font-body text-sm text-red-400">{error}</p>
        )}

        {/* Footer CTAs */}
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
            loading={adding}
            rightIcon={<AltArrowRight className="size-4" />}
            onClick={handleSubmit}
          >
            Add Selected
          </Button>
        </div>

      </div>
    </Modal>
  );
}
