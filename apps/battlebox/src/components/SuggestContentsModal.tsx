/**
 * SuggestContentsModal.tsx — "Suggest contents" for a box: looks the box up on
 * the web (lib/boxContents) and offers the models that come in it, ticked
 * ready to add. Each suggestion can be renamed, recounted or unticked first; a
 * suggestion that matches a model the user already has (same game, same name)
 * links that one instead of making a duplicate, unless they choose otherwise.
 *
 * "Add N Models" creates the new ones in one insert — the box's game and
 * purchase date, unpainted — and files everything into the box.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@battleplans/ui';
import { CheckIcon, CloseIcon, PlusIcon, TrashIcon } from './paintPickerBits';
import { addModelsToBox, createModels, fetchBoxEdit, fetchModelsForGame } from '../hooks/useCollection';
import { lookupBoxContents, normaliseModelName } from '../lib/boxContents';
import type { BoxSource } from '../lib/boxContents';

export interface Suggestion {
  key: string;
  name: string;
  count: number;
  selected: boolean;
  /** A model the user already owns that matches this suggestion. */
  existing: { id: string; name: string } | null;
  /** With a match: link the existing model (true) or create a new one. */
  useExisting: boolean;
}

let nextKey = 0;
const newKey = () => `s${++nextKey}`;

/** One suggested model: tick, editable name and count, and — when the user
 *  already owns a match — a choice between linking theirs or making a new one. */
