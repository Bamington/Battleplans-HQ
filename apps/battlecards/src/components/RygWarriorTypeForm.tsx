/**
 * RygWarriorTypeForm.tsx — Create/edit a Warrior Type addon for RYG.
 *
 * Stores:
 *   addon.name        → type name  (e.g. "Berserker")
 *   addon.stats       → { offense, defense, life, tactics, fate, talentIds }
 *   addon.description → special ability description text
 *
 * Predefined talents are stored as an array of talent addon IDs in stats.
 * The builder seeds the card's talent addons from this list when the type
 * is selected.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@battleplans/ui';
import Input from './Input';
import Counter from './Counter';
import Button from './Button';
import HR from './HR';
import AddAddonModal from './AddAddonModal';
import CheckCircle from '@battleplans/ui';
import CloseCircle from '@battleplans/ui';
import AddCircle from '@battleplans/ui';
import type { AddonFormProps } from './AddAddonModal';
import type { RygWarriorTypeStats, RygTalentStats, RygTalentParamField } from '../lib/database.types';
import Modal from './Modal';
import RygTalentForm from './RygTalentForm';

// ── Props ─────────────────────────────────────────────────────────────────────

interface RygWarriorTypeFormProps extends AddonFormProps {
  /** Fired with the talent list right before onSave when creating, and
   *  with [] after the save settles. Callers stash this to seed the
   *  warrior's talent addons before onAdd fires. */
  onPendingTalents?: (talents: { id: string; name: string; description: string; params?: Record<string, string[]>; deferred?: boolean; deferredLabel?: string }[]) => void;
  /** Fired once the full save has settled. Used by the pack editor to
   *  copy the new addon into the pack. */
  onSaveComplete?: (addonId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RygWarriorTypeForm({
  editingAddon,
  onSave,
  onCancel,
  saving,
  onPendingTalents,
  onSaveComplete,
}: RygWarriorTypeFormProps) {
  const s = (editingAddon?.stats ?? {}) as RygWarriorTypeStats;

  const [typeName,    setTypeName]    = useState(editingAddon?.name ?? '');
  const [offense,     setOffense]     = useState(s.offense     ?? 0);
  const [defense,     setDefense]     = useState(s.defense     ?? 0);
  const [life,        setLife]        = useState(s.life        ?? 0);
  const [tactics,     setTactics]     = useState(s.tactics     ?? 0);
  const [fate,        setFate]        = useState(s.fate        ?? 0);
  const [abilityDesc, setAbilityDesc] = useState(editingAddon?.description ?? '');

  const [attachedTalents,  setAttachedTalents]  = useState<{ id: string; name: string; description: string; params?: Record<string, string[]>; deferred?: boolean; deferredLabel?: string }[]>([]);
  const [talentModalOpen,  setTalentModalOpen]  = useState(false);
  const [pendingTalentParams, setPendingTalentParams] = useState<{
    addonId:       string;
    name:          string;
    description:   string;
    paramsSchema:  RygTalentParamField[];
    selections:    Record<string, string[]>;
    deferredLabel: string;
    chooseWhenAdded: boolean;
  } | null>(null);

  const isEditing = !!editingAddon;

  // When editing, fetch the talent addons for the stored talentIds
  useEffect(() => {
    if (!editingAddon) return;
    const ts = editingAddon.stats as RygWarriorTypeStats;
    // Prefer the richer `talents` field (stores params); fall back to legacy talentIds
    const richTalents = ts.talents ?? [];
    const ids = richTalents.length > 0 ? richTalents.map(t => t.id) : (ts.talentIds ?? []);
    if (!ids.length) return;
    let cancelled = false;
    supabase
      .from('addons')
      .select('id, name, description')
      .in('id', ids)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const byId = new Map(data.map(a => [a.id, a]));
        const paramsById        = Object.fromEntries(richTalents.map(t => [t.id, t.params]));
        const deferredById      = Object.fromEntries(richTalents.map(t => [t.id, t.deferred]));
        const deferredLabelById = Object.fromEntries(richTalents.map(t => [t.id, t.deferredLabel]));
        setAttachedTalents(
          ids
            .filter(id => byId.has(id))
            .map(id => {
              const a = byId.get(id)!;
              return { id: a.id, name: a.name, description: a.description ?? '', params: paramsById[id], deferred: deferredById[id], deferredLabel: deferredLabelById[id] };
            }),
        );
      });
    return () => { cancelled = true; };
  }, [editingAddon]);

  const handleSave = async () => {
    if (!isEditing) onPendingTalents?.(attachedTalents);
    try {
      const addonId = await onSave(
        typeName.trim(),
        abilityDesc.trim() || null,
        {
          offense, defense, life, tactics, fate,
          talentIds: attachedTalents.map(t => t.id),
          talents:   attachedTalents.map(t => ({ id: t.id, name: t.name, params: t.params ?? {}, deferred: t.deferred, deferredLabel: t.deferredLabel })),
        },
      );
      if (addonId) onSaveComplete?.(addonId);
    } finally {
      onPendingTalents?.([]);
    }
  };

  return (
    <div className="p-5 flex flex-col gap-3">
      <h5 className="font-heading text-xl text-white">
        {isEditing ? 'Edit Warrior Type' : 'Create Warrior Type'}
      </h5>
      <p className="font-body text-sm text-gray-300">
        Once created, you can assign this type to warriors from the same game.
      </p>

      {/* ── Type Details ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="font-body text-base font-bold text-gray-100">Type Details</p>
        <Input
          label="Type Name"
          required
          value={typeName}
          onChange={e => setTypeName(e.target.value)}
          placeholder="e.g. Berserker"
        />
      </div>

      <HR className="!my-0" />

      {/* ── Starting Stats ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="font-body text-base font-bold text-gray-100">Starting Stats</p>
        <div className="grid grid-cols-2 gap-3">
          <Counter label="Offense" value={offense} onChange={setOffense} min={0} max={99} />
          <Counter label="Defense" value={defense} onChange={setDefense} min={0} max={99} />
          <Counter label="Life"    value={life}    onChange={setLife}    min={0} max={99} />
          <Counter label="Tactics" value={tactics} onChange={setTactics} min={0} max={99} />
          <Counter label="Fate"    value={fate}    onChange={setFate}    min={0} max={99} />
        </div>
      </div>

      <HR className="!my-0" />

      {/* ── Predefined Talents ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="font-body text-base font-bold text-gray-100">Predefined Talents</p>
        {attachedTalents.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {attachedTalents.map(t => (
              <div
                key={t.id}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
              >
                <p className="font-body text-sm font-medium text-gray-200 flex-1 min-w-0 truncate">
                  {t.deferred
                    ? `${t.name} (${(t as { deferredLabel?: string }).deferredLabel?.trim() || 'warrior chooses'})`
                    : t.params && Object.keys(t.params).length > 0
                      ? `${t.name} (${Object.values(t.params).flat().filter(Boolean).join(', ')})`
                      : t.name}
                </p>
                <button
                  type="button"
                  aria-label={`Remove ${t.name}`}
                  onClick={() => setAttachedTalents(prev => prev.filter(x => x.id !== t.id))}
                  className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <CloseCircle className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          leftIcon={<AddCircle className="size-4" />}
          onClick={() => setTalentModalOpen(true)}
        >
          Add Talent
        </Button>
      </div>

      <HR className="!my-0" />

      {/* ── Special Ability ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="font-body text-base font-bold text-gray-100">Special Ability</p>
        <textarea
          value={abilityDesc}
          onChange={e => setAbilityDesc(e.target.value)}
          placeholder="Describe what this ability does…"
          rows={4}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm
                     font-body text-white placeholder:text-gray-500
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     resize-y"
        />
      </div>

      <HR className="!my-0" />

      {/* CTAs */}
      <div className="flex items-center gap-1 flex-wrap">
        <Button
          leftIcon={<CheckCircle className="size-4" />}
          disabled={!typeName.trim() || saving}
          loading={saving}
          onClick={handleSave}
        >
          {isEditing ? 'Update Type' : 'Save Type'}
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

      {/* Params picker — shown when a talent with paramsSchema is selected */}
      {pendingTalentParams && (
        <Modal open onClose={() => setPendingTalentParams(null)} className="max-w-sm">
          <div className="p-5 flex flex-col gap-4">
            <div>
              <h5 className="font-heading text-xl text-white">{pendingTalentParams.name}</h5>
              <p className="font-body text-sm text-gray-400 mt-1">Choose the options for this warrior type.</p>
            </div>
            {pendingTalentParams.paramsSchema.map(field => {
              const deferred = pendingTalentParams.chooseWhenAdded;
              const selected = pendingTalentParams.selections[field.key] ?? [];
              const atMax = !deferred && field.maxSelections !== undefined && selected.length >= field.maxSelections;
              const toggle = (opt: string) => setPendingTalentParams(prev => {
                if (!prev || prev.chooseWhenAdded) return prev;
                const cur = prev.selections[field.key] ?? [];
                if (cur.includes(opt)) return { ...prev, selections: { ...prev.selections, [field.key]: cur.filter(v => v !== opt) } };
                if (field.maxSelections !== undefined && cur.length >= field.maxSelections) return prev;
                return { ...prev, selections: { ...prev.selections, [field.key]: [...cur, opt] } };
              });
              return (
                <div key={field.key}>
                  <label className="flex items-center gap-2 cursor-pointer select-none mb-3">
                    <input
                      type="checkbox"
                      checked={deferred}
                      onChange={e => setPendingTalentParams(prev => prev ? { ...prev, chooseWhenAdded: e.target.checked, selections: {} } : prev)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 accent-blue-600"
                    />
                    <span className="font-body text-sm text-gray-200">Choose when added to a warrior</span>
                  </label>
                  <p className="font-body text-sm font-medium text-white mb-2">
                    {field.label}
                    {!deferred && field.maxSelections !== undefined && (
                      <span className="text-gray-400 font-normal"> (max {field.maxSelections})</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {field.options.map(opt => {
                      const isSelected = !deferred && selected.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggle(opt)}
                          disabled={deferred || (!isSelected && atMax)}
                          className={`px-3 py-1.5 rounded-full text-sm font-body border transition-colors ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : deferred || atMax
                                ? 'bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed'
                                : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {pendingTalentParams.chooseWhenAdded && (
              <div>
                <p className="font-body text-sm font-medium text-white mb-1">
                  Warrior instruction <span className="text-gray-400 font-normal">(optional)</span>
                </p>
                <input
                  value={pendingTalentParams.deferredLabel}
                  onChange={e => setPendingTalentParams(prev => prev ? { ...prev, deferredLabel: e.target.value } : prev)}
                  placeholder={`e.g. Choose a type for ${pendingTalentParams.name}`}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm
                             font-body text-white placeholder:text-gray-500
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                leftIcon={<CheckCircle className="size-4" />}
                disabled={!pendingTalentParams.chooseWhenAdded && pendingTalentParams.paramsSchema.some(f => !(pendingTalentParams.selections[f.key]?.length))}
                onClick={() => {
                  const t = pendingTalentParams;
                  setPendingTalentParams(null);
                  if (t.chooseWhenAdded) {
                    setAttachedTalents(prev => [...prev, { id: t.addonId, name: t.name, description: t.description, params: {}, deferred: true, deferredLabel: t.deferredLabel.trim() || undefined }]);
                  } else {
                    setAttachedTalents(prev => [...prev, { id: t.addonId, name: t.name, description: t.description, params: t.selections }]);
                  }
                }}
              >
                Confirm
              </Button>
              <Button variant="ghost" color="danger" leftIcon={<CloseCircle className="size-4" />} onClick={() => setPendingTalentParams(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Nested talent picker — opens on top of the parent modal */}
      {talentModalOpen && (
        <AddAddonModal
          open
          gameSlug="ryg"
          addonTypeSlug="talents"
          addonTypeName="Talent"
          excludeAddonIds={attachedTalents.map(t => t.id)}
          onClose={() => setTalentModalOpen(false)}
          onAdd={addon => {
            setTalentModalOpen(false);
            const ps = (addon.stats as RygTalentStats)?.paramsSchema;
            if (ps && ps.length > 0) {
              setPendingTalentParams({ addonId: addon.id, name: addon.name, description: addon.description ?? '', paramsSchema: ps, selections: {}, deferredLabel: '', chooseWhenAdded: false });
            } else {
              setAttachedTalents(prev => [...prev, { id: addon.id, name: addon.name, description: addon.description ?? '' }]);
            }
          }}
          onDeleted={id => setAttachedTalents(prev => prev.filter(t => t.id !== id))}
          getSubtitle={addon => addon.description ? addon.description.slice(0, 60) + (addon.description.length > 60 ? '…' : '') : '—'}
          CreateFormComponent={RygTalentForm}
        />
      )}
    </div>
  );
}
