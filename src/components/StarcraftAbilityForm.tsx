/**
 * StarcraftAbilityForm.tsx — Create / Edit Ability form rendered inside
 * AddAddonModal for the StarCraft game (Figma node "Modals / Starcraft /
 * Create Ability").
 *
 * Mirrors StarcraftWeaponForm and conforms to AddonFormProps so it can be
 * passed straight to AddAddonModal as
 *   `CreateFormComponent={StarcraftAbilityForm}`.
 *
 * Save flow (uses the parent modal's `onSave` callback):
 *   1. Persist the addon row (name + stats JSONB) via onSave → returns the
 *      addon's id.
 *   2. Re-sync `addon_keywords` for this addon — delete existing rows then
 *      insert one per attached keyword (with string `value` params).
 * (Abilities don't use `parent_addon_id` — the "is upgrade" flag stays in
 *  stats, and there's no parent-ability picker.)
 *
 * Fields (per Figma):
 *   • Basic Details
 *       - Ability Name (required)
 *       - Ability Description (required)
 *       - Ability Keywords (Add Keywords → StarcraftAddKeywordModal)
 *   • Ability Timing
 *       - Phase   (required) — Movement / Assault / Combat / None
 *       - Timing  (optional, defaults to None) — Active / Passive / Reaction
 *   • Ability Costs
 *       - "This ability is an upgrade." checkbox
 *       - Resource Cost (CP, BM, or Energy) — required, default 0
 *       - Upgrade Cost (Minerals)            — required, default 0,
 *                                              ONLY visible when upgrade
 */

import { useEffect, useRef, useState } from 'react';
import Input from './Input';
import Counter from './Counter';
import Select from './Select';
import Checkbox from './Checkbox';
import Button from './Button';
import Badge from './Badge';
import HR from './HR';
import StarcraftAddKeywordModal from './StarcraftAddKeywordModal';
import AddCircle from '../icons/AddCircle';
import CheckCircle from '../icons/CheckCircle';
import CloseCircle from '../icons/CloseCircle';
import { supabase } from '../lib/supabase';
import type { AddonFormProps } from './AddAddonModal';
import type {
  StarcraftKeywordAttachment,
  StarcraftPhase,
  StarcraftTiming,
} from './StarcraftCard';

// ── Constants ────────────────────────────────────────────────────────────────

/** Turn phase — required on abilities. */
const PHASE_OPTIONS: { value: '' | StarcraftPhase; label: string }[] = [
  { value: '',                  label: 'None'              },
  { value: 'movement',          label: 'Movement Phase'    },
  { value: 'assault',           label: 'Assault Phase'     },
  { value: 'combat',            label: 'Combat Phase'      },
  { value: 'special_abilities', label: 'Special Abilities' },
];

/** Activation timing — optional, defaults to None (= no chip). */
const TIMING_OPTIONS: { value: '' | StarcraftTiming; label: string }[] = [
  { value: '',         label: 'None'     },
  { value: 'active',   label: 'Active'   },
  { value: 'passive',  label: 'Passive'  },
  { value: 'reaction', label: 'Reaction' },
];

// ── Component ────────────────────────────────────────────────────────────────

