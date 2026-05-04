/**
 * StarcraftWeaponForm.tsx — Create / Edit Weapon form rendered inside
 * AddAddonModal for the StarCraft game (Figma node "Modals / Starcraft /
 * Create Weapon").
 *
 * The component conforms to AddonFormProps so it can be passed straight to
 * AddAddonModal as `CreateFormComponent={StarcraftWeaponForm}`.
 *
 * Save flow (uses the parent modal's `onSave` callback):
 *   1. Persist the addon row (name + stats JSONB) via onSave → returns the
 *      addon's id.
 *   2. With the id, write `parent_addon_id` directly to the addons table
 *      (it lives outside stats — it's a real column on `public.addons`).
 *   3. Re-sync `addon_keywords` for this addon — delete existing rows then
 *      insert one per attached keyword (with string `value` params).
 *
 * Form fields (per Figma):
 *   • Basic Details
 *       - Weapon Name (required)
 *       - "This weapon is an upgrade for another weapon" checkbox
 *       - Required Weapon for Upgrade (required, only when checkbox checked)
 *       - Weapon Phase (active / passive / reaction / none)
 *       - Weapon Range (numeric, melee = 0)
 *       - Weapon Keywords (Add Keywords button → StarcraftAddKeywordModal)
 *   • Weapon Stats: RoA / Hit / Damage (Counters)
 *   • Surge: Surge Type (text, optional) / Surge Dice (text, e.g. "D3+1")
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
import type { Addon } from '../lib/database.types';
import type { AddonFormProps } from './AddAddonModal';
import type {
  StarcraftKeywordAttachment,
  StarcraftPhase,
  StarcraftTiming,
} from './StarcraftCard';

// ── Constants ────────────────────────────────────────────────────────────────

const STARCRAFT_SLUG = 'starcraft';

/** Turn phase — drives where the weapon table lives on the card. Optional. */
const PHASE_OPTIONS: { value: '' | StarcraftPhase; label: string }[] = [
  { value: '',                  label: 'None'              },
  { value: 'movement',          label: 'Movement Phase'    },
  { value: 'assault',           label: 'Assault Phase'     },
  { value: 'combat',            label: 'Combat Phase'      },
  { value: 'special_abilities', label: 'Special Abilities' },
];

/** Activation timing — drives the coloured chip on the card. Optional. */
const TIMING_OPTIONS: { value: '' | StarcraftTiming; label: string }[] = [
  { value: '',         label: 'None'     },
  { value: 'active',   label: 'Active'   },
  { value: 'passive',  label: 'Passive'  },
  { value: 'reaction', label: 'Reaction' },
];

// ── Component ────────────────────────────────────────────────────────────────

