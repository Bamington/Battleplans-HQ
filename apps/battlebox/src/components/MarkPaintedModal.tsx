/**
 * MarkPaintedModal.tsx — Finish a Painting Desk model. Doubles as the
 * confirmation: shows the painted date (today, changeable) and an optional
 * photo of the finished model. Confirming sets Painted with that date, saves
 * the photo as the new cover (it's the user's own, not a progress photo), and
 * takes the model off the desk.
 */

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@battleplans/ui';
import { CloseIcon, TrashIcon, PlusIcon } from './paintPickerBits';
import { markDeskModelPainted, todayISO } from '../hooks/useCollection';

export function MarkPaintedModal({ model, userId, onClose, onDone }: {
  /** The model being finished; null closes the modal. */
  model: { id: string; name: string } | null;
  userId: string | null;
  onClose: () => void;
  /** Saved — refresh the desk and the model lists. */
  onDone: () => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fresh each time a model is opened.
  useEffect(() => {
    if (!model) return;
    setDate(todayISO()); setPhoto(null); setPreview(null); setSaving(false); setError(null);
  }, [model?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Free the preview's object URL when it's replaced or the modal goes.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (!model) return null;

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const confirm = async () => {
    if (!userId || !date) return;
    setSaving(true); setError(null);
    const { error: err } = await markDeskModelPainted(model.id, userId, date, photo);
    setSaving(false);
    if (err) { setError('Could not save. Please try again.'); return; }
    onDone();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={() => !saving && onClose()}>
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl max-h-[85vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <h2 className="font-heading text-xl text-white">Mark as Painted</h2>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="text-neutral-400 hover:text-white"><CloseIcon /></button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <p className="font-body text-sm text-neutral-300">
            Finished <span className="text-white font-medium">{model.name}</span>? It'll come off the Painting Desk.
          </p>

          <label className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium text-white">Painted Date</span>
            <input type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 font-body text-sm text-white [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium text-white">Photo <span className="text-neutral-500 font-normal">(optional)</span></span>
            {preview ? (
              <div className="relative w-32 aspect-square rounded-lg overflow-hidden border border-neutral-700 bg-neutral-950">
                <img src={preview} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => { setPhoto(null); setPreview(null); }} aria-label="Remove photo"
                  className="absolute bottom-1 right-1 p-1 rounded-md bg-black/60 text-red-400 hover:bg-black/80">
                  <TrashIcon />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-32 aspect-square rounded-lg border border-dashed border-neutral-600 flex flex-col items-center justify-center gap-1 text-neutral-400 hover:text-white hover:border-neutral-400 transition-colors">
                <PlusIcon />
                <span className="font-body text-[11px]">Add photo</span>
              </button>
            )}
            <span className="font-body text-xs text-neutral-500">Becomes the model's cover photo.</span>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
          </div>

          {error && <p className="font-body text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" color="secondary" disabled={saving} onClick={onClose}>Cancel</Button>
            <Button color="primary" disabled={!date || !userId || saving} loading={saving} onClick={confirm}>Mark Painted</Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
