/**
 * AddPaintsToRecipeModal.tsx — Pick one or more existing paints and add them to
 * a recipe in a single interaction. Stacks above the recipe editor so that
 * editor stays short.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@battleplans/ui';
import { CloseIcon, ExistingPaintPicker } from './paintPickerBits';
import { addRecipeItems } from '../hooks/useCollection';

export function AddPaintsToRecipeModal({ open, onClose, recipeId, startOrder, excludeIds, onAdded }: {
  open: boolean;
  onClose: () => void;
  recipeId: string;
  startOrder: number;
  excludeIds: number[];
  onAdded: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setSelectedIds([]); setSaving(false); } }, [open]);

  if (!open) return null;

  const toggle = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const add = async () => {
    if (!selectedIds.length) return;
    setSaving(true);
    await addRecipeItems(recipeId, selectedIds, startOrder);
    setSaving(false);
    onAdded();
    onClose();
  };

  const overlay = (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl max-h-[85vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-1 shrink-0">
          <h2 className="font-heading text-xl text-white">Add Paints</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-white"><CloseIcon /></button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          <ExistingPaintPicker selectedIds={selectedIds} onToggle={toggle} excludeIds={excludeIds} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" color="secondary" onClick={onClose}>Cancel</Button>
            <Button color="primary" disabled={!selectedIds.length || saving} loading={saving} onClick={add}>
              Add to Recipe{selectedIds.length ? ` (${selectedIds.length})` : ''}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