export function SuggestionRow({ suggestion: s, onChange, onRemove }: {
  suggestion: Suggestion;
  onChange: (next: Suggestion) => void;
  /** Only for rows the user added by hand. */
  onRemove?: () => void;
}) {
  const linking = s.existing && s.useExisting;
  return (
    <div className={`flex flex-col gap-1.5 px-3 py-2.5 rounded-lg border transition-colors ${
      s.selected ? 'border-primary-500 bg-primary-950' : 'border-neutral-700'}`}>
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => onChange({ ...s, selected: !s.selected })}
          aria-pressed={s.selected} aria-label={s.selected ? `Don’t add ${s.name || 'this model'}` : `Add ${s.name || 'this model'}`}
          className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center ${
            s.selected ? 'bg-primary-600 border-primary-600 text-white' : 'border-neutral-500'}`}>
          {s.selected && <CheckIcon className="w-2.5 h-2.5" />}
        </button>
        {linking ? (
          <span className="flex-1 min-w-0 font-body text-sm text-white truncate">{s.existing!.name}</span>
        ) : (
          <input
            value={s.name} placeholder="Model name" aria-label="Model name"
            onChange={e => onChange({ ...s, name: e.target.value, selected: true })}
            className="flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-neutral-600 focus:border-primary-500 focus:outline-none font-body text-sm text-white placeholder:text-neutral-500 py-0.5"
          />
        )}
        {!linking && (
          <label className="shrink-0 flex items-center gap-1 font-body text-xs text-neutral-400">
            ×
            <input
              type="number" min={1} max={999} inputMode="numeric" aria-label="How many"
              value={s.count}
              onChange={e => onChange({ ...s, count: Math.max(1, Math.min(999, Number(e.target.value) || 1)) })}
              className="w-12 bg-neutral-800 border border-neutral-700 rounded-md px-1.5 py-0.5 font-body text-sm text-white text-center [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>
        )}
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label="Remove" className="shrink-0 p-1 text-neutral-500 hover:text-red-400">
            <TrashIcon />
          </button>
        )}
      </div>
      {s.existing && (
        <p className="pl-[30px] font-body text-xs text-neutral-400">
          {s.useExisting ? 'You already have this — your model will be added. ' : 'You already have one — a new model will be made. '}
          <button type="button" className="text-primary-400 hover:text-primary-300 underline-offset-2 hover:underline"
            onClick={() => onChange({ ...s, useExisting: !s.useExisting, selected: true })}>
            {s.useExisting ? 'Make a new one instead' : 'Use mine instead'}
          </button>
        </p>
      )}
    </div>
  );
}

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

export function SuggestContentsModal({ boxId, userId, onClose, onAdded, onPickExisting, dismissLabel = 'Skip for now' }: {
  /** The box to fill; null keeps the modal closed. */
  boxId: string | null;
  userId: string | null;
  onClose: () => void;
  /** Fired once models have been added, so lists can refresh. */
  onAdded: () => void;
  /** Switch to picking from the user's own models instead. */
  onPickExisting?: () => void;
  dismissLabel?: string;
}) {
  const [boxName, setBoxName] = useState('');
  const [box, setBox] = useState<{ game_id: string | null; purchase_date: string | null } | null>(null);
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [manual, setManual] = useState<Set<string>>(new Set());
  const [sources, setSources] = useState<BoxSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!boxId || !userId) return;
    setLoading(true); setRows([]); setManual(new Set()); setSources([]);
    setLookupError(null); setNotFound(false); setError(null);
    let cancelled = false;
    (async () => {
      const b = await fetchBoxEdit(boxId);
      if (cancelled || !b) { if (!cancelled) { setLoading(false); setLookupError('Couldn’t load this box.'); } return; }
      setBoxName(b.name);
      setBox({ game_id: b.game_id, purchase_date: b.purchase_date });
      const [{ result, error: err }, owned] = await Promise.all([
        lookupBoxContents(b.name, b.game_id),
        fetchModelsForGame(userId, b.game_id),
      ]);
      if (cancelled) return;
      setLoading(false);
      if (err || !result) { setLookupError(err ?? 'Couldn’t look this box up.'); return; }
      if (!result.found || result.items.length === 0) { setNotFound(true); return; }
      const byName = new Map(owned.map(m => [normaliseModelName(m.name), m]));
      setRows(result.items.map(it => {
        const match = byName.get(normaliseModelName(it.name));
        return {
          key: newKey(), name: it.name, count: it.count, selected: true,
          existing: match ? { id: match.id, name: match.name } : null,
          useExisting: !!match,
        };
      }));
      setSources(result.sources);
    })();
    return () => { cancelled = true; };
  }, [boxId, userId]);

  if (!boxId) return null;

  const update = (next: Suggestion) => setRows(prev => prev.map(r => (r.key === next.key ? next : r)));
  const remove = (key: string) => setRows(prev => prev.filter(r => r.key !== key));
  const addRow = () => {
    const key = newKey();
    setManual(prev => new Set(prev).add(key));
    setRows(prev => [...prev, { key, name: '', count: 1, selected: true, existing: null, useExisting: false }]);
  };

  const chosen = rows.filter(r => r.selected && (r.existing && r.useExisting ? true : r.name.trim()));

  const save = async () => {
    if (!userId || !box || !chosen.length || saving) return;
    setSaving(true); setError(null);
    const toLink = chosen.filter(r => r.existing && r.useExisting).map(r => r.existing!.id);
    const toCreate = chosen.filter(r => !(r.existing && r.useExisting));
    const { ids, error: createErr } = await createModels(userId, toCreate.map(r => ({
      name: r.name.trim(),
      game_id: box.game_id,
      count: r.count,
      status: 'None' as const,
      purchase_date: box.purchase_date,
      painted_date: null,
    })));
    if (createErr) { setSaving(false); setError('Could not add the models. Please try again.'); return; }
    const { error: linkErr } = await addModelsToBox(boxId, [...ids, ...toLink]);
    setSaving(false);
    if (linkErr) { setError('The models were added, but not all could be put in this box.'); onAdded(); return; }
    onAdded();
    onClose();
  };

  const overlay = (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={saving ? undefined : onClose}>
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 px-5 pt-4 pb-1 shrink-0">
          <div className="flex flex-col gap-0.5 min-w-0">
            <h2 className="font-heading text-xl text-white">What’s in the Box?</h2>
            {boxName && <p className="font-body text-sm text-neutral-400 truncate">{boxName}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-white shrink-0"><CloseIcon /></button>
        </div>

        {/* List — the only scrolling region, so the header and CTA stay put. */}
        <div className="px-5 pt-3 flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5">
          {loading ? (
            <p className="py-8 text-center font-body text-sm text-neutral-400">Looking up what comes in this box…</p>
          ) : lookupError ? (
            <p className="py-6 text-center font-body text-sm text-red-400">{lookupError}</p>
          ) : (
            <>
              {notFound && rows.length === 0 && (
                <p className="py-4 text-center font-body text-sm text-neutral-400">
                  We couldn’t find a reliable list of what’s in this box. You can add its models yourself below.
                </p>
              )}
              {!notFound && rows.length > 0 && (
                <p className="font-body text-xs text-neutral-400 pb-1">Untick anything you don’t have, and fix any names before adding.</p>
              )}
              {rows.map(r => (
                <SuggestionRow key={r.key} suggestion={r} onChange={update}
                  onRemove={manual.has(r.key) ? () => remove(r.key) : undefined} />
              ))}
              <button type="button" onClick={addRow}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-neutral-600 text-neutral-400 hover:text-white hover:border-neutral-400 font-body text-sm transition-colors">
                <PlusIcon className="w-4 h-4" /> Add another model
              </button>
              {sources.length > 0 && (
                <p className="font-body text-[11px] text-neutral-500 pt-1">
                  Found on{' '}
                  {sources.map((s, i) => (
                    <span key={s.url}>
                      {i > 0 && ', '}
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-neutral-300">{hostOf(s.url)}</a>
                    </span>
                  ))}
                  . Suggestions can be wrong — check before adding.
                </p>
              )}
            </>
          )}
        </div>

        <div className="px-5 pt-3 pb-4 shrink-0 flex flex-col gap-2">
          {error && <p className="font-body text-sm text-red-400">{error}</p>}
          <Button
            color="primary" className="w-full justify-center"
            disabled={chosen.length === 0 || saving || loading} loading={saving} onClick={save}
          >
            Add{chosen.length ? ` ${chosen.length}` : ''} {chosen.length === 1 ? 'Model' : 'Models'}
          </Button>
          {onPickExisting && (
            <Button variant="outline" color="primary" className="w-full justify-center" disabled={saving} onClick={onPickExisting}>
              Pick from My Models Instead
            </Button>
          )}
          <Button variant="ghost" color="secondary" className="w-full justify-center" disabled={saving} onClick={onClose}>
            {dismissLabel}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
