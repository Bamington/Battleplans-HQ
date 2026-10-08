/**
 * ImageEditor.tsx — Manage the photos on a model, collection or recipe: add (upload,
 * or find one online when given a `searchQuery`), remove, and pick which one
 * is the cover. Operations apply immediately (there is no separate save step),
 * mirroring the battle-photo editor.
 */

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  useUserId,
  fetchModelImages, fetchBoxImages, fetchRecipeImages,
  uploadModelImage, uploadBoxImage, uploadRecipeImage,
  deleteModelImage, deleteBoxImage, deleteRecipeImage,
  setModelPrimaryImage, setBoxPrimaryImage, setRecipePrimaryImage,
  type EditableImage,
} from '../hooks/useCollection';
import { StarIcon, TrashIcon, PlusIcon } from './paintPickerBits';
import { PhotoFinder } from './PhotoFinder';
import { pendingPhotoFile } from '../lib/imageSearch';
import { fetchShoppingItemImages, uploadShoppingItemImage, removeShoppingItemImage } from '../hooks/useShoppingList';
import type { PendingPhoto } from '../lib/imageSearch';

/** The photo operations for each kind of thing that has photos. */
const OPS = {
  model:  { fetch: fetchModelImages,  upload: uploadModelImage,  remove: deleteModelImage,  setPrimary: setModelPrimaryImage },
  box:    { fetch: fetchBoxImages,    upload: uploadBoxImage,    remove: deleteBoxImage,    setPrimary: setBoxPrimaryImage },
  recipe: { fetch: fetchRecipeImages, upload: uploadRecipeImage, remove: deleteRecipeImage, setPrimary: setRecipePrimaryImage },
  // One photo stored on the item row: uploading replaces it, and there's no
  // cover to choose. The "image id" is the item's own id.
  shopping: {
    fetch: fetchShoppingItemImages,
    upload: (id: string, userId: string, file: File, _isPrimary: boolean) => uploadShoppingItemImage(id, userId, file),
    remove: removeShoppingItemImage,
    setPrimary: async (_id: string, _imgId: string) => ({ error: null }),
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ImageEditor({ kind, id, onChanged, searchQuery, max }: {
  kind: keyof typeof OPS;
  id: string;
  /** Bubble up so the detail modal + list refresh their carousels too. */
  onChanged?: () => void;
  /** Offer "Find a photo online", searching for this by default (the name,
   *  plus the game). Left out, there's no web search — e.g. recipes, whose
   *  photos are of your own painting. */
  searchQuery?: string;
  /** At most this many photos. At the limit the Add tile reads "Replace" and a
   *  new photo replaces the old — which relies on that kind's upload replacing
   *  (shopping does). With 1 there's no cover to choose, so no star. */
  max?: number;
}) {
  const single = max === 1;
  const userId = useUserId();
  const [images, setImages] = useState<EditableImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Web results already saved from this editor, so they show as picked. */
  const [webPicked, setWebPicked] = useState<PendingPhoto[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const rows = await OPS[kind].fetch(id);
    setImages(rows);
    setLoading(false);
  }, [kind, id]);

  useEffect(() => { setLoading(true); setWebPicked([]); refresh(); }, [refresh]);

  /** A web result was tapped: download it (server-side) and save it like an
   *  upload. It becomes the cover only if there were no photos yet. */
  const handleWebPick = async (next: PendingPhoto[]) => {
    let added = next.filter(p => !webPicked.some(w => w.id === p.id));
    if (!added.length || !userId) return;
    // At a limit, only the newest picks count — they replace what was there.
    if (max) added = added.slice(-max);
    setWebPicked(max ? added : next);
    setBusy(true); setError(null);
    let cover = images.length === 0;
    const failed: string[] = [];
    for (const photo of added) {
      const file = await pendingPhotoFile(photo);
      const err = file ? (await OPS[kind].upload(id, userId, file, cover)).error : 'download failed';
      if (err) failed.push(photo.id); else cover = false;
    }
    setBusy(false);
    if (failed.length) {
      // Un-pick it, so it can be tried again or another chosen.
      setWebPicked(prev => prev.filter(p => !failed.includes(p.id)));
      setError('Couldn’t save that photo — some sites block downloads. Try another one.');
    }
    bubble();
  };

  const bubble = () => { refresh(); onChanged?.(); };

  const handleAdd = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, max ?? Infinity);
    e.target.value = '';
    if (!files.length || !userId) return;
    setBusy(true); setError(null);
    let hadError = false;
    let firstUpload = images.length === 0;
    for (const file of files) {
      const { error: err } = await OPS[kind].upload(id, userId, file, firstUpload);
      if (err) hadError = true; else firstUpload = false;
    }
    setBusy(false);
    if (hadError) setError('Some photos could not be uploaded.');
    bubble();
  };

  const handleRemove = async (imgId: string) => {
    setBusy(true); setError(null);
    const { error: err } = await OPS[kind].remove(imgId);
    setBusy(false);
    if (err) { setError('Could not remove the photo.'); return; }
    bubble();
  };

  const handleSetPrimary = async (imgId: string) => {
    setBusy(true); setError(null);
    const { error: err } = await OPS[kind].setPrimary(id, imgId);
    setBusy(false);
    if (err) { setError('Could not set the cover photo.'); return; }
    bubble();
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="font-body text-sm font-medium text-white">{single ? 'Photo' : 'Photos'}</span>

      {loading ? (
        <div className="py-4 text-center font-body text-xs text-neutral-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map(img => (
            <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden bg-neutral-950 border border-neutral-700 group">
              <img src={img.url} alt="" className="w-full h-full object-cover" />
              {img.isPrimary && !single && (
                <span className="absolute top-1 left-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary-600 text-white text-[10px] font-body">
                  <StarIcon filled className="w-2.5 h-2.5" /> Cover
                </span>
              )}
              <div className="absolute bottom-1 right-1 flex gap-1">
                {!img.isPrimary && !single && (
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
            <span className="font-body text-[11px]">{max !== undefined && images.length >= max ? 'Replace' : 'Add'}</span>
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple={!single} className="hidden" onChange={handleAdd} />
      {busy && <span className="font-body text-xs text-neutral-400">Working…</span>}
      {error && <span className="font-body text-xs text-red-400">{error}</span>}

      {searchQuery !== undefined && !loading && (
        <PhotoFinder
          searchOnly
          value={webPicked}
          onChange={handleWebPick}
          suggestedQuery={searchQuery}
          searchHint="Enter a name to search for a photo online."
          disabled={busy || !userId}
        />
      )}
    </div>
  );
}
