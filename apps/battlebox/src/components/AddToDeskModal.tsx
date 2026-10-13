/**
 * AddToDeskModal.tsx — Put models on the Painting Desk, three ways:
 *   - New model      → hands off to AddModelModal in desk mode (onNewModel)
 *   - Existing model → pick any models that aren't Painted / already there
 *   - Collection     → pick collections; all their unpainted models go on
 * Collections themselves are never on the desk — only their models.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input, Magnifer, AddCircle } from '@battleplans/ui';
import { CloseIcon, PickRow } from './paintPickerBits';
import {
  fetchDeskModelOptions, fetchDeskCollectionOptions, addModelsToDesk,
} from '../hooks/useCollection';
import type { DeskModelOption, DeskCollectionOption, ModelStatus } from '../hooks/useCollection';

type Step = 'choose' | 'models' | 'collections';

const STATUS_LABEL: Record<ModelStatus, string> = {
  'None': 'Unpainted', 'Assembled': 'Assembled', 'Primed': 'Primed',
  'Partially Painted': 'Partially Painted', 'Painted': 'Painted',
};

/** A big tappable choice on the first step. */
function Choice({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full text-left flex flex-col gap-0.5 px-4 py-3 rounded-lg border border-neutral-700 bg-neutral-800 hover:border-neutral-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
      <span className="font-body text-sm font-medium text-white">{title}</span>
      <span className="font-body text-xs text-neutral-400">{detail}</span>
    </button>
  );
}

export function AddToDeskModal({ open, onClose, userId, onAdded, onNewModel }: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  /** Models went on the desk — refresh. */
  onAdded: () => void;
  /** "New model" chosen: the caller opens AddModelModal with forDesk. */
  onNewModel: () => void;
}) {
  const [step, setStep] = useState<Step>('choose');
  const [search, setSearch] = useState('');
  const [models, setModels] = useState<DeskModelOption[]>([]);
  const [collections, setCollections] = useState<DeskCollectionOption[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('choose'); setSearch(''); setPicked([]); setError(null); setSaving(false);
  }, [open]);

  // Load the list for the current step, following the search box.
  useEffect(() => {
    if (!open || !userId || step === 'choose') return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      if (step === 'models') {
        const rows = await fetchDeskModelOptions(userId, search);
        if (!cancelled) setModels(rows);
      } else {
        const rows = await fetchDeskCollectionOptions(userId, search);
        if (!cancelled) setCollections(rows);
      }
      if (!cancelled) setLoading(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, userId, step, search]);

  if (!open) return null;

  const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  const go = (s: Step) => { setStep(s); setSearch(''); setPicked([]); setError(null); };

  /** Models the current picks put on the desk (a collection → its models). */
  const modelIds = step === 'collections'
    ? [...new Set(collections.filter(c => picked.includes(c.id)).flatMap(c => c.modelIds))]
    : picked;

  const add = async () => {
    if (!modelIds.length) return;
    setSaving(true); setError(null);
    const { error: err } = await addModelsToDesk(modelIds);
    setSaving(false);
    if (err) { setError('Could not add to the desk. Please try again.'); return; }
    onAdded();
    onClose();
  };

  const list = step === 'models'
    ? models.map(m => (
        <PickRow key={m.id} title={m.name} subtitle={[STATUS_LABEL[m.status], m.gameName].filter(Boolean).join(' · ')}
          selected={picked.includes(m.id)} onSelect={() => toggle(m.id)} />
      ))
    : collections.map(c => (
        <PickRow key={c.id} title={c.name}
          subtitle={[`${c.modelIds.length} unpainted ${c.modelIds.length === 1 ? 'model' : 'models'}`, c.gameName].filter(Boolean).join(' · ')}
          selected={picked.includes(c.id)} onSelect={() => toggle(c.id)} />
      ));

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-1 shrink-0">
          <h2 className="font-heading text-xl text-white">
            {step === 'choose' ? 'Add to Painting Desk' : step === 'models' ? 'Add Models' : 'Add a Collection'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-white"><CloseIcon /></button>
        </div>

        {step === 'choose' ? (
          <div className="px-5 py-4 flex flex-col gap-2">
            <Choice title="New model" detail="Create a model and start it on the desk." onClick={() => { onClose(); onNewModel(); }} />
            <Choice title="Existing models" detail="Pick models you already have that aren't painted yet." onClick={() => go('models')} />
            <Choice title="From a collection" detail="Put all of a collection's unpainted models on the desk." onClick={() => go('collections')} />
          </div>
        ) : (
          <>
            <div className="px-5 pt-3 shrink-0">
              <Input size="sm" type="search" className="w-full"
                placeholder={step === 'models' ? 'Search models…' : 'Search collections…'}
                leftIcon={<Magnifer className="w-4 h-4" />}
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="px-5 py-3 flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5">
              {loading && !list.length ? (
                <p className="py-6 text-center font-body text-sm text-neutral-400">Loading…</p>
              ) : list.length ? list : (
                <p className="py-6 text-center font-body text-sm text-neutral-500">
                  {step === 'models'
                    ? (search ? 'No unpainted models match.' : 'Every model is painted or already on the desk.')
                    : (search ? 'No collections match.' : 'No collections have unpainted models off the desk.')}
                </p>
              )}
            </div>
            <div className="px-5 pb-4 pt-1 flex flex-col gap-2 shrink-0">
              {error && <p className="font-body text-sm text-red-400">{error}</p>}
              <div className="flex gap-2">
                <Button variant="ghost" color="secondary" onClick={() => go('choose')}>Back</Button>
                <div className="flex-1" />
                <Button color="primary" leftIcon={<AddCircle className="w-4 h-4" />}
                  disabled={!modelIds.length || saving} loading={saving} onClick={add}>
                  {modelIds.length ? `Add ${modelIds.length} to Desk` : 'Add to Desk'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
