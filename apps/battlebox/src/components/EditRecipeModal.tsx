/**
 * EditRecipeModal.tsx — Edit a recipe you own: name, description, and its
 * paints (add/remove). Portalled above the model sheet. Recipes are reusable,
 * so edits here affect every model that uses the recipe.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input, AddCircle } from '@battleplans/ui';
import { CloseIcon } from './paintPickerBits';
import { AddPaintsToRecipeModal } from './AddPaintsToRecipeModal';
import { updateRecipe, removeRecipeItem } from '../hooks/useCollection';
import type { ModelRecipeGroup } from '../hooks/useCollection';

const HEX = /^#[0-9a-fA-F]{6}$/;

const RemoveIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
);

export function EditRecipeModal({ open, onClose, recipe, onChanged }: {
  open: boolean;
  onClose: () => void;
  recipe: ModelRecipeGroup | null;
  onChanged: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (!open || !recipe) return;
    setName(recipe.name);
    setDescription(recipe.description ?? '');
    setSaving(false); setAddOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipe?.id]);

  if (!open || !recipe) return null;

  const excludeIds = recipe.paints.map(p => p.hobbyItemId);

  const removePaint = async (hobbyItemId: number) => {
    await removeRecipeItem(recipe.id, hobbyItemId);
    onChanged();
  };
  const save = async () => {
    setSaving(true);
    await updateRecipe(recipe.id, { name: name.trim(), description: description.trim() || null });
    setSaving(false);
    onChanged();
    onClose();
  };

  const overlay = (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl max-h-[85vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-1 shrink-0">
          <h2 className="font-heading text-xl text-white">Edit Recipe</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-white"><CloseIcon /></button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <Input label="Recipe Name" required value={name} onChange={e => setName(e.target.value)} />

          <div className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium text-white">Description</span>
            <textarea rows={3} placeholder="How to paint it…" value={description} onChange={e => setDescription(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 font-body text-sm text-white placeholder-neutral-500 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium text-white">Paints</span>
            {recipe.paints.length === 0 ? (
              <p className="font-body text-sm text-neutral-500 py-1">No paints in this recipe yet.</p>
            ) : (
              <div className="bg-neutral-900 border border-neutral-700 rounded-lg divide-y divide-neutral-800">
                {recipe.paints.map(p => (
                  <div key={p.hobbyItemId} className="flex items-center gap-2.5 px-3 py-2.5">
                    <span className="w-4 h-4 rounded-full shrink-0 border border-neutral-600"
                      style={HEX.test(p.swatch ?? '') ? { backgroundColor: p.swatch! } : undefined} aria-hidden="true" />
                    <span className="flex-1 min-w-0 font-body text-sm text-white truncate">{p.name}</span>
                    <span className="font-body text-xs text-neutral-400 shrink-0">{p.brand}</span>
                    <button type="button" onClick={() => removePaint(p.hobbyItemId)} aria-label={`Remove ${p.name}`} className="shrink-0 text-neutral-500 hover:text-red-400"><RemoveIcon /></button>
                  </div>
                ))}
              </div>
            )}

            <button type="button" onClick={() => setAddOpen(true)} className="self-start flex items-center gap-1.5 font-body text-sm font-medium text-primary-500 hover:text-primary-400">
              <AddCircle className="w-4 h-4" /> Add Paint
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" color="secondary" onClick={onClose}>Cancel</Button>
            <Button color="primary" disabled={name.trim() === '' || saving} loading={saving} onClick={save}>Save Recipe</Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      {overlay}
      <AddPaintsToRecipeModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        recipeId={recipe.id}
        startOrder={recipe.paints.length}
        excludeIds={excludeIds}
        onAdded={onChanged}
      />
    </>,
    document.body,
  );
}
