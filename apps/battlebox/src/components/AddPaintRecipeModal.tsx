/**
 * AddPaintRecipeModal.tsx — Add a paint (hobby_item) or recipe to a model.
 *
 * Mirrors BattleCards' Add-Keyword flow in BattleBench's language: a "Create New"
 * button, an OR divider, then an "Add Existing" searchable/paginated list.
 * Portalled above the model sheet (which sits inside a transformed panel).
 */

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input, AddCircle, Magnifer } from '@battleplans/ui';
import {
  searchPaints, createPaint, addModelPaint, useHobbyBrands,
  searchRecipes, createRecipe, addModelRecipe,
} from '../hooks/useCollection';
import type { PaintOption, RecipeOption, PaintScope } from '../hooks/useCollection';

type Kind = 'paint' | 'recipe';
type Step = 'pick' | 'create';
const PAGE_SIZE = 8;
const HEX = /^#[0-9a-fA-F]{6}$/;

// ── Icons ─────────────────────────────────────────────────────────────────────

const CloseIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
);
const CheckIcon = ({ className = 'w-3 h-3' }: { className?: string }) => (
  <svg viewBox="0 0 10 8" fill="none" className={className}><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const ChevronIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

// ── Selectable list row ───────────────────────────────────────────────────────

function PickRow({ title, subtitle, swatch, selected, onSelect }: {
  title: string; subtitle: string | null; swatch?: string | null; selected: boolean; onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left border transition-colors ${
        selected ? 'border-primary-500 bg-primary-950' : 'border-neutral-700 hover:bg-white/5'
      }`}
    >
      {swatch !== undefined && (
        <span
          className="w-4 h-4 rounded-full shrink-0 border border-neutral-600"
          style={HEX.test(swatch ?? '') ? { backgroundColor: swatch! } : undefined}
          aria-hidden="true"
        />
      )}
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="font-body text-sm text-white truncate">{title}</span>
        {subtitle && <span className="font-body text-xs text-neutral-400 truncate">{subtitle}</span>}
      </span>
      <span className={`shrink-0 w-4 h-4 rounded-full border flex items-center justify-center ${selected ? 'bg-primary-600 border-primary-600 text-white' : 'border-neutral-500'}`}>
        {selected && <CheckIcon className="w-2.5 h-2.5" />}
      </span>
    </button>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function AddPaintRecipeModal({ open, onClose, kind, modelId, onAdded }: {
  open: boolean;
  onClose: () => void;
  kind: Kind;
  modelId: string | null;
  onAdded: () => void;
}) {
  const noun = kind === 'paint' ? 'Paint' : 'Recipe';

  const [step, setStep] = useState<Step>('pick');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [paints, setPaints] = useState<PaintOption[]>([]);
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string | number | null>(null);
  const [saving, setSaving] = useState(false);

  // Which paints to search (paints only). Default to the user's own collection.
  const [scope, setScope] = useState<PaintScope>('mine');

  // Brand filter (paints only).
  const [brandFilter, setBrandFilter] = useState<string[]>([]);
  const [brandOpen, setBrandOpen] = useState(false);
  const allBrands = useHobbyBrands(open && kind === 'paint');

  // Create-form state.
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [type, setType] = useState<'Paint' | 'Spray'>('Paint');
  const [swatch, setSwatch] = useState('#8a8f98');
  const [note, setNote] = useState('');
  const [description, setDescription] = useState('');

  // Reset everything each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setStep('pick'); setSearch(''); setPage(0); setSelected(null); setSaving(false);
    setScope('mine'); setBrandFilter([]); setBrandOpen(false);
    setName(''); setBrand(''); setType('Paint'); setSwatch('#8a8f98'); setNote(''); setDescription('');
  }, [open, kind]);

  const fetchPage = useCallback(async () => {
    if (kind === 'paint') {
      const { items, total } = await searchPaints(search, page, brandFilter, [], scope);
      setPaints(items); setTotal(total);
    } else {
      const { items, total } = await searchRecipes(search, page);
      setRecipes(items); setTotal(total);
    }
  }, [kind, search, page, brandFilter, scope]);

  const pickScope = (s: PaintScope) => { setScope(s); setPage(0); setSelected(null); };

  const toggleBrand = (b: string) => {
    setBrandFilter(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
    setPage(0); setSelected(null);
  };

  useEffect(() => {
    if (open && step === 'pick') fetchPage();
  }, [open, step, fetchPage]);

  if (!open) return null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const linkAndClose = async (paintId?: number, recipeId?: string) => {
    if (!modelId) return;
    setSaving(true);
    if (kind === 'paint' && paintId != null) await addModelPaint(modelId, paintId, note.trim() || null);
    if (kind === 'recipe' && recipeId)       await addModelRecipe(modelId, recipeId);
    setSaving(false);
    onAdded();
    onClose();
  };

  const addExisting = () => {
    if (selected == null) return;
    if (kind === 'paint') linkAndClose(selected as number);
    else linkAndClose(undefined, selected as string);
  };

  const saveNew = async () => {
    setSaving(true);
    if (kind === 'paint') {
      const id = await createPaint({ name: name.trim(), brand: brand.trim(), type, swatch });
      if (id != null) { await linkAndClose(id); return; }
    } else {
      const id = await createRecipe({ name: name.trim(), description: description.trim() || null });
      if (id) { await linkAndClose(undefined, id); return; }
    }
    setSaving(false);
  };

  const canCreate = kind === 'paint'
    ? name.trim() !== '' && brand.trim() !== '' && !saving
    : name.trim() !== '' && !saving;

  const overlay = (
    <div
      className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
      role="dialog" aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl max-h-[85vh] overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-1 shrink-0">
          <h2 className="font-heading text-xl text-white">
            {step === 'create' ? `Create ${noun}` : `Add ${noun}`}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-white">
            <CloseIcon />
          </button>
        </div>

        {step === 'pick' ? (
          <div className="px-5 py-4 flex flex-col gap-4">
            <Button
              variant="outline" color="primary"
              leftIcon={<AddCircle className="w-4 h-4" />}
              className="w-full justify-center"
              onClick={() => setStep('create')}
            >
              Create New {noun}
            </Button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-neutral-800" />
              <span className="font-body text-xs font-medium text-neutral-500">OR</span>
              <div className="flex-1 h-px bg-neutral-800" />
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-body text-sm font-medium text-white">Add Existing {noun}</span>

              {/* Scope tabs (paints only) — narrow to the user's collection or
                  browse the whole library. */}
              {kind === 'paint' && (
                <div className="flex p-0.5 bg-neutral-800 border border-neutral-700 rounded-lg">
                  {([['mine', 'My Paints'], ['all', 'All Paints']] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => pickScope(value)}
                      className={`flex-1 px-3 py-1.5 rounded-md font-body text-sm transition-colors ${
                        scope === value ? 'bg-primary-600 text-white' : 'text-neutral-300 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <Input
                size="sm" type="search" className="w-full"
                placeholder={`Search ${kind === 'paint' ? 'paints' : 'recipes'}…`}
                leftIcon={<Magnifer className="w-4 h-4" />}
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); setSelected(null); }}
              />

              {kind === 'paint' && allBrands.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setBrandOpen(o => !o)}
                    className="w-full flex items-center justify-between bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 font-body text-sm"
                  >
                    <span className={brandFilter.length ? 'text-white' : 'text-neutral-400'}>
                      {brandFilter.length ? `${brandFilter.length} brand${brandFilter.length > 1 ? 's' : ''} selected` : 'All brands'}
                    </span>
                    <ChevronIcon className={`w-4 h-4 text-neutral-400 transition-transform ${brandOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {brandOpen && (
                    <div className="mt-2 bg-neutral-800 border border-neutral-700 rounded-lg p-2 max-h-56 overflow-y-auto flex flex-col gap-px">
                      {allBrands.map(b => {
                        const checked = brandFilter.includes(b);
                        return (
                          <button
                            key={b}
                            type="button"
                            onClick={() => toggleBrand(b)}
                            className={`flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors ${checked ? 'bg-primary-950' : 'hover:bg-white/5'}`}
                          >
                            <span className="flex-1 font-body text-sm text-white truncate">{b}</span>
                            <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${checked ? 'bg-primary-600 border-primary-600' : 'border-neutral-500'}`}>
                              {checked && <CheckIcon className="w-2.5 h-2.5 text-white" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-1.5 min-h-[3rem]">
                {(kind === 'paint' ? paints.length : recipes.length) === 0 ? (
                  <p className="font-body text-sm text-neutral-500 py-3 text-center">
                    {kind === 'paint' && scope === 'mine'
                      ? (search ? 'No paints in your collection match.' : 'No paints in your collection — try All Paints, or create one above.')
                      : search ? `No ${kind === 'paint' ? 'paints' : 'recipes'} match.`
                      : `No ${kind === 'paint' ? 'paints' : 'recipes'} yet — create one above.`}
                  </p>
                ) : kind === 'paint' ? (
                  paints.map(p => (
                    <PickRow key={p.id} title={p.name} subtitle={`${p.brand} · ${p.type}`} swatch={p.swatch}
                      selected={selected === p.id} onSelect={() => setSelected(p.id)} />
                  ))
                ) : (
                  recipes.map(r => (
                    <PickRow key={r.id} title={r.name} subtitle={r.description}
                      selected={selected === r.id} onSelect={() => setSelected(r.id)} />
                  ))
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-1">
                  <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)}
                    className="px-2 py-1 rounded-md border border-neutral-700 text-sm text-neutral-300 disabled:opacity-40 hover:bg-neutral-800">Prev</button>
                  <span className="font-body text-xs text-neutral-400 tabular-nums">Page {page + 1} of {totalPages}</span>
                  <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                    className="px-2 py-1 rounded-md border border-neutral-700 text-sm text-neutral-300 disabled:opacity-40 hover:bg-neutral-800">Next</button>
                </div>
              )}
            </div>

            {kind === 'paint' && selected != null && (
              <Input size="sm" className="w-full" label="Note (optional)" placeholder="Where / how it's used…"
                value={note} onChange={e => setNote(e.target.value)} />
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" color="secondary" onClick={onClose}>Cancel</Button>
              <Button color="primary" disabled={selected == null || saving} loading={saving} onClick={addExisting}>
                Add {noun}
              </Button>
            </div>
          </div>
        ) : (
          <div className="px-5 py-4 flex flex-col gap-4">
            <Input label={`${noun} Name`} required placeholder={kind === 'paint' ? 'eg. Volupus Pink' : 'eg. Zerg Flesh'}
              value={name} onChange={e => setName(e.target.value)} />

            {kind === 'paint' ? (
              <>
                <Input label="Brand" required placeholder="eg. Citadel" value={brand} onChange={e => setBrand(e.target.value)} />
                <div className="flex flex-col gap-1.5">
                  <span className="font-body text-sm font-medium text-white">Type</span>
                  <div className="flex gap-2">
                    {(['Paint', 'Spray'] as const).map(t => (
                      <button key={t} type="button" onClick={() => setType(t)}
                        className={`px-3 py-1.5 rounded-full font-body text-sm transition-colors ${type === t ? 'bg-primary-600 text-white' : 'border border-neutral-700 text-neutral-300 hover:bg-neutral-800'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="font-body text-sm font-medium text-white">Colour</span>
                  <div className="flex items-center gap-3">
                    <input type="color" value={swatch} onChange={e => setSwatch(e.target.value)}
                      className="w-10 h-10 rounded-lg bg-neutral-800 border border-neutral-700 cursor-pointer" />
                    <span className="font-body text-sm text-neutral-400 tabular-nums">{swatch}</span>
                  </div>
                </div>
                <Input size="sm" className="w-full" label="Note (optional)" placeholder="Where / how it's used…"
                  value={note} onChange={e => setNote(e.target.value)} />
              </>
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="font-body text-sm font-medium text-white">Description</span>
                <textarea rows={4} placeholder="How to paint it…" value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 font-body text-sm text-white placeholder-neutral-500 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" color="secondary" onClick={() => setStep('pick')}>Back</Button>
              <Button color="primary" disabled={!canCreate} loading={saving} onClick={saveNew}>
                Save {noun}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
