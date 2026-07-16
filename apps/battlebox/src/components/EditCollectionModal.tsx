/**
 * EditCollectionModal.tsx — Edit a collection's metadata (name, type, game,
 * purchase date, and the free-text "Includes").
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input } from '@battleplans/ui';
import { CloseIcon } from './paintPickerBits';
import { GamePicker } from './GamePicker';
import { fetchBoxEdit, updateBoxInfo } from '../hooks/useCollection';

export function EditCollectionModal({ open, onClose, boxId, onChanged }: {
  open: boolean;
  onClose: () => void;
  boxId: string | null;
  onChanged: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [type, setType] = useState<'Box' | 'Collection'>('Box');
  const [gameId, setGameId] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !boxId) return;
    setLoading(true); setSaving(false);
    let cancelled = false;
    fetchBoxEdit(boxId).then(f => {
      if (cancelled || !f) return;
      setName(f.name); setType(f.type === 'Collection' ? 'Collection' : 'Box'); setGameId(f.game_id);
      setPurchaseDate(f.purchase_date);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, boxId]);

  if (!open) return null;

  const save = async () => {
    if (!boxId) return;
    setSaving(true);
    await updateBoxInfo(boxId, { name: name.trim(), type, game_id: gameId, purchase_date: purchaseDate });
    setSaving(false);
    onChanged();
    onClose();
  };

  const overlay = (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl max-h-[85vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-1 shrink-0">
          <h2 className="font-heading text-xl text-white">Edit Collection</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-white"><CloseIcon /></button>
        </div>

        {loading ? (
          <div className="p-8 text-center font-body text-sm text-neutral-400">Loading…</div>
        ) : (
          <div className="px-5 py-4 flex flex-col gap-4">
            <Input label="Name" required value={name} onChange={e => setName(e.target.value)} />

            <div className="flex flex-col gap-1.5">
              <span className="font-body text-sm font-medium text-white">Type</span>
              <div className="flex gap-2">
                {(['Box', 'Collection'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className={`px-3 py-1.5 rounded-full font-body text-sm transition-colors ${type === t ? 'bg-primary-600 text-white' : 'border border-neutral-700 text-neutral-300 hover:bg-neutral-800'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="font-body text-sm font-medium text-white">Game</span>
              <GamePicker value={gameId} onChange={setGameId} enabled={open} />
            </div>

            <label className="flex flex-col gap-1">
              <span className="font-body text-sm font-medium text-white">Purchase Date</span>
              <input type="date" value={purchaseDate ?? ''} onChange={e => setPurchaseDate(e.target.value || null)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 font-body text-sm text-white [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" color="secondary" onClick={onClose}>Cancel</Button>
              <Button color="primary" disabled={name.trim() === '' || saving} loading={saving} onClick={save}>Save</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
