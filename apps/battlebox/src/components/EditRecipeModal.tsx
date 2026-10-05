/**
 * EditRecipeModal.tsx — Edit a recipe you own: name, description, its paints
 * (add/remove) and its photos. Portalled above the model sheet. Recipes are
 * reusable, so edits here affect every model that uses the recipe.
 *
 * Two optional extras, used when it's opened from the Recipes column rather
 * than from inside a model:
 *   - `models` lists the models that use the recipe (tap one to open it)
 *   - `onDelete` adds a Delete Recipe action, confirmed first
 *
 * With `recipe` null and `onCreate` given it's a Create form instead — name
 * and description only. The caller creates the row and passes the new recipe
 * back in, and the form carries on as the full editor (paints and photos need
 * the row's id).
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input, AddCircle } from '@battleplans/ui';
import { CloseIcon } from './paintPickerBits';
import { AddPaintsToRecipeModal } from './AddPaintsToRecipeModal';
import { ImageEditor } from './ImageEditor';
import { ModelItem } from './ModelItem';
import { ConfirmDialog } from './ConfirmDialog';
import { updateRecipe, removeRecipeItem } from '../hooks/useCollection';
import type { ModelRecipeGroup, CollectionModel } from '../hooks/useCollection';

const HEX = /^#[0-9a-fA-F]{6}$/;

const RemoveIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
);

function deleteMessage(name: string, modelCount: number): string {
  const usedOn = modelCount === 0 ? ''
    : modelCount === 1 ? ' It will be removed from the 1 model that uses it.'
    : ` It will be removed from all ${modelCount} models that use it.`;
  return `Delete “${name}”?${usedOn} The paints themselves stay in your library.`;
}

export function EditRecipeModal({ open, onClose, recipe, onChanged, models, onOpenModel, onDelete, onCreate }: {
  open: boolean;
  onClose: () => void;
  recipe: ModelRecipeGroup | null;
  onChanged: () => void;
  /** Models using this recipe — shown as a "Used on" list when given. */
  models?: CollectionModel[];
  onOpenModel?: (id: string) => void;
  /** Delete the recipe from the library. Shows a Delete action when given. */
  onDelete?: () => Promise<void> | void;
  /** Create mode (recipe is null): save the name/description as a new recipe. */
  onCreate?: (fields: { name: string; description: string | null }) => Promise<boolean>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const creating = !recipe && !!onCreate;

  // Reset when opened, and again when a just-created recipe arrives — but keep
  // what was typed, since that's what the new row was saved with.
  useEffect(() => {
    if (!open) return;
    if (recipe) {
      setName(recipe.name);
      setDescription(recipe.description ?? '');
    } else {
      setName(''); setDescription('');
    }
    setSaving(false); setAddOpen(false); setConfirmDelete(false); setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipe?.id]);

  if (!open || (!recipe && !creating)) return null;

  const fields = () => ({ name: name.trim(), description: description.trim() || null });

  const create = async () => {
    if (!onCreate) return;
    setSaving(true); setError(null);
    const ok = await onCreate(fields());
    // On success stay busy: the form turns into the editor once the new row
    // loads (the reset effect clears `saving`), and a second click meanwhile
    // would create a duplicate.
    if (!ok) { setSaving(false); setError('Could not create the recipe. Please try again.'); }
  };

  const save = async () => {
    if (!recipe) return;
    setSaving(true);
    await updateRecipe(recipe.id, fields());
    setSaving(false);
    onChanged();
    onClose();
  };

  const removePaint = async (hobbyItemId: number) => {
    if (!recipe) return;
    await removeRecipeItem(recipe.id, hobbyItemId);
    onChanged();
  };

  const doDelete = async () => {
    setConfirmDelete(false);
    await onDelete?.();
  };

  const overlay = (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl max-h-[85vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-1 shrink-0">
          <h2 className="font-heading text-xl text-white">{creating ? 'Add Recipe' : 'Edit Recipe'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-white"><CloseIcon /></button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <Input label="Recipe Name" required placeholder="e.g. Ultramarine Blue Armour" value={name} onChange={e => setName(e.target.value)} />

          <div className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium text-white">Description</span>
            <textarea rows={3} placeholder="How to paint it…" value={description} onChange={e => setDescription(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 font-body text-sm text-white placeholder-neutral-500 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          {recipe && (
            <>
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

              <ImageEditor kind="recipe" id={recipe.id} onChanged={onChanged} />

              {models && (
                <div className="flex flex-col gap-1.5">
                  <span className="font-body text-sm font-medium text-white">Used On</span>
                  {models.length === 0 ? (
                    <p className="font-body text-sm text-neutral-500 py-1">Not used on any models yet. Add it from a model's Painting tab.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {models.map(m => (
                        <ModelItem key={m.id} model={m} onClick={onOpenModel ? () => onOpenModel(m.id) : undefined} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {error && <p className="font-body text-sm text-red-400">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            {recipe && onDelete && (
              <Button variant="ghost" color="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
            )}
            <div className="flex-1" />
            <Button variant="ghost" color="secondary" onClick={onClose}>{creating ? 'Cancel' : 'Close'}</Button>
            {creating ? (
              <Button color="primary" disabled={name.trim() === '' || saving} loading={saving} onClick={create}>Create Recipe</Button>
            ) : (
              <Button color="primary" disabled={name.trim() === '' || saving} loading={saving} onClick={save}>Save Recipe</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      {overlay}
      {recipe && (
        <AddPaintsToRecipeModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          recipeId={recipe.id}
          startOrder={recipe.paints.length}
          excludeIds={recipe.paints.map(p => p.hobbyItemId)}
          onAdded={onChanged}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete recipe?"
        message={recipe ? deleteMessage(recipe.name, models?.length ?? 0) : undefined}
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>,
    document.body,
  );
}
