/**
 * RygSimpleAddonForm.tsx — Generic name + (cost) + description form for RYG addons
 *
 * Used for: Armor, Items — addons that need a name, optional cost (GP),
 * and a description, but no keywords or stats.
 */

import { useState } from 'react';
import Input from './Input';
import Counter from './Counter';
import Button from './Button';
import HR from './HR';
import CheckCircle from '../icons/CheckCircle';
import CloseCircle from '../icons/CloseCircle';
import type { AddonFormProps } from './AddAddonModal';

interface RygSimpleAddonFormProps extends AddonFormProps {
  namePlaceholder?: string;
  descPlaceholder?: string;
  saveLabel?:       string;
  /** When true, shows a Cost (GP) counter that saves into addon stats. */
  showCost?:        boolean;
  /** Fired after the addon is saved. Used by the pack editor to copy the
   *  new addon into the pack. */
  onSaveComplete?:  (addonId: string) => void;
}

export default function RygSimpleAddonForm({
  editingAddon,
  onSave,
  onCancel,
  saving,
  namePlaceholder = 'Name',
  descPlaceholder = 'Description',
  saveLabel       = 'Save',
  showCost        = false,
  onSaveComplete,
}: RygSimpleAddonFormProps) {
  const s = (editingAddon?.stats ?? {}) as Record<string, unknown>;

  const [name, setName]         = useState(editingAddon?.name ?? '');
  const [description, setDesc]  = useState(editingAddon?.description ?? '');
  const [cost, setCost]         = useState<number>(typeof s.cost === 'number' ? s.cost : 0);

  const isEditing = !!editingAddon;

  const handleSave = async () => {
    const addonId = await onSave(name.trim(), description.trim() || null, showCost ? { cost } : {});
    if (addonId) onSaveComplete?.(addonId);
  };

  return (
    <div className="p-5 flex flex-col gap-3">
      <h5 className="font-heading text-xl text-white">
        {isEditing ? `Edit ${saveLabel.replace('Save ', '')}` : saveLabel.replace('Save ', 'Create ')}
      </h5>
      <p className="font-body text-sm text-gray-300">
        Once created, you can add this to warriors from the same game.
      </p>

      <div className="flex flex-col gap-2">
        <p className="font-body text-base font-bold text-gray-100">Details</p>

        <Input
          label="Name"
          required
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={namePlaceholder}
        />

        {showCost && (
          <Counter label="Cost (GP)" value={cost} onChange={setCost} min={0} max={9999} />
        )}

        <div>
          <label className="block text-sm font-medium font-body text-white mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={e => setDesc(e.target.value)}
            placeholder={descPlaceholder}
            rows={4}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm
                       font-body text-white placeholder:text-gray-500
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       resize-y"
          />
        </div>
      </div>

      <HR className="!my-0" />

      <div className="flex items-center gap-1 flex-wrap">
        <Button
          leftIcon={<CheckCircle className="size-4" />}
          disabled={!name.trim() || saving}
          loading={saving}
          onClick={handleSave}
        >
          {saveLabel}
        </Button>
        <Button variant="ghost" color="danger" leftIcon={<CloseCircle className="size-4" />} onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
