/**
 * AddModelsToCollectionModal.tsx — Opened after "Create and Add Models": pick
 * models to put in a collection. Only the collection's game is offered (a
 * collection with no game offers everything).
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input, Magnifer } from '@battleplans/ui';
import { CloseIcon, PickRow } from './paintPickerBits';
import { fetchBoxEdit, fetchModelsForGame, addModelsToBox } from '../hooks/useCollection';
import type { ModelOption, ModelStatus } from '../hooks/useCollection';

const STATUS_LABEL: Record<ModelStatus, string> = {
  'None':              'Unpainted',
  'Assembled':         'Assembled',
  'Primed':            'Primed',
  'Partially Painted': 'Partially Painted',
  'Painted':           'Painted',
};

export function AddModelsToCollectionModal({ boxId, userId, onClose, onAdded }: {
  /** The collection to add to; null keeps the modal closed. */
  boxId: string | null;
  userId: string | null;
  onClose: () => void;
  /** Fired once models have been added, so lists can refresh. */
  onAdded: () => void;
}) {
  const [boxName, setBoxName] = useState('');
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!boxId || !userId) return;
    setLoading(true); setSelected([]); setSearch(''); setError(null);
    let cancelled = false;
    (async () => {
      const box = await fetchBoxEdit(boxId);
      if (cancelled) return;
      setBoxName(box?.name ?? '');
      const rows = await fetchModelsForGame(userId, box?.game_id ?? null);
      if (cancelled) return;
      setModels(rows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [boxId, userId]);

  if (!boxId) return null;

  const q = search.trim().toLowerCase();
  const shown = q ? models.filter(m => m.name.toLowerCase().includes(q)) : models;

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const save = async () => {
    if (!selected.length || saving) return;
    setSaving(true); setError(null);
    const { error: err } = await addModelsToBox(boxId, selected);
    setSaving(false);
    if (err) { setError('Could not add the models. Please try again.'); return; }
    onAdded();
    onClose();
  };

  const overlay = (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 px-5 pt-4 pb-1 shrink-0">
          <div className="flex flex-col gap-0.5 min-w-0">
            <h2 className="font-heading text-xl text-white">Add Models</h2>
            {boxName && <p className="font-body text-sm text-neutral-400 truncate">to {boxName}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-white shrink-0"><CloseIcon /></button>
        </div>

        <div className="px-5 pt-3 pb-2 shrink-0">
          <Input
            size="sm" type="search" className="w-full"
            placeholder="Search models…"
            leftIcon={<Magnifer className="w-4 h-4" />}
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* List — the only scrolling region, so the header and CTA stay put. */}
        <div className="px-5 flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5">
          {loading ? (
            <p className="py-8 text-center font-body text-sm text-neutral-400">Loading models…</p>
          ) : shown.length === 0 ? (
            <p className="py-8 text-center font-body text-sm text-neutral-500">
              {models.length === 0 ? 'No models for this game yet.' : 'No models match your search.'}
            </p>
          ) : shown.map(m => (
            <PickRow
              key={m.id}
              title={m.name}
              subtitle={`${m.count} ${m.count === 1 ? 'model' : 'models'} · ${STATUS_LABEL[m.status]}`}
              selected={selected.includes(m.id)}
              onSelect={() => toggle(m.id)}
            />
          ))}
        </div>

        <div className="px-5 pt-3 pb-4 shrink-0 flex flex-col gap-2">
          {error && <p className="font-body text-sm text-red-400">{error}</p>}
          <Button
            color="primary" className="w-full justify-center"
            disabled={selected.length === 0 || saving} loading={saving} onClick={save}
          >
            Add{selected.length ? ` ${selected.length}` : ''} {selected.length === 1 ? 'Model' : 'Models'}
          </Button>
          <Button variant="ghost" color="secondary" className="w-full justify-center" onClick={onClose}>
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
