/**
 * RygWeaponForm.tsx — RYG weapon create/edit form
 *
 * Fields: Name, Cost (GP), Damage (free-text), Keywords.
 *
 * Props
 *   editingAddon, onSave, onCancel, saving — standard AddonFormProps contract.
 *   onPendingKeywords — fired with keyword list right before onSave when
 *     creating (and [] in a finally). Builder uses this to seed the new
 *     weapon's keywords in onAdd, before the addon_keywords sync lands.
 *   onKeywordsSaved — fired after addon_keywords sync. Builder uses this
 *     to refresh every card's in-memory copy of this weapon's keywords.
 *   onSaveComplete — fired after full save + keyword sync. Used by the
 *     pack editor to deep-clone the addon into the pack.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatKeywordLabel } from '../lib/cardShape/util';
import type { AddonFormProps } from './AddAddonModal';
import AddKeywordModal, { type KeywordSelection } from './AddKeywordModal';
import KeywordInfoModal from './KeywordInfoModal';
import Input from './Input';
import Counter from './Counter';
import Button from './Button';
import Badge from './Badge';
import HR from './HR';
import AddCircle from '../icons/AddCircle';
import CheckCircle from '../icons/CheckCircle';
import CloseCircle from '../icons/CloseCircle';

export interface RygWeaponFormProps extends AddonFormProps {
  onPendingKeywords?: (keywords: KeywordSelection[]) => void;
  onKeywordsSaved?:   (addonId: string, keywords: KeywordSelection[]) => void;
  onSaveComplete?:    (addonId: string) => void;
  /** When set, new keywords created inside this form are scoped to the pack
   *  and won't appear in the user's personal library. */
  packId?: string;
}

export default function RygWeaponForm({
  editingAddon,
  onSave,
  onCancel,
  saving,
  onPendingKeywords,
  onKeywordsSaved,
  onSaveComplete,
  packId,
}: RygWeaponFormProps) {
  const s = (editingAddon?.stats ?? {}) as Record<string, unknown>;

  const [name,        setName]        = useState(editingAddon?.name ?? '');
  const [description, setDescription] = useState(editingAddon?.description ?? '');
  const [damage,      setDamage]      = useState(typeof s.damage === 'string' ? s.damage : '');
  const [cost,        setCost]        = useState<number>(typeof s.cost === 'number' ? s.cost : 0);
  const [range,       setRange]       = useState<number>(typeof s.range === 'number' ? s.range : 0);

  const [attachedKeywords, setAttachedKeywords] = useState<KeywordSelection[]>([]);
  const [kwModalOpen,      setKwModalOpen]      = useState(false);
  const [viewingKeyword,   setViewingKeyword]   = useState<KeywordSelection | null>(null);

  useEffect(() => {
    if (!editingAddon?.id) return;
    let cancelled = false;
    supabase
      .from('addon_keywords')
      .select('keyword_id, params, sort_order, keywords(name, description, params_schema)')
      .eq('addon_id', editingAddon.id)
      .order('sort_order')
      .then(({ data }) => {
        if (cancelled || !data) return;
        type AkRow = {
          keyword_id: string;
          params:     { X?: number } | null;
          keywords:   { name: string; description: string | null; params_schema: unknown } | null;
        };
        setAttachedKeywords(
          (data as unknown as AkRow[])
            .filter(r => r.keywords != null)
            .map(r => ({
              keywordId:   r.keyword_id,
              keywordName: r.keywords!.name,
              description: r.keywords!.description ?? '',
              hasParams:   Array.isArray(r.keywords!.params_schema) && (r.keywords!.params_schema as unknown[]).length > 0,
              paramValue:  r.params?.X != null ? Number(r.params.X) : null,
            })),
        );
      });
    return () => { cancelled = true; };
  }, [editingAddon?.id]);

  const isEditing = !!editingAddon;
  const canSave   = name.trim() !== '' && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    if (!isEditing) onPendingKeywords?.(attachedKeywords);
    try {
      const kwStr = attachedKeywords.map(k => k.paramValue != null ? `${k.keywordName} (${k.paramValue})` : k.keywordName).join(', ');
      const addonId = await onSave(name.trim(), description.trim() || null, { damage, range, cost, keywords: kwStr || null });
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
        onKeywordsSaved?.(addonId, attachedKeywords);
        onSaveComplete?.(addonId);
      }
    } finally {
      onPendingKeywords?.([]);
    }
  };

  return (
    <div className="p-5 flex flex-col gap-3">
      <h5 className="font-heading text-xl text-white">
        {isEditing ? 'Edit Weapon' : 'Create Weapon'}
      </h5>
      <p className="font-body text-sm text-gray-300">
        Once created, you can add this weapon to warriors from the same game.
      </p>

      {/* ── Basic Details ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="font-body text-base font-bold text-gray-100">Basic Details</p>

        <Input
          label="Weapon Name"
          required
          placeholder="e.g. Battleaxe"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        <div>
          <label className="block text-sm font-medium font-body text-white mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe what this weapon does…"
            rows={2}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm
                       font-body text-white placeholder:text-gray-500
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       resize-y"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Damage"
            placeholder="e.g. 1D6+3"
            value={damage}
            onChange={e => setDamage(e.target.value)}
          />
          <Counter label="Range (in)" value={range} onChange={setRange} min={0} max={999} />
          <Counter label="Cost (GP)" value={cost} onChange={setCost} min={0} max={9999} />
        </div>

        {/* Keywords */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium font-body text-white">Keywords</p>
          {attachedKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachedKeywords.map(k => (
                <Badge
                  key={k.keywordId}
                  onDismiss={() => setAttachedKeywords(prev => prev.filter(x => x.keywordId !== k.keywordId))}
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
              onClick={() => setKwModalOpen(true)}
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

      {/* Keyword picker */}
      <AddKeywordModal
        open={kwModalOpen}
        onClose={() => setKwModalOpen(false)}
        gameSlug="ryg"
        packId={packId}
        onKeywordSelected={kw => {
          setAttachedKeywords(prev => [...prev, kw]);
          setKwModalOpen(false);
        }}
        excludeKeywordIds={attachedKeywords.map(k => k.keywordId)}
      />

      {/* Keyword info */}
      <KeywordInfoModal
        open={!!viewingKeyword}
        onClose={() => setViewingKeyword(null)}
        name={viewingKeyword?.keywordName ?? ''}
        description={viewingKeyword?.description ?? ''}
      />
    </div>
  );
}
