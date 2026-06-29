import { useState } from 'react';
import Input from './Input';
import Button from './Button';
import CheckCircle from '../icons/CheckCircle';
import CloseCircle from '../icons/CloseCircle';
import type { AddonFormProps } from './AddAddonModal';

export interface RygTalentFormProps extends AddonFormProps {
  onSaveComplete?: (addonId: string) => void;
}
import type { RygTalentStats, RygTalentParamField } from '../lib/database.types';

export default function RygTalentForm({ editingAddon, onSave, onCancel, saving, onSaveComplete }: RygTalentFormProps) {
  const s = (editingAddon?.stats ?? {}) as RygTalentStats;
  const existingParam = s.paramsSchema?.[0];

  const [name,          setName]          = useState(editingAddon?.name ?? '');
  const [desc,          setDesc]          = useState(editingAddon?.description ?? '');
  const [prerequisites, setPrerequisites] = useState(s.prerequisites ?? '');
  const [repeatable,    setRepeatable]    = useState(s.repeatable ?? false);
  const [hasParams,     setHasParams]     = useState(!!existingParam);
  const [paramLabel,     setParamLabel]     = useState(existingParam?.label ?? '');
  const [paramOptions,   setParamOptions]   = useState<string[]>(existingParam?.options ?? []);
  const [maxSelections,  setMaxSelections]  = useState<number | ''>(existingParam?.maxSelections ?? '');
  const [optionInput,    setOptionInput]    = useState('');

  const isEditing = !!editingAddon;

  function addOption() {
    const val = optionInput.trim();
    if (val && !paramOptions.includes(val)) {
      setParamOptions(prev => [...prev, val]);
    }
    setOptionInput('');
  }

  function removeOption(opt: string) {
    setParamOptions(prev => prev.filter(o => o !== opt));
  }

  function handleOptionKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addOption();
    }
  }

  function buildStats(): RygTalentStats {
    const stats: RygTalentStats = {
      prerequisites: prerequisites.trim() || undefined,
      repeatable,
    };
    if (hasParams && paramLabel.trim() && paramOptions.length > 0) {
      const field: RygTalentParamField = { key: 'type', label: paramLabel.trim(), options: paramOptions };
      if (typeof maxSelections === 'number' && maxSelections > 0) field.maxSelections = maxSelections;
      stats.paramsSchema = [field];
    }
    return stats;
  }

  const canSave = !!name.trim() && !saving &&
    (!hasParams || (paramLabel.trim().length > 0 && paramOptions.length > 0));

  async function handleSave() {
    if (!canSave) return;
    const addonId = await onSave(name.trim(), desc.trim() || null, buildStats() as Record<string, unknown>);
    if (addonId) onSaveComplete?.(addonId);
  }

  return (
    <div className="p-5 flex flex-col gap-3">
      <h5 className="font-heading text-xl text-white">
        {isEditing ? 'Edit Talent' : 'Create Talent'}
      </h5>
      <p className="font-body text-sm text-gray-300">
        Once created, this talent can be assigned to warrior types and warriors.
      </p>

      <Input
        label="Talent Name"
        required
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Bloodrage"
      />

      <div>
        <label className="block text-sm font-medium font-body text-white mb-1">
          Description
        </label>
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Describe what this talent does…"
          rows={4}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm
                     font-body text-white placeholder:text-gray-500
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     resize-y"
        />
      </div>

      <Input
        label="Prerequisites"
        value={prerequisites}
        onChange={e => setPrerequisites(e.target.value)}
        placeholder="e.g. Defense 4 and Fate 4"
      />

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div
          role="checkbox"
          aria-checked={repeatable}
          onClick={() => setRepeatable(r => !r)}
          className={`relative w-10 h-6 rounded-full transition-colors ${repeatable ? 'bg-blue-600' : 'bg-gray-600'}`}
        >
          <span
            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${repeatable ? 'translate-x-4' : 'translate-x-0'}`}
          />
        </div>
        <span className="font-body text-sm text-gray-200">Repeatable</span>
      </label>

      <div className="border border-gray-700 rounded-lg p-3 flex flex-col gap-3">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            role="checkbox"
            aria-checked={hasParams}
            onClick={() => setHasParams(p => !p)}
            className={`relative w-10 h-6 rounded-full transition-colors ${hasParams ? 'bg-blue-600' : 'bg-gray-600'}`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${hasParams ? 'translate-x-4' : 'translate-x-0'}`}
            />
          </div>
          <span className="font-body text-sm text-gray-200">Requires a selection when assigned to a warrior</span>
        </label>

        {hasParams && (
          <div className="flex flex-col gap-3 pl-1">
            <Input
              label="Selection Label"
              value={paramLabel}
              onChange={e => setParamLabel(e.target.value)}
              placeholder="e.g. Magic Type"
            />

            <div>
              <label className="block text-sm font-medium font-body text-white mb-1">Options</label>
              <div className="flex gap-2">
                <input
                  value={optionInput}
                  onChange={e => setOptionInput(e.target.value)}
                  onKeyDown={handleOptionKeyDown}
                  placeholder="e.g. Sorcery"
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm
                             font-body text-white placeholder:text-gray-500
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Button variant="ghost" onClick={addOption} disabled={!optionInput.trim()}>
                  Add
                </Button>
              </div>
              {paramOptions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {paramOptions.map(opt => (
                    <span
                      key={opt}
                      className="flex items-center gap-1 bg-gray-700 text-gray-200 text-sm font-body rounded-full px-3 py-1"
                    >
                      {opt}
                      <button
                        onClick={() => removeOption(opt)}
                        className="text-gray-400 hover:text-red-400 ml-1 leading-none"
                        aria-label={`Remove ${opt}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {paramOptions.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">Add at least one option.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium font-body text-white mb-1">
                Max selections
              </label>
              <input
                type="number"
                min={1}
                value={maxSelections}
                onChange={e => setMaxSelections(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10)))}
                placeholder="No limit"
                className="w-32 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm
                           font-body text-white placeholder:text-gray-500
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty to allow any number.</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <Button
          leftIcon={<CheckCircle className="size-4" />}
          disabled={!canSave}
          loading={saving}
          onClick={handleSave}
        >
          {isEditing ? 'Update Talent' : 'Save Talent'}
        </Button>
        <Button variant="ghost" color="danger" leftIcon={<CloseCircle className="size-4" />} onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