const StarcraftAbilityForm = ({ editingAddon, onSave, onCancel, saving }: AddonFormProps) => {
  const s = (editingAddon?.stats ?? {}) as Record<string, unknown>;

  // Field state, seeded from editingAddon when in edit mode.
  // Description lives in stats (consistent with other StarCraft addon types)
  // — addons.description on the table is left null.
  const [name,        setName]        = useState(editingAddon?.name ?? '');
  const [description, setDescription] = useState(typeof s.description === 'string' ? s.description : '');

  const [phase,  setPhase]  = useState<'' | StarcraftPhase>((s.phase  as '' | StarcraftPhase)  ?? '');
  const [timing, setTiming] = useState<'' | StarcraftTiming>((s.timing as '' | StarcraftTiming) ?? '');

  const [isUpgrade,    setIsUpgrade]    = useState<boolean>(typeof s.isUpgrade   === 'boolean' ? s.isUpgrade   : false);
  const [cpCost,       setCpCost]       = useState<number> (typeof s.cpCost      === 'number'  ? s.cpCost      : 0);
  const [upgradeCost,  setUpgradeCost]  = useState<number> (typeof s.upgradeCost === 'number'  ? s.upgradeCost : 0);

  const [attachedKeywords, setAttachedKeywords] = useState<StarcraftKeywordAttachment[]>([]);
  const [keywordModalOpen, setKeywordModalOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const cancelledRef = useRef(false);
  useEffect(() => () => { cancelledRef.current = true; }, []);

  // ── Load attached keywords when editing ───────────────────────────────────
  useEffect(() => {
    if (!editingAddon) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('addon_keywords')
        .select('keyword_id, params, sort_order, keywords(name, description, params_schema)')
        .eq('addon_id', editingAddon.id)
        .order('sort_order');
      if (cancelled || error || !data) return;

      type Row = {
        keyword_id: string;
        params: Record<string, unknown> | null;
        sort_order: number | null;
        keywords: {
          name: string;
          description: string | null;
          params_schema: Array<{ key: string; type: string; label: string }>;
        } | null;
      };
      setAttachedKeywords(
        (data as unknown as Row[])
          .filter(r => r.keywords != null)
          .map(r => ({
            keywordId:   r.keyword_id,
            name:        r.keywords!.name,
            description: r.keywords!.description ?? '',
            hasValue:    Array.isArray(r.keywords!.params_schema) && r.keywords!.params_schema.length > 0,
            value:       typeof r.params?.value === 'string' ? (r.params!.value as string) : null,
          })),
      );
    })();
    return () => { cancelled = true; };
  }, [editingAddon]);

  // ── Derived values & validation ───────────────────────────────────────────

  const isEditing = !!editingAddon;
  const canSave =
    name.trim() !== '' &&
    description.trim() !== '' &&
    phase !== '' &&        // Phase is the only addon-level required dropdown
    !saving && !submitting;

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      const stats: Record<string, unknown> = {
        phase:        phase,
        timing:       timing || null,
        cpCost:       cpCost,
        // Upgrade-cost field is only relevant when the box is ticked. When
        // unchecked, store 0 + isUpgrade=false — the form re-hides the field
        // so the user can't sneak a value in then untick the box.
        isUpgrade:    isUpgrade,
        upgradeCost:  isUpgrade ? upgradeCost : 0,
        description:  description.trim(),
      };

      const addonId = await onSave(name.trim(), null, stats);
      if (!addonId) return;

      // Re-sync addon_keywords.
      await supabase.from('addon_keywords').delete().eq('addon_id', addonId);
      if (attachedKeywords.length > 0) {
        await supabase.from('addon_keywords').insert(
          attachedKeywords.map((k, i) => ({
            addon_id:   addonId,
            keyword_id: k.keywordId,
            params:     k.hasValue && k.value != null ? { value: k.value } : {},
            sort_order: i,
          })),
        );
      }
    } catch (err) {
      console.error('[StarcraftAbilityForm] save error:', err);
    } finally {
      if (!cancelledRef.current) setSubmitting(false);
    }
  };

  // ── Keyword chip handlers ─────────────────────────────────────────────────

  const handleKeywordSelected = (kw: StarcraftKeywordAttachment) => {
    setAttachedKeywords(prev => [...prev, kw]);
    setKeywordModalOpen(false);
  };

  const removeKeyword = (keywordId: string) =>
    setAttachedKeywords(prev => prev.filter(k => k.keywordId !== keywordId));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-5 flex flex-col gap-3">

      <h5 className="font-heading text-xl text-white">
        {isEditing ? 'Edit Ability' : 'Create Ability'}
      </h5>
      <p className="font-body text-sm text-gray-300">
        Once created, you can add this ability to other units from the same game.
      </p>

      {/* ── Basic Details ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="font-body text-base font-bold text-gray-100">Basic Details</p>

        <Input
          label="Ability Name"
          required
          placeholder="Eg. Stimpack, Grenades, etc."
          value={name}
          onChange={e => setName(e.target.value)}
        />

        <Input
          label="Ability Description"
          required
          placeholder="Rules of the ability."
          value={description}
          onChange={e => setDescription(e.target.value)}
        />

        {/* Keywords */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium font-body text-gray-900 dark:text-white">
            Ability Keywords
          </p>
          {attachedKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachedKeywords.map(k => (
                <Badge key={k.keywordId} onDismiss={() => removeKeyword(k.keywordId)}>
                  {k.value != null && k.value !== '' ? `${k.name} (${k.value})` : k.name}
                </Badge>
              ))}
            </div>
          )}
          <div>
            <Button
              variant="outline"
              color="primary"
              size="sm"
              leftIcon={<AddCircle className="size-4" />}
              onClick={() => setKeywordModalOpen(true)}
            >
              Add Keywords
            </Button>
          </div>
          <p className="font-body text-xs text-gray-400">
            Add keywords that are present in the Ability Description, and you&rsquo;ll
            be able to view them quickly in Play mode.
          </p>
        </div>
      </div>

      <HR className="!my-0" />

      {/* ── Ability Timing ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="font-body text-base font-bold text-gray-100">Ability Timing</p>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Ability Phase"
            required
            value={phase}
            onChange={e => setPhase(e.target.value as '' | StarcraftPhase)}
            options={PHASE_OPTIONS}
          />
          <Select
            label="Ability Timing"
            value={timing}
            onChange={e => setTiming(e.target.value as '' | StarcraftTiming)}
            options={TIMING_OPTIONS}
          />
        </div>
      </div>

      <HR className="!my-0" />

      {/* ── Ability Costs ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <p className="font-body text-base font-bold text-gray-100">Ability Costs</p>

        <Checkbox
          label="This ability is an upgrade."
          checked={isUpgrade}
          onChange={e => setIsUpgrade(e.target.checked)}
        />

        <div className="flex items-end gap-4">
          <Counter
            label="Resource Cost (CP, BM, or Energy)"
            required
            min={0}
            max={99}
            value={cpCost}
            onChange={setCpCost}
          />
          {isUpgrade && (
            <Counter
              label="Upgrade Cost (Minerals)"
              required
              min={0}
              max={9999}
              value={upgradeCost}
              onChange={setUpgradeCost}
            />
          )}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex items-center justify-end gap-1 pt-1">
        <Button variant="ghost" color="danger" leftIcon={<CloseCircle className="size-4" />} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          color="primary"
          leftIcon={<CheckCircle className="size-4" />}
          disabled={!canSave}
          loading={saving || submitting}
          onClick={handleSave}
        >
          Save Ability
        </Button>
      </div>

      {/* Keyword picker / creator */}
      <StarcraftAddKeywordModal
        open={keywordModalOpen}
        onClose={() => setKeywordModalOpen(false)}
        excludeKeywordIds={attachedKeywords.map(k => k.keywordId)}
        onKeywordSelected={handleKeywordSelected}
      />
    </div>
  );
};

export default StarcraftAbilityForm;
