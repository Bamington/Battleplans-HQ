/**
 * HaloWeaponForm.tsx — Halo Flashpoint weapon create/edit form
 *
 * The form rendered inside AddAddonModal when the user creates or edits
 * a Halo weapon. Was originally defined inline in CardBuilderHaloFlashpoint
 * and communicated with the builder via module-scoped variables. Extracted
 * so it can be reused by the pack editor's "Edit Weapon" flow.
 *
 * The builder still uses this form via AddAddonModal's CreateFormComponent
 * slot. The pack editor uses it directly inside a Modal (no picker step
 * needed when editing a specific row).
 *
 * Props
 *   editingAddon, onSave, onCancel, saving — the standard AddonFormProps
 *     contract. onSave returns the addon ID; the form then sync-writes
 *     its addon_keywords joins using that ID.
 *   weaponConstraints / keywordConstraints — optional DB-driven validation
 *     limits. Omit (or pass {}) for no limits.
 *   onPendingKeywords — fired with the form's current keyword list right
 *     before onSave. The builder uses this to stash keywords so its
 *     onAdd handler can populate the active card's in-memory weapons
 *     array. The pack editor ignores it and reloads from DB after save.
 *   onPropagateKeywordUpdate — fired when the user edits a keyword
 *     definition from inside the form. The builder uses this to keep
 *     every card's in-memory keyword copies in sync. The pack editor
 *     ignores it and reloads.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatKeywordLabel } from '../lib/cardShape/util';
import { isAtLimit, getMaxKeywords } from '../lib/constraints';
import type { EntityConstraints } from '../lib/database.types';

import type { AddonFormProps } from './AddAddonModal';
import AddKeywordModal, { type KeywordSelection } from './AddKeywordModal';
import KeywordInfoModal from './KeywordInfoModal';
import Select from './Select';
import Input from './Input';
import Counter from './Counter';
import Button from './Button';
import Badge from './Badge';
import HR from './HR';
import AddCircle from '../icons/AddCircle';
import CheckCircle from '../icons/CheckCircle';
import CloseCircle from '../icons/CloseCircle';

// ── Constants ────────────────────────────────────────────────────────────────

const WEAPON_TYPE_OPTIONS = [
  { value: '',             label: 'Closed Combat or Ranged', disabled: true },
  { value: 'Close Combat', label: 'Close Combat' },
  { value: 'Ranged',       label: 'Ranged'       },
  { value: 'Grenade',      label: 'Grenade'      },
];

// ── Props ────────────────────────────────────────────────────────────────────

export interface HaloWeaponFormProps extends AddonFormProps {
  /** Constraints for the addon itself; primarily used to cap how many
   *  keywords can be attached to one weapon. Defaults to no limits. */
  weaponConstraints?:   EntityConstraints;
  /** Constraints for keyword fields; forwarded to the nested
   *  AddKeywordModal. Defaults to no limits. */
  keywordConstraints?:  EntityConstraints;
  /** Fired with the form's keyword list immediately before onSave runs.
   *  Builders use this to remember keywords across the async boundary
   *  so their onAdd handler can populate in-memory weapon state. The
   *  pack editor doesn't need it (it reloads from DB after save). */
  onPendingKeywords?:   (keywords: KeywordSelection[]) => void;
  /** Fired when the user edits a keyword definition from inside the
   *  form. Builders use this to propagate the change to every card's
   *  in-memory keyword copies. The pack editor ignores it and reloads. */
  onPropagateKeywordUpdate?: (
    keywordId:   string,
    name:        string,
    description: string,
    hasParams:   boolean,
  ) => void;
  /** Fired once the FULL save has settled — addon row written AND
   *  addon_keywords synced. Use this when follow-up work needs the
   *  addon's keyword joins in place (e.g. the pack editor's create
   *  flow, which deep-clones the addon into the pack after saving).
   *  onSave alone resolves before the keyword sync lands. */
  onSaveComplete?: (addonId: string) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function HaloWeaponForm({
  editingAddon,
  onSave,
  onCancel,
  saving,
  weaponConstraints   = {},
  keywordConstraints  = {},
  onPendingKeywords,
  onPropagateKeywordUpdate,
  onSaveComplete,
}: HaloWeaponFormProps) {
  const s = (editingAddon?.stats ?? {}) as Record<string, unknown>;

  const [type,       setType]       = useState(String(s.type  ?? ''));
  const [name,       setName]       = useState(editingAddon?.name ?? '');
  const [range,      setRange]      = useState(Number(s.range) || 0);
  const [ap,         setAp]         = useState(Number(s.ap)    || 0);
  const [pointsCost, setPointsCost] = useState(Number(s.pointsCost) || 0);

  const [attachedKeywords, setAttachedKeywords] = useState<KeywordSelection[]>([]);
  const [keywordModalOpen, setKeywordModalOpen] = useState(false);
  const [viewingKeyword,   setViewingKeyword]   = useState<KeywordSelection | null>(null);
  const [editingKw,        setEditingKw]        = useState<KeywordSelection | null>(null);

  // Load existing keyword attachments when editing.
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

      // Supabase types the nested join loosely — cast through unknown.
      type AkRow = {
        keyword_id: string;
        params:     { X?: number } | null;
        keywords:   { name: string; description: string | null; params_schema: unknown } | null;
      };
      setAttachedKeywords(
        (data as unknown as AkRow[])
          .filter(ak => ak.keywords != null)
          .map(ak => ({
            keywordId:   ak.keyword_id,
            keywordName: ak.keywords!.name,
            description: ak.keywords!.description ?? '',
            hasParams:   Array.isArray(ak.keywords!.params_schema) && ak.keywords!.params_schema.length > 0,
            paramValue:  ak.params?.X != null ? Number(ak.params.X) : null,
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
    // Snapshot keywords so the caller can read them in their onAdd
    // handler (which fires AFTER onSave resolves, with no extra args
    // to thread through AddAddonModal's interface).
    onPendingKeywords?.([...attachedKeywords]);

    const addonId = await onSave(
      name.trim(),
      null,
      {
        type:       type.trim(),
        range:      isCC ? null : String(range),
        ap:         String(ap),
        pointsCost: String(pointsCost),
        keywords:   attachedKeywords
                      .map(k => formatKeywordLabel(k.keywordName, k.paramValue))
                      .join(', '),
      },
    );

    // Sync addon_keywords joins after the addon row is persisted.
    if (addonId) {
      await supabase.from('addon_keywords').delete().eq('addon_id', addonId);
      if (attachedKeywords.length > 0) {
        await supabase.from('addon_keywords').insert(
          attachedKeywords.map((k, i) => ({
            addon_id:   addonId,
            keyword_id: k.keywordId,
            params:     k.paramValue != null ? { X: k.paramValue } : {},
            sort_order: i,
          })),
        );
      }
      onSaveComplete?.(addonId);
    }
  };

  return (
    <div className="p-5 flex flex-col gap-3">

      {/* Title */}
      <h5 className="font-heading text-xl text-white">
        {isEditing ? 'Edit Weapon' : 'Create Weapon'}
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
                    {formatKeywordLabel(k.keywordName, k.paramValue)}
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
              disabled={isAtLimit(attachedKeywords.length, getMaxKeywords(weaponConstraints))}
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

      {/* Add-keyword modal (nested inside weapon form) */}
      <AddKeywordModal
        open={keywordModalOpen}
        onClose={() => setKeywordModalOpen(false)}
        gameSlug="halo-flashpoint"
        onKeywordSelected={kw => {
          setAttachedKeywords(prev => [...prev, kw]);
          setKeywordModalOpen(false);
        }}
        excludeKeywordIds={attachedKeywords.map(k => k.keywordId)}
        constraints={keywordConstraints}
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

      {/* Edit-keyword modal */}
      <AddKeywordModal
        open={!!editingKw}
        onClose={() => setEditingKw(null)}
        gameSlug="halo-flashpoint"
        editingKeyword={editingKw ? {
          id:          editingKw.keywordId,
          name:        editingKw.keywordName,
          description: editingKw.description,
          hasParams:   editingKw.hasParams,
        } : null}
        onKeywordSelected={() => {/* unreachable in edit-only flow */}}
        onKeywordUpdated={updated => {
          setAttachedKeywords(prev => prev.map(k =>
            k.keywordId === updated.keywordId
              ? { ...k, keywordName: updated.keywordName, description: updated.description, hasParams: updated.hasParams }
              : k,
          ));
          onPropagateKeywordUpdate?.(
            updated.keywordId,
            updated.keywordName,
            updated.description,
            updated.hasParams,
          );
          setEditingKw(null);
        }}
        constraints={keywordConstraints}
      />

    </div>
  );
}
