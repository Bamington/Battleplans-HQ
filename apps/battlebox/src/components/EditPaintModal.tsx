/**
 * EditPaintModal.tsx — Edit a paint you created (name, brand, type, colour) and
 * its per-model note. Portalled above the model sheet. Only offered for paints
 * the user owns (library paints aren't editable).
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input } from '@battleplans/ui';
import { CloseIcon } from './paintPickerBits';
import { updatePaint, updateModelPaintNote } from '../hooks/useCollection';
import type { PaintRef } from '../hooks/useCollection';

export function EditPaintModal({ open, onClose, modelId, paint, onChanged }: {
  open: boolean;
  onClose: () => void;
  modelId: string | null;
  paint: PaintRef | null;
  onChanged: () => void;
}) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [type, setType] = useState<'Paint' | 'Spray'>('Paint');
  const [swatch, setSwatch] = useState('#8a8f98');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !paint) return;
    setName(paint.name);
    setBrand(paint.brand);
    setType(paint.type === 'Spray' ? 'Spray' : 'Paint');
    setSwatch(/^#[0-9a-fA-F]{6}$/.test(paint.swatch ?? '') ? paint.swatch! : '#8a8f98');
    setNote(paint.note ?? '');
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paint?.hobbyItemId]);

  if (!open || !paint) return null;

  const save = async () => {
    if (!modelId) return;
    setSaving(true);
    await updatePaint(paint.hobbyItemId, { name: name.trim(), brand: brand.trim(), type, swatch });
    await updateModelPaintNote(modelId, paint.hobbyItemId, note.trim() || null);
    setSaving(false);
    onChanged();
    onClose();
  };

  const overlay = (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl max-h-[85vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-1 shrink-0">
          <h2 className="font-heading text-xl text-white">Edit Paint</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-white"><CloseIcon /></button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <Input label="Paint Name" required value={name} onChange={e => setName(e.target.value)} />
          <Input label="Brand" required value={brand} onChange={e => setBrand(e.target.value)} />

          <div className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium text-white">Type</span>
            <div className="flex gap-2">
              {(['Paint', 'Spray'] as const).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`px-3 py-1.5 rounded-full font-body text-sm transition-colors ${type === t ? 'bg-primary-600 text-white' : 'border border-neutral-700 text-neutral-300 hover:bg-neutral-800'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium text-white">Colour</span>
            <div className="flex items-center gap-3">
              <input type="color" value={swatch} onChange={e => setSwatch(e.target.value)}
                className="w-10 h-10 rounded-lg bg-neutral-800 border border-neutral-700 cursor-pointer" />
              <span className="font-body text-sm text-neutral-400 tabular-nums">{swatch}</span>
            </div>
          </div>

          <Input size="sm" className="w-full" label="Note (optional)" placeholder="Where / how it's used…"
            value={note} onChange={e => setNote(e.target.value)} />

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" color="secondary" onClick={onClose}>Cancel</Button>
            <Button color="primary" disabled={name.trim() === '' || brand.trim() === '' || saving} loading={saving} onClick={save}>Save Paint</Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
