import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Input from './Input';
import Button from './Button';
import HR from './HR';
import AddAddonModal from './AddAddonModal';
import CheckCircle from '../icons/CheckCircle';
import CloseCircle from '../icons/CloseCircle';
import AddCircle from '../icons/AddCircle';
import type { AddonFormProps } from './AddAddonModal';
import type { RygSeptStats } from '../lib/database.types';
import RygSeptBenefitForm from './RygSeptBenefitForm';

interface AttachedBenefit {
  id:          string;
  name:        string;
  description: string;
}

export interface RygSeptFormProps extends AddonFormProps {
  onSaveComplete?:  (addonId: string) => void;
  onPendingTalents?: (benefits: AttachedBenefit[]) => void;
}

export default function RygSeptForm({
  editingAddon,
  onSave,
  onCancel,
  saving,
  onSaveComplete,
  onPendingTalents,
}: RygSeptFormProps) {
  const s = (editingAddon?.stats ?? {}) as RygSeptStats;

  const [name,       setName]       = useState(editingAddon?.name ?? '');
  const [prohibited, setProhibited] = useState(s.prohibited ?? '');
  const [required,   setRequired]   = useState(s.required   ?? '');
  const [restricted, setRestricted] = useState(s.restricted ?? '');

  const [attachedBenefits, setAttachedBenefits] = useState<AttachedBenefit[]>([]);
  const [benefitModalOpen, setBenefitModalOpen] = useState(false);

  const isEditing = !!editingAddon;
  const canSave   = name.trim() !== '' && !saving;

  // When editing, load stored benefit addons by their IDs
  useEffect(() => {
    if (!editingAddon) return;
    const ids = (editingAddon.stats as RygSeptStats)?.benefitIds ?? [];
    if (!ids.length) return;
    let cancelled = false;
    supabase
      .from('addons')
      .select('id, name, description')
      .in('id', ids)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const byId = new Map(data.map(a => [a.id, a]));
        setAttachedBenefits(
          ids
            .filter(id => byId.has(id))
            .map(id => {
              const a = byId.get(id)!;
              return { id: a.id, name: a.name, description: a.description ?? '' };
            }),
        );
      });
    return () => { cancelled = true; };
  }, [editingAddon]);

  const handleSave = async () => {
    if (!canSave) return;
    if (!isEditing) onPendingTalents?.(attachedBenefits);
    try {
      const stats: RygSeptStats = {
        prohibited: prohibited.trim() || undefined,
        required:   required.trim()   || undefined,
        restricted: restricted.trim() || undefined,
        benefitIds:   attachedBenefits.map(b => b.id),
        benefitNames: attachedBenefits.map(b => b.name),
      };
      const addonId = await onSave(name.trim(), null, stats as Record<string, unknown>);
      if (addonId) onSaveComplete?.(addonId);
    } finally {
      onPendingTalents?.([]);
    }
  };

  return (
    <div className="p-5 flex flex-col gap-3">
      <h5 className="font-heading text-xl text-white">
        {isEditing ? 'Edit Sept' : 'Create Sept'}
      </h5>
      <p className="font-body text-sm text-gray-300">
        Once created, this sept can be added to a RYG deck.
      </p>

      <Input
        label="Sept Name"
        required
        placeholder="e.g. Decapitation"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <Input
        label="Prohibited"
        placeholder="What warriors in this sept may not do…"
        value={prohibited}
        onChange={e => setProhibited(e.target.value)}
      />
      <Input
        label="Required"
        placeholder="What warriors in this sept must do…"
        value={required}
        onChange={e => setRequired(e.target.value)}
      />
      <Input
        label="Restricted"
        placeholder="What warriors in this sept are restricted from…"
        value={restricted}
        onChange={e => setRestricted(e.target.value)}
      />

      <HR className="!my-0" />

      {/* ── Sept Benefits ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="font-body text-base font-bold text-gray-100">Sept Benefits</p>
        {attachedBenefits.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {attachedBenefits.map(b => (
              <div
                key={b.id}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
              >
                <p className="font-body text-sm font-medium text-gray-200 flex-1 min-w-0 truncate">
                  {b.name}
                </p>
                <button
                  type="button"
                  aria-label={`Remove ${b.name}`}
                  onClick={() => setAttachedBenefits(prev => prev.filter(x => x.id !== b.id))}
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
          onClick={() => setBenefitModalOpen(true)}
        >
          Add Benefit
        </Button>
      </div>

      <HR className="!my-0" />

      <div className="flex items-center gap-1 flex-wrap">
        <Button
          leftIcon={<CheckCircle className="size-4" />}
          disabled={!canSave}
          loading={saving}
          onClick={handleSave}
        >
          {isEditing ? 'Update Sept' : 'Save Sept'}
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

      {/* Nested benefit picker */}
      {benefitModalOpen && (
        <AddAddonModal
          open
          gameSlug="ryg"
          addonTypeSlug="sept-benefits"
          addonTypeName="Sept Benefit"
          excludeAddonIds={attachedBenefits.map(b => b.id)}
          onClose={() => setBenefitModalOpen(false)}
          onAdd={addon => {
            setAttachedBenefits(prev => [
              ...prev,
              { id: addon.id, name: addon.name, description: addon.description ?? '' },
            ]);
            setBenefitModalOpen(false);
          }}
          onDeleted={id => setAttachedBenefits(prev => prev.filter(b => b.id !== id))}
          getSubtitle={a =>
            a.description
              ? a.description.slice(0, 60) + (a.description.length > 60 ? '…' : '')
              : '—'
          }
          CreateFormComponent={RygSeptBenefitForm}
        />
      )}
    </div>
  );
}
