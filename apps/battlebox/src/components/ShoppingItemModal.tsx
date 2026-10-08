/**
 * ShoppingItemModal.tsx — Edit a shopping list item: its title, type
 * (Box/Model, Paint, Other), notes and one optional photo (upload, or "Find a photo online" searching for the title).
 * Items are created from the column's quick-add field by name alone; this is
 * where the details go.
 *
 * Title and notes save with Save. The photo, like every photo editor in the
 * app, saves the moment it changes. Delete is confirmed first.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input } from '@battleplans/ui';
import { CloseIcon } from './paintPickerBits';
import { ImageEditor } from './ImageEditor';
import { ConfirmDialog } from './ConfirmDialog';
import { Chip } from './filterControls';
import { updateShoppingItem, SHOPPING_CATEGORIES } from '../hooks/useShoppingList';
import type { ShoppingItem, ShoppingCategory } from '../hooks/useShoppingList';

export function ShoppingItemModal({ item, onClose, onChanged, onDelete }: {
  /** The item to edit; null closes the modal. */
  item: ShoppingItem | null;
  onClose: () => void;
  /** Something saved (details or photo) — refresh the list. */
  onChanged: () => void;
  onDelete: (item: ShoppingItem) => Promise<void> | void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ShoppingCategory>('other');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!item) return;
    setTitle(item.title); setCategory(item.category); setNotes(item.notes ?? '');
    setSaving(false); setError(null); setConfirmDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (!item) return null;

  const save = async () => {
    setSaving(true); setError(null);
    const { error: err } = await updateShoppingItem(item.id, { title: title.trim(), category, notes: notes.trim() || null });
    setSaving(false);
    if (err) { setError('Could not save. Please try again.'); return; }
    onChanged();
    onClose();
  };

  const overlay = (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl max-h-[85vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-1 shrink-0">
          <h2 className="font-heading text-xl text-white">Shopping List Item</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-white"><CloseIcon /></button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <Input label="Title" required value={title} onChange={e => setTitle(e.target.value)} />

          <div className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium text-white">Type</span>
            <div className="flex flex-wrap gap-2">
              {SHOPPING_CATEGORIES.map(c => (
                <Chip key={c.value} label={c.label} selected={category === c.value} onClick={() => setCategory(c.value)} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium text-white">Notes</span>
            <textarea rows={4} placeholder="Where to get it, price, which colour…" value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 font-body text-sm text-white placeholder-neutral-500 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          <ImageEditor kind="shopping" id={item.id} max={1} searchQuery={title.trim()} onChanged={onChanged} />

          {error && <p className="font-body text-sm text-red-400">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <Button variant="ghost" color="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
            <div className="flex-1" />
            <Button variant="ghost" color="secondary" onClick={onClose}>Cancel</Button>
            <Button color="primary" disabled={title.trim() === '' || saving} loading={saving} onClick={save}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      {overlay}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete item?"
        message={`Remove “${item.title}” from your shopping list?`}
        confirmLabel="Delete"
        onConfirm={async () => { setConfirmDelete(false); await onDelete(item); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>,
    document.body,
  );
}
