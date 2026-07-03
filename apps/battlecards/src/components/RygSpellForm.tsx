import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatKeywordLabel } from '../lib/cardShape/util';
import type { AddonFormProps } from './AddAddonModal';
import AddAddonModal from './AddAddonModal';
import type {
  RygSpellStats, RygSpellType,
  AddonPrerequisites, AddonPrerequisiteItem,
  RygTalentStats, RygTalentParamField,
} from '../lib/database.types';
import AddKeywordModal, { type KeywordSelection } from './AddKeywordModal';
import KeywordInfoModal from './KeywordInfoModal';
import Modal from './Modal';
import Input from './Input';
import Counter from './Counter';
import Button from './Button';
import Badge from './Badge';
import HR from './HR';
import RygTalentForm from './RygTalentForm';
import AddCircle from '../icons/AddCircle';
import CheckCircle from '../icons/CheckCircle';
import CloseCircle from '../icons/CloseCircle';

const SPELL_TYPES: RygSpellType[] = ['Blood Magic', 'Elementalism', 'Sorcery'];

const emptyPrereqs = (): AddonPrerequisites => ({ requireAll: false, items: [] });

export interface RygSpellFormProps extends AddonFormProps {
  onSaveComplete?: (addonId: string) => void;
  packId?:         string;
}

