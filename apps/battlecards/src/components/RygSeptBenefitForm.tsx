import { useState } from 'react';
import Input from './Input';
import Button from './Button';
import CheckCircle from '@battleplans/ui';
import CloseCircle from '@battleplans/ui';
import type { AddonFormProps } from './AddAddonModal';
import type { RygSeptBenefitStats } from '../lib/database.types';

export interface RygSeptBenefitFormProps extends AddonFormProps {
  onSaveComplete?: (addonId: string) => void;
}

export default function RygSeptBenefitForm({ editingAddon, onSave, onCancel, saving, onSaveComplete }: RygSeptBenefitFormProps) {
  const s = (editingAddon?.stats ?? {}) as RygSeptBenefitStats;

  const [name,        setName]        = useState(editingAddon?.name ?? '');
  const [description, setDescription] = useState(editingAddon?.description ?? s.description ?? '');

  const isEditing = !!editingAddon;
  const canSave   = name.trim() !== '' && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    const addonId = await onSave(name.trim(), description.trim() || null, {});
    if (addonId) onSaveComplete?.(addonId);
  };

  return (
    <div className="p-5 flex flex-col gap-3">
      <h5 className="font-heading text-xl text-white">
        {isEditing ? 'Edit Sept Benefit' : 'Create Sept Benefit'}
      </h5>
      <p className="font-body text-sm text-gray-300">
        Once created, this benefit can be added to a sept card.
      </p>

      <Input
        label="Benefit Name"
        required
        placeholder="e.g. Blood Tithe"
        value={name}
        onChange={e => setName(e.target.value)}
      />

      <div>
        <label className="block text-sm font-medium font-body text-white mb-1">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe what this benefit does…"
          rows={4}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm
                     font-body text-white placeholder:text-gray-500
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     resize-y"
        />
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <Button
          leftIcon={<CheckCircle className="size-4" />}
          disabled={!canSave}
          loading={saving}
          onClick={handleSave}
        >
          {isEditing ? 'Update Benefit' : 'Save Benefit'}
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
    </div>
  );
}