const StarcraftWeaponForm = ({ editingAddon, onSave, onCancel, saving }: AddonFormProps) => {
  const s = (editingAddon?.stats ?? {}) as Record<string, unknown>;

  // Field state, seeded from editingAddon when in edit mode.
  const [name,        setName]        = useState(editingAddon?.name ?? '');
  const [phase,       setPhase]       = useState<'' | StarcraftPhase>((s.phase as '' | StarcraftPhase) ?? '');
  const [timing,      setTiming]      = useState<'' | StarcraftTiming>((s.timing as '' | StarcraftTiming) ?? '');
  const [range,       setRange]       = useState<string>(s.range != null ? String(s.range) : '');
  const [roa,         setRoa]         = useState<number>(typeof s.roa === 'number' ? s.roa : 0);
  const [hit,         setHit]         = useState<number>(typeof s.hit === 'number' ? s.hit : 0);
  const [dmg,         setDmg]         = useState<number>(typeof s.dmg === 'number' ? s.dmg : 0);
  const [surgeType,   setSurgeType]   = useState<string>(typeof s.surgeType === 'string' ? s.surgeType : '');
  const [sDice,       setSDice]       = useState<string>(typeof s.sDice     === 'string' ? s.sDice     : '');

  const [isUpgrade,    setIsUpgrade]    = useState<boolean>(editingAddon?.parent_addon_id != null);
  const [parentId,     setParentId]     = useState<string | null>(editingAddon?.parent_addon_id ?? null);
  const [parentOptions, setParentOptions] = useState<Addon[]>([]);

  const [attachedKeywords, setAttachedKeywords] = useState<StarcraftKeywordAttachment[]>([]);
  const [keywordModalOpen, setKeywordModalOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const cancelledRef = useRef(false);
  useEffect(() => () => { cancelledRef.current = true; }, []);

  // ── Load eligible parent weapons ──────────────────────────────────────────
  // Same game, owned by the current user, that aren't themselves upgrades
  // (parent_addon_id is null) and aren't this addon itself.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session) return;

      const { data: game } = await supabase
        .from('games').select('id').eq('slug', STARCRAFT_SLUG).single();
      if (cancelled || !game) return;

      const { data: addonType } = await supabase
        .from('addon_types').select('id')
        .eq('game_id', game.id).eq('slug', 'weapons').single();
      if (cancelled || !addonType) return;

      let query = supabase
        .from('addons')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('addon_type_id', addonType.id)
        .is('parent_addon_id', null)
        .order('name');
      if (editingAddon) query = query.neq('id', editingAddon.id);

      const { data, error } = await query;
      if (cancelled || error) return;
      setParentOptions((data as Addon[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [editingAddon]);

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

  const isEditing  = !!editingAddon;
  const rangeNum   = Number(range);
  const rangeValid = range !== '' && Number.isFinite(rangeNum) && rangeNum >= 0;
  const canSave =
    name.trim() !== '' &&
    rangeValid &&
    sDice.trim() !== '' &&
    (!isUpgrade || parentId != null) &&
    !saving && !submitting;

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      const stats: Record<string, unknown> = {
        phase:     phase || null,
        timing:    timing || null,
        range:     rangeNum,
        roa,
        hit,
        dmg,
        surgeType: surgeType.trim() || null,
        sDice:     sDice.trim(),
      };

      const addonId = await onSave(name.trim(), null, stats);
      if (!addonId) return;

      // Set parent_addon_id (lives on the addons row, not in stats).
      const finalParentId = isUpgrade ? parentId : null;
      if (finalParentId !== (editingAddon?.parent_addon_id ?? null)) {
        await supabase
          .from('addons')
          .update({ parent_addon_id: finalParentId })
          .eq('id', addonId);
      }

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
      console.error('[StarcraftWeaponForm] save error:', err);
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
        {isEditing ? 'Edit Weapon' : 'Create Weapon'}
      </h5>
      <p className="font-body text-sm text-gray-300">
        Once created, you can add this weapon to other units from the same game.
      </p>

      {/* ── Basic Details ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="font-body text-base font-bold text-gray-100">Basic Details</p>

        <Input
          label="Weapon Name"
          required
          placeholder="Eg. C-14 Rifle, Strike, etc."
          value={name}
          onChange={e => setName(e.target.value)}
        />

        <Checkbox
          label="This weapon is an upgrade for another weapon"
          checked={isUpgrade}
          onChange={e => {
            setIsUpgrade(e.target.checked);
            if (!e.target.checked) setParentId(null);
          }}
        />

        {isUpgrade && (
          <Select
            label="Required Weapon for Upgrade"
            required
            value={parentId ?? ''}
            onChange={e => setParentId(e.target.value || null)}
            options={[
              { value: '', label: 'Choose a Weapon' },
              ...parentOptions.map(p => ({ value: p.id, label: p.name })),
            ]}
          />
        )}

        <div className="grid grid-cols-2 gap-2">
          <Select
            label="Phase"
            value={phase}
            onChange={e => setPhase(e.target.value as '' | StarcraftPhase)}
            options={PHASE_OPTIONS}
            helperText="Where this weapon lives on the card"
          />
          <Select
            label="Timing"
            value={timing}
            onChange={e => setTiming(e.target.value as '' | StarcraftTiming)}
            options={TIMING_OPTIONS}
            helperText="Active / Passive / Reaction chip"
          />
        </div>

        <Input
          label="Weapon Range"
          required
          type="number"
          min={0}
          placeholder="Range of the weapon"
          value={range}
          onChange={e => setRange(e.target.value)}
          helperText="For melee weapons, this should be 0."
        />

        {/* Keywords */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium font-body text-gray-900 dark:text-white">
            Weapon Keywords
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
        </div>
      </div>

      <HR className="!my-0" />

      {/* ── Weapon Stats ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="font-body text-base font-bold text-gray-100">Weapon Stats</p>
        <div className="flex gap-4">
          <Counter label="Rate of Attack" required min={0} value={roa} onChange={setRoa} />
          <Counter label="Hit"            required min={0} max={9} value={hit} onChange={setHit} />
          <Counter label="Damage"         required min={0} value={dmg} onChange={setDmg} />
        </div>
      </div>

      <HR className="!my-0" />

      {/* ── Surge ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="font-body text-base font-bold text-gray-100">Surge</p>
        <div className="flex items-end gap-4">
          <Input
            label="Surge Type"
            placeholder="Eg. Light, Armoured, etc."
            value={surgeType}
            onChange={e => setSurgeType(e.target.value)}
            className="flex-1"
          />
          <Input
            label="Surge Dice"
            required
            placeholder="D3, D3+1, etc."
            value={sDice}
            onChange={e => setSDice(e.target.value)}
          />
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
          Save Weapon
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

export default StarcraftWeaponForm;
