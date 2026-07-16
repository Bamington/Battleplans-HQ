/**
 * ImageEditor.tsx — Manage the photos on a model or collection: add (upload),
 * remove, and pick which one is the cover. Operations apply immediately (there
 * is no separate save step), mirroring the battle-photo editor.
 */

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  useUserId,
  fetchModelImages, fetchBoxImages,
  uploadModelImage, uploadBoxImage,
  deleteModelImage, deleteBoxImage,
  setModelPrimaryImage, setBoxPrimaryImage,
  type EditableImage,
} from '../hooks/useCollection';

// ── Icons ─────────────────────────────────────────────────────────────────────

const StarIcon = ({ filled = false, className = 'w-4 h-4' }: { filled?: boolean; className?: string }) => (
  <svg viewBox="0 0 16 16" fill={filled ? 'currentColor' : 'none'} xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M8 1.8l1.7 3.6 3.9.5-2.9 2.7.8 3.9L8 12.7 4.5 12.8l.8-3.9L2.4 6.4l3.9-.5L8 1.8z"
      stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

const TrashIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M3 4.5h10M6.5 4V3h3v1M5 4.5l.5 8h5l.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PlusIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M10 5v10M5 10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────

export function ImageEditor({ kind, id, onChanged }: {
  kind: 'model' | 'box';
  id: string;
  /** Bubble up so the detail modal + list refresh their carousels too. */
  onChanged?: () => void;
}) {
  const userId = useUserId();
  const [images, setImages] = useState<EditableImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const rows = kind === 'model' ? await fetchModelImages(id) : await fetchBoxImages(id);
    setImages(rows);
    setLoading(false);
  }, [kind, id]);

  useEffect(() => { setLoading(true); refresh(); }, [refresh]);

  const bubble = () => { refresh(); onChanged?.(); };

  const handleAdd = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length || !userId) return;
    setBusy(true); setError(null);
    let hadError = false;
    let firstUpload = images.length === 0;
    for (const file of files) {
      const upload = kind === 'model' ? uploadModelImage : uploadBoxImage;
      const { error: err } = await upload(id, userId, file, firstUpload);
      if (err) hadError = true; else firstUpload = false;
    }
    setBusy(false);
    if (hadError) setError('Some photos could not be uploaded.');
    bubble();
  };

  const handleRemove = async (imgId: string) => {
    setBusy(true); setError(null);
    const del = kind === 'model' ? deleteModelImage : deleteBoxImage;
    const { error: err } = await del(imgId);
    setBusy(false);
    if (err) { setError('Could not remove the photo.'); return; }
    bubble();
  };

  const handleSetPrimary = async (imgId: string) => {
    setBusy(true); setError(null);
    const set = kind === 'model' ? setModelPrimaryImage : setBoxPrimaryImage;
    const { error: err } = await set(id, imgId);
    setBusy(false);
    if (err) { setError('Could not set the cover photo.'); return; }
    bubble();
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="font-body text-sm font-medium text-white">Photos</span>

      {loading ? (
        <div className="py-4 text-center font-body text-xs text-neutral-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map(img => (
            <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden bg-neutral-950 border border-neutral-700 group">
              <img src={img.url} alt="" className="w-full h-full object-cover" />
              {img.isPrimary && (
                <span className="absolute top-1 left-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary-600 text-white text-[10px] font-body">
                  <StarIcon filled className="w-2.5 h-2.5" /> Cover
                </span>
              )}
              <div className="absolute bottom-1 right-1 flex gap-1">
                {!img.isPrimary && (
                  <button type="button" disabled={busy} onClick={() => handleSetPrimary(img.id)}
                    aria-label="Make cover photo" title="Make cover photo"
                    className="p-1 rounded-md bg-black/60 text-white hover:bg-black/80 disabled:opacity-50">
                    <StarIcon />
                  </button>
                )}
                <button type="button" disabled={busy} onClick={() => handleRemove(img.id)}
                  aria-label="Remove photo" title="Remove photo"
                  className="p-1 rounded-md bg-black/60 text-red-400 hover:bg-black/80 disabled:opacity-50">
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}

          {/* Add tile */}
          <button type="button" disabled={busy || !userId} onClick={() => fileRef.current?.click()}
            className="aspect-square rounded-lg border border-dashed border-neutral-600 flex flex-col items-center justify-center gap-1 text-neutral-400 hover:text-white hover:border-neutral-400 disabled:opacity-50 transition-colors">
            <PlusIcon />
            <span className="font-body text-[11px]">Add</span>
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAdd} />
      {busy && <span className="font-body text-xs text-neutral-400">Working…</span>}
      {error && <span className="font-body text-xs text-red-400">{error}</span>}
    </div>
  );
}