export default function RygSpellForm({
  editingAddon,
  onSave,
  onCancel,
  saving,
  onSaveComplete,
  packId,
}: RygSpellFormProps) {
  const s = (editingAddon?.stats ?? {}) as RygSpellStats;

  const [name,         setName]         = useState(editingAddon?.name ?? '');
  const [spellType,    setSpellType]    = useState<RygSpellType | ''>(s.type ?? '');
  const [range,        setRange]        = useState<number>(s.range ?? 0);
  const [radius,       setRadius]       = useState<number>(s.radius ?? 0);
  const [target,       setTarget]       = useState(s.target ?? '');
  const [fateModifier, setFateModifier] = useState(s.fateModifier ?? '');
  const [effect,       setEffect]       = useState(s.effect ?? '');

  // Prerequisites
  const [prerequisites, setPrerequisites] = useState<AddonPrerequisites>(() => {
    const raw = editingAddon?.prerequisites as unknown;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const p = raw as Partial<AddonPrerequisites>;
      return { requireAll: p.requireAll ?? false, items: p.items ?? [] };
    }
    return emptyPrereqs();
  });
  const [prereqPickerOpen, setPrereqPickerOpen] = useState(false);
  const [pendingPrereq, setPendingPrereq] = useState<{
    addonId:     string;
    name:        string;
    paramsSchema: RygTalentParamField[];
    selections:  Record<string, string[]>;
  } | null>(null);

  const addPrereqItem = (item: AddonPrerequisiteItem) =>
    setPrerequisites(prev => ({ ...prev, items: [...prev.items, item] }));

  const removePrereqItem = (i: number) =>
    setPrerequisites(prev => ({ ...prev, items: prev.items.filter((_, j) => j !== i) }));

  // Spell keywords
  const [attachedKeywords, setAttachedKeywords] = useState<KeywordSelection[]>([]);
  const [kwModalOpen,      setKwModalOpen]      = useState(false);
  const [viewingKeyword,   setViewingKeyword]   = useState<KeywordSelection | null>(null);

  const isEditing = !!editingAddon;
  const canSave   = name.trim() !== '' && spellType !== '' && !saving;

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

  const handleSave = async () => {
    if (!canSave) return;
    const stats: RygSpellStats = {
      type:         spellType as RygSpellType,
      range,
      target:       target.trim() || undefined,
      fateModifier: fateModifier.trim() || undefined,
      effect:       effect.trim() || undefined,
    };
    if (radius > 0) stats.radius = radius;

    // Write prerequisites before calling onSave so that the fetchPage triggered
    // inside AddAddonModal.handleSave picks up the updated data.
    if (editingAddon?.id) {
      await supabase.from('addons').update({ prerequisites }).eq('id', editingAddon.id);
    }

    const addonId = await onSave(name.trim(), null, stats as Record<string, unknown>);
    if (addonId) {
      await Promise.all([
        ...(editingAddon ? [] : [supabase.from('addons').update({ prerequisites }).eq('id', addonId)]),
        (async () => {
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
        })(),
      ]);
      onSaveComplete?.(addonId);
    }
  };

  // Display name for a prerequisite item
  const prereqLabel = (p: AddonPrerequisiteItem) => {
    const paramParts = Object.values(p.params).flat().filter(Boolean);
    return paramParts.length > 0 ? `${p.name} (${paramParts.join(', ')})` : p.name;
  };

  return (
    <div className="p-5 flex flex-col gap-3">
      <h5 className="font-heading text-xl text-white">
        {isEditing ? 'Edit Spell' : 'Create Spell'}
      </h5>
      <p className="font-body text-sm text-gray-300">
        Once created, this spell can be added to warriors from the same game.
      </p>

      <Input
        label="Spell Name"
        required
        placeholder="e.g. Fireball"
        value={name}
        onChange={e => setName(e.target.value)}
      />

      {/* Type */}
      <div>
        <label className="block text-sm font-medium font-body text-white mb-1">
          Type <span className="text-red-400">*</span>
        </label>
        <div className="flex gap-2 flex-wrap">
          {SPELL_TYPES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setSpellType(t)}
              className={`px-3 py-1.5 rounded-full text-sm font-body border transition-colors ${
                spellType === t
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Prerequisites */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium font-body text-white">Prerequisites</p>
        {prerequisites.items.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {prerequisites.items.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
              >
                <p className="font-body text-sm font-medium text-gray-200 flex-1 min-w-0 truncate">
                  {prereqLabel(p)}
                </p>
                <button
                  type="button"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => removePrereqItem(i)}
                  className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <CloseCircle className="size-4" />
                </button>
              </div>
            ))}
            {prerequisites.items.length >= 2 && (
              <label className="flex items-center gap-2 cursor-pointer select-none mt-0.5">
                <input
                  type="checkbox"
                  checked={prerequisites.requireAll}
                  onChange={e => setPrerequisites(prev => ({ ...prev, requireAll: e.target.checked }))}
                  className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-body text-sm text-gray-300">All prerequisites are required</span>
              </label>
            )}
          </div>
        )}
        <div>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<AddCircle className="size-4" />}
            onClick={() => setPrereqPickerOpen(true)}
          >
            Add Prerequisite
          </Button>
        </div>
      </div>

      <HR className="!my-0" />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <Counter label="Range (inches)" value={range} onChange={setRange} min={0} max={999} />
        <Counter label="Radius (inches)" value={radius} onChange={setRadius} min={0} max={999} />
      </div>

      <Input
        label="Target"
        placeholder="e.g. Enemy model within range"
        value={target}
        onChange={e => setTarget(e.target.value)}
      />

      <Input
        label="Fate Modifier"
        placeholder="e.g. +2"
        value={fateModifier}
        onChange={e => setFateModifier(e.target.value)}
      />

      <div>
        <label className="block text-sm font-medium font-body text-white mb-1">Effect</label>
        <textarea
          value={effect}
          onChange={e => setEffect(e.target.value)}
          placeholder="Describe what this spell does…"
          rows={4}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm
                     font-body text-white placeholder:text-gray-500
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     resize-y"
        />
      </div>

      <HR className="!my-0" />

      {/* Spell Keywords */}
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

      <HR className="!my-0" />

      <div className="flex items-center gap-1 flex-wrap">
        <Button
          leftIcon={<CheckCircle className="size-4" />}
          disabled={!canSave}
          loading={saving}
          onClick={handleSave}
        >
          {isEditing ? 'Update Spell' : 'Save Spell'}
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

      <KeywordInfoModal
        open={!!viewingKeyword}
        onClose={() => setViewingKeyword(null)}
        name={viewingKeyword?.keywordName ?? ''}
        description={viewingKeyword?.description ?? ''}
      />

      {/* Prerequisite talent picker */}
      {prereqPickerOpen && (
        <AddAddonModal
          open
          gameSlug="ryg"
          addonTypeSlug="talents"
          addonTypeName="Talent"
          excludeAddonIds={prerequisites.items.map(p => p.addonId)}
          onClose={() => setPrereqPickerOpen(false)}
          onAdd={addon => {
            setPrereqPickerOpen(false);
            const ps = (addon.stats as RygTalentStats)?.paramsSchema as RygTalentParamField[] | undefined;
            if (ps && ps.length > 0) {
              setPendingPrereq({ addonId: addon.id, name: addon.name, paramsSchema: ps, selections: {} });
            } else {
              addPrereqItem({ addonId: addon.id, name: addon.name, params: {} });
            }
          }}
          onDeleted={() => {}}
          getSubtitle={addon => addon.description ? addon.description.slice(0, 60) + (addon.description.length > 60 ? '…' : '') : '—'}
          CreateFormComponent={RygTalentForm}
        />
      )}

      {/* Prerequisite params picker */}
      {pendingPrereq && (
        <Modal open onClose={() => setPendingPrereq(null)} className="max-w-sm">
          <div className="p-5 flex flex-col gap-4">
            <div>
              <h5 className="font-heading text-xl text-white">{pendingPrereq.name}</h5>
              <p className="font-body text-sm text-gray-400 mt-1">
                Optionally specify which variant is required. Leave blank to accept any.
              </p>
            </div>
            {pendingPrereq.paramsSchema.map(field => {
              const selected = pendingPrereq.selections[field.key] ?? [];
              const toggle = (opt: string) => setPendingPrereq(prev => {
                if (!prev) return prev;
                const cur = prev.selections[field.key] ?? [];
                const next = cur.includes(opt) ? cur.filter(v => v !== opt) : [...cur, opt];
                return { ...prev, selections: { ...prev.selections, [field.key]: next } };
              });
              return (
                <div key={field.key}>
                  <p className="font-body text-sm font-medium text-white mb-2">{field.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {field.options.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggle(opt)}
                        className={`px-3 py-1.5 rounded-full text-sm font-body border transition-colors ${
                          selected.includes(opt)
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="flex items-center gap-2">
              <Button
                leftIcon={<CheckCircle className="size-4" />}
                onClick={() => {
                  const p = pendingPrereq;
                  setPendingPrereq(null);
                  addPrereqItem({ addonId: p.addonId, name: p.name, params: p.selections });
                }}
              >
                Add Prerequisite
              </Button>
              <Button
                variant="ghost"
                color="danger"
                leftIcon={<CloseCircle className="size-4" />}
                onClick={() => setPendingPrereq(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
