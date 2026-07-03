/**
 * StarcraftSupplyTiersModal.tsx — Add / edit a unit's Models-per-Supply
 * tiers (Figma node 815:19345).
 *
 * One row per tier:
 *   • "Tier N" label
 *   • Supply Cost — required Counter
 *   • Models (Maximum) — required Counter
 *
 * Validation is enforced by the Counter `min` props and a cascade pass on
 * every change: each tier's lower bound is derived from the previous tier
 * (Tier 0: supply min 0, models min 1; Tier N: prev.supply + 1 / prev.max + 1).
 * If editing an earlier tier would invalidate a later tier, the later
 * tier is silently bumped up — never invalid.
 *
 * Footer:
 *   • Add Supply Tier (outline-blue) — disabled at 3 tiers
 *   • Remove Last Tier (outline-danger, trash icon) — disabled at 1 tier
 *   • Cancel — discards
 *   • Save Supply Costs — commits via onSave
 *
 * USAGE:
 *   <StarcraftSupplyTiersModal
 *     open={open}
 *     tiers={card.supplyTiers}
 *     onSave={tiers => updateActive({ supplyTiers: tiers })}
 *     onClose={() => setOpen(false)}
 *   />
 */

import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Counter from './Counter';
import HR from './HR';
import AddCircle from '../icons/AddCircle';
import CheckCircle from '../icons/CheckCircle';
import CloseCircle from '../icons/CloseCircle';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';
import type { StarcraftSupplyTier } from './StarcraftCard';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_TIERS = 3;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Lowest legal supply for tier `i` given the current draft. */
const minSupplyFor = (tiers: StarcraftSupplyTier[], i: number): number =>
  i === 0 ? 0 : tiers[i - 1].supply + 1;

/** Lowest legal maxModels for tier `i` given the current draft. */
const minMaxModelsFor = (tiers: StarcraftSupplyTier[], i: number): number =>
  i === 0 ? 1 : tiers[i - 1].maxModels + 1;

/**
 * Walk the draft and clamp any tier whose `supply` or `maxModels` falls
 * below the per-position minimum, cascading the bumps. Returns a fresh
 * array — does not mutate the input.
 */
const cascadeClamp = (tiers: StarcraftSupplyTier[]): StarcraftSupplyTier[] => {
  const out: StarcraftSupplyTier[] = [];
  for (let i = 0; i < tiers.length; i++) {
    const minS = i === 0 ? 0 : out[i - 1].supply + 1;
    const minM = i === 0 ? 1 : out[i - 1].maxModels + 1;
    out.push({
      supply:    Math.max(tiers[i].supply,    minS),
      maxModels: Math.max(tiers[i].maxModels, minM),
    });
  }
  return out;
};

/** Build a fresh tier appended after the last existing one. */
const buildNextTier = (tiers: StarcraftSupplyTier[]): StarcraftSupplyTier => {
  if (tiers.length === 0) return { supply: 0, maxModels: 1 };
  const last = tiers[tiers.length - 1];
  return { supply: last.supply + 1, maxModels: last.maxModels + 1 };
};

// ── Props ────────────────────────────────────────────────────────────────────

export interface StarcraftSupplyTiersModalProps {
  open:    boolean;
  /** Tiers currently saved on the card — pre-populates the form. */
  tiers:   StarcraftSupplyTier[];
  /** Called with the new tier list on save. */
  onSave:  (tiers: StarcraftSupplyTier[]) => void;
  onClose: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * Outer wrapper renders the Modal shell unconditionally; the inner Body is
 * keyed by `open` so it remounts (and re-seeds its `useState` initial
 * function) every time the modal opens — no set-state-in-effect needed.
 */
const StarcraftSupplyTiersModal = ({ open, tiers, onSave, onClose }: StarcraftSupplyTiersModalProps) => (
  <Modal open={open} onClose={onClose} className="max-w-xl">
    {open && <Body tiers={tiers} onSave={onSave} onClose={onClose} />}
  </Modal>
);

const Body = ({
  tiers,
  onSave,
  onClose,
}: Omit<StarcraftSupplyTiersModalProps, 'open'>) => {
  const [draft, setDraft] = useState<StarcraftSupplyTier[]>(() =>
    tiers.length === 0 ? [{ supply: 0, maxModels: 1 }] : tiers.map(t => ({ ...t })),
  );

  const updateTier = (i: number, patch: Partial<StarcraftSupplyTier>) => {
    setDraft(prev => cascadeClamp(prev.map((t, idx) => idx === i ? { ...t, ...patch } : t)));
  };

  const addTier = () => {
    setDraft(prev => prev.length >= MAX_TIERS ? prev : [...prev, buildNextTier(prev)]);
  };

  const removeLastTier = () => {
    setDraft(prev => prev.length <= 1 ? prev : prev.slice(0, -1));
  };

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div className="p-5 flex flex-col gap-3">

      <h5 className="font-heading text-xl text-white">Add Supply Costs</h5>

      {draft.map((tier, i) => (
          <div key={i} className="flex flex-col gap-2">
            <p className="font-body text-base font-bold text-gray-100">
              Tier {i + 1}
            </p>
            <div className="flex gap-6">
              <Counter
                label="Supply Cost"
                required
                min={minSupplyFor(draft, i)}
                value={tier.supply}
                onChange={v => updateTier(i, { supply: v })}
              />
              <Counter
                label="Models (Maximum)"
                required
                min={minMaxModelsFor(draft, i)}
                value={tier.maxModels}
                onChange={v => updateTier(i, { maxModels: v })}
              />
            </div>
            {i < draft.length - 1 && <HR className="!my-1" />}
          </div>
        ))}

        <HR className="!my-1" />

        {/* Add / Remove tier row */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            color="primary"
            size="sm"
            leftIcon={<AddCircle className="w-4 h-4" />}
            disabled={draft.length >= MAX_TIERS}
            onClick={addTier}
          >
            Add Supply Tier
          </Button>
          <Button
            variant="outline"
            color="danger"
            size="sm"
            leftIcon={<TrashBinMinimalistic className="w-4 h-4" />}
            disabled={draft.length <= 1}
            onClick={removeLastTier}
          >
            Remove Last Tier
          </Button>
        </div>

        {/* Cancel / Save */}
        <div className="flex items-center justify-end gap-1 pt-1">
          <Button
            variant="ghost"
            color="danger"
            leftIcon={<CloseCircle className="size-4" />}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            leftIcon={<CheckCircle className="size-4" />}
            onClick={handleSave}
          >
            Save Supply Costs
          </Button>
        </div>

    </div>
  );
};

export default StarcraftSupplyTiersModal;
