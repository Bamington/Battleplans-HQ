/**
 * AddCollectionModal.tsx — Create a box/collection. Collects the core details
 * and, through PhotoFinder, any photos — uploaded or found online by name (box
 * art is usually easy to find). Photos are staged until the row exists.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input } from '@battleplans/ui';
import { CloseIcon } from './paintPickerBits';
import { GamePicker } from './GamePicker';
import { PhotoFinder } from './PhotoFinder';
import { Chip } from './filterControls';
import { createBox, uploadBoxImage, useAllGames } from '../hooks/useCollection';
import { uploadPendingPhotos, releasePendingPhotos } from '../lib/imageSearch';
import type { PendingPhoto } from '../lib/imageSearch';

const TYPES: ('Box' | 'Collection')[] = ['Box', 'Collection'];

function DateField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <label className="flex-1 flex flex-col gap-1 min-w-0">
      <span className="font-body text-xs text-neutral-400">{label}</span>
      <input type="date" value={value ?? ''} onChange={e => onChange(e.target.value || null)}
        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 font-body text-sm text-white [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-primary-500" />
    </label>
  );
}

export function AddCollectionModal({ open, onClose, userId, onCreated }: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  /** Called with the new collection's id once it's saved. `addModels` is true
   *  when the user chose "Create and Add Models", so the caller can follow up
   *  with the model picker. */
  onCreated: (id: string, addModels: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'Box' | 'Collection'>('Box');
  const [gameId, setGameId] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState<string | null>(null);
  /** Which CTA is mid-save, so only that button shows a spinner. */
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [saving, setSaving] = useState<null | 'create' | 'createAdd'>(null);
  const [error, setError] = useState<string | null>(null);
  /** Set when the collection saved but some photos didn't — the form stays up to say so. */
  const [saved, setSaved] = useState<{ id: string; addModels: boolean } | null>(null);
  const games = useAllGames(open);
  const gameName = games.find(g => g.id === gameId)?.name ?? '';

  // Start from a clean form each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setName(''); setType('Box'); setGameId(null); setPurchaseDate(null);
    setPhotos(prev => { releasePendingPhotos(prev); return []; });
    setSaving(null); setError(null); setSaved(null);
  }, [open]);

  if (!open) return null;

  const finish = (id: string, addModels: boolean) => { onCreated(id, addModels); onClose(); };
  const close = () => { if (saving) return; if (saved) finish(saved.id, saved.addModels); else onClose(); };

  const save = async (addModels: boolean) => {
    if (!userId || saving) return;
    setSaving(addModels ? 'createAdd' : 'create'); setError(null);
    const { id, error: err } = await createBox(userId, {
      name: name.trim(),
      type,
      game_id: gameId,
      purchase_date: purchaseDate,
    });
    if (err || !id) { setSaving(null); setError('Could not add the collection. Please try again.'); return; }
    const failed = await uploadPendingPhotos(photos, (file, isPrimary) => uploadBoxImage(id, userId, file, isPrimary));
    setSaving(null);
    if (failed > 0) {
      setSaved({ id, addModels });
      setError(`The collection was added, but ${failed === 1 ? '1 photo' : `${failed} photos`} couldn’t be saved. You can add more from its Edit form.`);
      return;
    }
    finish(id, addModels);
  };

  const disabled = name.trim() === '' || saving !== null || !userId;

  const overlay = (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={close}>
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl max-h-[85vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-1 shrink-0">
          <h2 className="font-heading text-xl text-white">Add Collection</h2>
          <button type="button" onClick={close} aria-label="Close" className="text-neutral-400 hover:text-white"><CloseIcon /></button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <Input label="Name" required placeholder="e.g. Leviathan Box Set" value={name} onChange={e => setName(e.target.value)} />

          <div className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium text-white">Type</span>
            <div className="flex flex-wrap gap-2">
              {TYPES.map(t => (
                <Chip key={t} label={t} selected={type === t} onClick={() => setType(t)} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium text-white">Game</span>
            <GamePicker value={gameId} onChange={setGameId} enabled={open} />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium text-white">Purchase Date</span>
            <div className="flex gap-3"><DateField label="Date" value={purchaseDate} onChange={setPurchaseDate} /></div>
          </div>

          <PhotoFinder
            value={photos}
            onChange={setPhotos}
            suggestedQuery={[name.trim(), gameName].filter(Boolean).join(' ')}
            searchHint="Enter a name to search for box art online."
          />

          {error && <p className="font-body text-sm text-red-400">{error}</p>}

          {saved ? (
            <Button color="primary" className="w-full justify-center" onClick={() => finish(saved.id, saved.addModels)}>Continue</Button>
          ) : (
          <div className="flex flex-col gap-2 pt-1">
            <Button
              color="primary" className="w-full justify-center"
              disabled={disabled} loading={saving === 'create'}
              onClick={() => save(false)}
            >
              Create Collection
            </Button>
            <Button
              variant="outline" color="primary" className="w-full justify-center"
              disabled={disabled} loading={saving === 'createAdd'}
              onClick={() => save(true)}
            >
              Create and Add Models
            </Button>
            <Button variant="ghost" color="secondary" className="w-full justify-center" onClick={onClose}>Cancel</Button>
          </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
