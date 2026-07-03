import { useState } from 'react';
import Input from './Input';
import Button from './Button';
import CheckCircle from '../icons/CheckCircle';
import CloseCircle from '../icons/CloseCircle';
import type { AddonFormProps } from './AddAddonModal';
import type { RygGodStats } from '../lib/database.types';

export interface RygGodFormProps extends AddonFormProps {
  onSaveComplete?: (addonId: string) => void;
}

export default function RygGodForm({ editingAddon, onSave, onCancel, saving, onSaveComplete }: RygGodFormProps) {
  const s = (editingAddon?.stats ?? {}) as RygGodStats;

  const [name,           setName]           = useState(editingAddon?.name ?? '');
  const [specialAbility, setSpecialAbility] = useState(s.specialAbility ?? '');
  const [minions,        setMinions]        = useState(s.minions        ?? '');
  const [servants,       setServants]       = useState(s.servants       ?? '');
  const [lieutenants,    setLieutenants]    = useState(s.lieutenants    ?? '');
  const [champions,      setChampions]      = useState(s.champions      ?? '');

  const isEditing = !!editingAddon;
  const canSave   = name.trim() !== '' && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    const stats: RygGodStats = {
      specialAbility: specialAbility.trim() || undefined,
      minions:        minions.trim()        || undefined,
      servants:       servants.trim()       || undefined,
      lieutenants:    lieutenants.trim()    || undefined,
      champions:      champions.trim()      || undefined,
    };
    const addonId = await onSave(name.trim(), null, stats as Record<string, unknown>);
    if (addonId) onSaveComplete?.(addonId);
  };

  return (
    <div className="p-5 flex flex-col gap-3">
      <h5 className="font-heading text-xl text-white">
        {isEditing ? 'Edit God' : 'Create God'}
      </h5>
      <p className="font-body text-sm text-gray-300">
        Once created, this god can be added to a RYG deck.
      </p>

      <Input
        label="God Name"
        required
        placeholder="e.g. Dakrim The Flowing Blood"
        value={name}
        onChange={e => setName(e.target.value)}
      />

      <div>
        <label className="block text-sm font-medium font-body text-white mb-1">Special Ability</label>
        <textarea
          value={specialAbility}
          onChange={e => setSpecialAbility(e.target.value)}
          placeholder="Describe the god's special ability…"
          rows={3}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm
                     font-body text-white placeholder:text-gray-500
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     resize-y"
        />
      </div>

      <p className="font-body text-base font-bold text-gray-100">Tier Benefits</p>

      {(
        [
          { label: 'Minions',     value: minions,     set: setMinions     },
          { label: 'Servants',    value: servants,    set: setServants    },
          { label: 'Lieutenants', value: lieutenants, set: setLieutenants },
          { label: 'Champions',   value: champions,   set: setChampions   },
        ] as const
      ).map(({ label, value, set }) => (
        <div key={label}>
          <label className="block text-sm font-medium font-body text-white mb-1">{label}</label>
          <textarea
            value={value}
            onChange={e => (set as (v: string) => void)(e.target.value)}
            placeholder={`Benefit for ${label.toLowerCase()}…`}
            rows={2}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm
                       font-body text-white placeholder:text-gray-500
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       resize-y"
          />
        </div>
      ))}

      <div className="flex items-center gap-1 flex-wrap">
        <Button
          leftIcon={<CheckCircle className="size-4" />}
          disabled={!canSave}
          loading={saving}
          onClick={handleSave}
        >
          {isEditing ? 'Update God' : 'Save God'}
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
