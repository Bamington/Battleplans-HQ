/**
 * AddModelModal.tsx — Create a model. Collects the core details; photos are
 * added afterwards from the model's Edit form (which needs the new row's id).
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input } from '@battleplans/ui';
import { CloseIcon } from './paintPickerBits';
import { GamePicker } from './GamePicker';
import { CollectionPicker } from './CollectionPicker';
import { Chip } from './filterControls';
import { createModel, addModelToBox } from '../hooks/useCollection';
import type { ModelStatus } from '../hooks/useCollection';

const STATUSES: { value: ModelStatus; label: string }[] = [
  { value: 'None',              label: 'Unpainted' },
  { value: 'Assembled',         label: 'Assembled' },
  { value: 'Primed',            label: 'Primed' },
  { value: 'Partially Painted', label: 'Partially Painted' },
  { value: 'Painted',           label: 'Painted' },
];

function DateField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <label className="flex-1 flex flex-col gap-1 min-w-0">
      <span className="font-body text-xs text-neutral-400">{label}</span>
      <input type="date" value={value ?? ''} onChange={e => onChange(e.target.value || null)}
        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 font-body text-sm text-white [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-primary-500" />
    </label>
  );
}

export function AddModelModal({ open, onClose, userId, onCreated }: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  /** Called with the new model's id once it's saved. */
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [gameId, setGameId] = useState<string | null>(null);
  const [count, setCount] = useState(1);
  const [status, setStatus] = useState<ModelStatus>('None');
  const [boxId, setBoxId] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState<string | null>(null);
  const [paintedDate, setPaintedDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from a clean form each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setName(''); setGameId(null); setCount(1); setStatus('None'); setBoxId(null);
    setPurchaseDate(null); setPaintedDate(null); setSaving(false); setError(null);
  }, [open]);

  if (!open) return null;

  // A painted date only makes sense once the model is painted; drop any value
  // carried over when the status moves away from Painted.
  const pickStatus = (s: ModelStatus) => {
    setStatus(s);
    if (s !== 'Painted') setPaintedDate(null);
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true); setError(null);
    const { id, error: err } = await createModel(userId, {
      name: name.trim(),
      game_id: gameId,
      count: Math.max(1, count || 1),
      status,
      purchase_date: purchaseDate,
      painted_date: status === 'Painted' ? paintedDate : null,
    });
    if (err || !id) { setSaving(false); setError('Could not add the model. Please try again.'); return; }
    if (boxId) await addModelToBox(id, boxId);
    setSaving(false);
    onCreated(id);
    onClose();
  };

  const overlay = (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl max-h-[85vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-1 shrink-0">
          <h2 className="font-heading text-xl text-white">Add Model</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-white"><CloseIcon /></button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <Input label="Name" required placeholder="e.g. Intercessor Squad" value={name} onChange={e => setName(e.target.value)} />

          <div className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium text-white">Game</span>
            <GamePicker value={gameId} onChange={setGameId} enabled={open} />
          </div>

          <Input label="Model Count" type="number" min={1} value={String(count)} onChange={e => setCount(parseInt(e.target.value, 10) || 1)} />

          <div className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium text-white">Status</span>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map(s => (
                <Chip key={s.value} label={s.label} selected={status === s.value} onClick={() => pickStatus(s.value)} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium text-white">Collection <span className="text-neutral-500 font-normal">(optional)</span></span>
            <CollectionPicker
              userId={userId} gameId={gameId} value={boxId} enabled={open}
              onChange={(id, box) => {
                setBoxId(id);
                // A box was bought as one purchase, so its models share that
                // date. A Collection is just a grouping, so it implies nothing.
                if (box?.type === 'Box' && box.purchase_date) setPurchaseDate(box.purchase_date);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium text-white">Purchase Date</span>
            <div className="flex gap-3"><DateField label="Date" value={purchaseDate} onChange={setPurchaseDate} /></div>
          </div>

          {status === 'Painted' && (
            <div className="flex flex-col gap-1.5">
              <span className="font-body text-sm font-medium text-white">Painted Date</span>
              <div className="flex gap-3"><DateField label="Date" value={paintedDate} onChange={setPaintedDate} /></div>
            </div>
          )}

          {error && <p className="font-body text-sm text-red-400">{error}</p>}

          <p className="font-body text-xs text-neutral-500">You can add photos once the model is created.</p>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" color="secondary" onClick={onClose}>Cancel</Button>
            <Button color="primary" disabled={name.trim() === '' || saving || !userId} loading={saving} onClick={save}>Add Model</Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
