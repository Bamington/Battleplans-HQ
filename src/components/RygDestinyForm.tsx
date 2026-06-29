import { useState } from 'react';
import Input from './Input';
import Button from './Button';
import CheckCircle from '../icons/CheckCircle';
import CloseCircle from '../icons/CloseCircle';
import type { AddonFormProps } from './AddAddonModal';
import type { RygDestinyStats } from '../lib/database.types';

export interface RygDestinyFormProps extends AddonFormProps {
  onSaveComplete?: (addonId: string) => void;
}

export default function RygDestinyForm({ editingAddon, onSave, onCancel, saving, onSaveComplete }: RygDestinyFormProps) {
  const s = (editingAddon?.stats ?? {}) as RygDestinyStats;

  const [name,        setName]        = useState(editingAddon?.name ?? '');
  const [description, setDescription] = useState(s.description ?? '');
  const [curse,       setCurse]       = useState(s.curse       ?? '');

  const isEditing = !!editingAddon;
  const canSave   = name.trim() !== '' && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    const stats: RygDestinyStats = {
      description: description.trim() || undefined,
      curse:       curse.trim()       || undefined,
    };
    const addonId = await onSave(name.trim(), null, stats as Record<string, unknown>);
    if (addonId) onSaveComplete?.(addonId);
  };

  return (
    <div className="p-5 flex flex-col gap-3">
      <h5 className="font-heading text-xl text-white">
        {isEditing ? 'Edit Destiny' : 'Create Destiny'}
      </h5>
      <p className="font-body text-sm text-gray-300">
        Once created, this destiny can be added to a sept card.
      </p>

      <Input
        label="Destiny Name"
        required
        placeholder="e.g. Unbreakable Body"
        value={name}
        onChange={e => setName(e.target.value)}
      />

      <div>
        <label className="block text-sm font-medium font-body text-white mb-1">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe the destiny goal…"
          rows={4}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm
                     font-body text-white placeholder:text-gray-500
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     resize-y"
        />
      </div>

      <div>
        <label className="block text-sm font-medium font-body text-white mb-1">Curse</label>
        <textarea
          value={curse}
          onChange={e => setCurse(e.target.value)}
          placeholder="What happens if the destiny is failed…"
          rows={3}
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
          {isEditing ? 'Update Destiny' : 'Save Destiny'}
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
