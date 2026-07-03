/**
 * KillTeamAbilityForm.tsx — Kill Team ability create/edit form
 *
 * The form rendered inside AddAddonModal when the user creates or edits
 * a Kill Team ability. Was originally defined inline in CardBuilderKillTeam
 * and communicated with the builder via module-scoped variables. Extracted
 * so it can be reused by the pack editor's "Edit Ability" flow.
 *
 * Same prop contract as KillTeamWeaponForm — see that file's header for
 * the full story on onPendingKeywords / onKeywordsSaved /
 * onPropagateKeywordUpdate.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@battleplans/ui';
import { formatKeywordLabel } from '../lib/cardShape/util';

import type { AddonFormProps } from './AddAddonModal';
import AddKeywordModal, { type KeywordSelection } from './AddKeywordModal';
import KeywordInfoModal from './KeywordInfoModal';
import Input from './Input';
import Counter from './Counter';
import Button from './Button';
import Badge from './Badge';
import HR from './HR';
import AddCircle from '@battleplans/ui';
import CheckCircle from '@battleplans/ui';
import CloseCircle from '@battleplans/ui';

// ── Props ────────────────────────────────────────────────────────────────────

export interface KillTeamAbilityFormProps extends AddonFormProps {
  /** Fired with the keyword list right before onSave when creating, and
   *  with [] after the save settles. Builders stash this so their onAdd
   *  handler can seed the new in-memory ability's keywords. */
  onPendingKeywords?: (keywords: KeywordSelection[]) => void;
  /** Fired with the canonical keyword list after addon_keywords has been
   *  synced (create and edit paths). Builders use it to refresh every
   *  card's in-memory copies of this addon's keywords. */
  onKeywordsSaved?: (addonId: string, keywords: KeywordSelection[]) => void;
  /** Fired when the user edits a keyword definition from inside the form. */
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

export default function KillTeamAbilityForm({
  editingAddon,
  onSave,
  onCancel,
  saving,
  onPendingKeywords,
  onKeywordsSaved,
  onPropagateKeywordUpdate,
  onSaveComplete,
}: KillTeamAbilityFormProps) {
  const s = (editingAddon?.stats ?? {}) as Record<string, unknown>;

  const [name,        setName]        = useState(editingAddon?.name ?? '');
  const [description, setDescription] = useState(editingAddon?.description ?? '');
  const [apCost,      setApCost]      = useState(Number(s.apCost) || 0);

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

  const isEditing = !!editingAddon;
  const canSave   = name.trim() !== '' && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    // Stash for the caller's onAdd handler, which fires before the
    // addon_keywords sync below lands.
    if (!editingAddon) onPendingKeywords?.(attachedKeywords);
    try {
      const addonId = await onSave(
        name.trim(),
        description.trim() || null,
        { apCost },
      );

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
        // Broadcast the saved keyword list so any in-memory copy of this
        // addon gets its keyword data refreshed — covers the edit path
        // that AddAddonModal doesn't touch via onAdd.
        onKeywordsSaved?.(addonId, attachedKeywords);
        onSaveComplete?.(addonId);
      }
    } finally {
      // Clear so a stale list can't bleed across saves.
      onPendingKeywords?.([]);
    }
  };

  return (
    <div className="p-5 flex flex-col gap-3">
      <h5 className="font-heading text-xl text-white">
        {isEditing ? 'Edit Ability' : 'Create Ability'}
      </h5>
      <p className="font-body text-sm text-gray-300">
        Once created, you can add this ability to other operatives from the same game.
      </p>

      <div className="flex flex-col gap-2">
        <p className="font-body text-base font-bold text-gray-100">Basic Details</p>

        <Input
          label="Ability Name"
          required
          placeholder="Name of this ability"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium font-body text-gray-900 dark:text-white">
            Description
          </label>
          <textarea
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm
                       font-body text-gray-900 placeholder:text-gray-400
                       dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       min-h-[88px] resize-y"
            placeholder="What does this ability do?"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <Counter
          label="AP Cost"
          min={0}
          max={3}
          value={apCost}
          onChange={setApCost}
        />

        {/* Ability Keywords */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium font-body text-gray-900 dark:text-white">
            Ability Keywords
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
              onClick={() => setKeywordModalOpen(true)}
            >
              Add Keyword
            </Button>
          </div>
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
          {isEditing ? 'Update Ability' : 'Save Ability'}
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

      {/* Add-keyword modal (nested inside ability form) */}
      <AddKeywordModal
        open={keywordModalOpen}
        onClose={() => setKeywordModalOpen(false)}
        gameSlug="kill-team"
        onKeywordSelected={kw => {
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

      {/* Edit-keyword modal */}
      <AddKeywordModal
        open={!!editingKw}
        onClose={() => setEditingKw(null)}
        gameSlug="kill-team"
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
      />
    </div>
  );
}
