/**
 * EditModelModal.tsx — Edit a model's core metadata (name, game, count, dates).
 * Status / notes / lore stay inline in the Painting & Lore tabs.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input } from '@battleplans/ui';
import { CloseIcon } from './paintPickerBits';
import { GamePicker } from './GamePicker';
import { ImageEditor } from './ImageEditor';
import { fetchModelEdit, updateModelInfo } from '../hooks/useCollection';

function DateField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <label className="flex-1 flex flex-col gap-1 min-w-0">
      <span className="font-body text-xs text-neutral-400">{label}</span>
      <input type="date" value={value ?? ''} onChange={e => onChange(e.target.value || null)}
        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 font-body text-sm text-white [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-primary-500" />
    </label>
  );
}

export function EditModelModal({ open, onClose, modelId, onChanged }: {
  open: boolean;
  onClose: () => void;
  modelId: string | null;
  /** Called after any change (metadata save or a photo edit) so the detail
   *  modal and list refresh. */
  onChanged: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [gameId, setGameId] = useState<string | null>(null);
  const [count, setCount] = useState(1);
  const [purchaseDate, setPurchaseDate] = useState<string | null>(null);
  const [paintedDate, setPaintedDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !modelId) return;
    setLoading(true); setSaving(false);
    let cancelled = false;
    fetchModelEdit(modelId).then(f => {
      if (cancelled || !f) return;
      setName(f.name); setGameId(f.game_id); setCount(f.count); setPurchaseDate(f.purchase_date); setPaintedDate(f.painted_date);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, modelId]);

  if (!open) return null;

  const save = async () => {
    if (!modelId) return;
    setSaving(true);
    await updateModelInfo(modelId, { name: name.trim(), game_id: gameId, count: Math.max(1, count || 1), purchase_date: purchaseDate, painted_date: paintedDate });
    setSaving(false);
    onChanged();
    onClose();
  };

  const overlay = (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl max-h-[85vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-1 shrink-0">
          <h2 className="font-heading text-xl text-white">Edit Model</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-white"><CloseIcon /></button>
        </div>

        {loading ? (
          <div className="p-8 text-center font-body text-sm text-neutral-400">Loading…</div>
        ) : (
          <div className="px-5 py-4 flex flex-col gap-4">
            <Input label="Name" required value={name} onChange={e => setName(e.target.value)} />

            <div className="flex flex-col gap-1.5">
              <span className="font-body text-sm font-medium text-white">Game</span>
              <GamePicker value={gameId} onChange={setGameId} enabled={open} />
            </div>

            <Input label="Model Count" type="number" min={1} value={String(count)} onChange={e => setCount(parseInt(e.target.value, 10) || 1)} />

            <div className="flex flex-col gap-1.5">
              <span className="font-body text-sm font-medium text-white">Purchase Date</span>
              <div className="flex gap-3"><DateField label="Date" value={purchaseDate} onChange={setPurchaseDate} /></div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-body text-sm font-medium text-white">Painted Date</span>
              <div className="flex gap-3"><DateField label="Date" value={paintedDate} onChange={setPaintedDate} /></div>
            </div>

            {modelId && <ImageEditor kind="model" id={modelId} onChanged={onChanged} />}

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
