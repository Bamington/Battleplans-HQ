/**
 * paintPickerBits.tsx — Shared pieces for picking an existing paint: the small
 * icons, the selectable row, and a self-contained search + brand-filter +
 * paginated list (ExistingPaintPicker).
 */

import { useEffect, useState } from 'react';
import { Input, Magnifer } from '@battleplans/ui';
import { searchPaints, useHobbyBrands } from '../hooks/useCollection';
import type { PaintOption } from '../hooks/useCollection';

const HEX = /^#[0-9a-fA-F]{6}$/;
const PAGE_SIZE = 8;

// ── Icons ─────────────────────────────────────────────────────────────────────

export const CloseIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
);
export const CheckIcon = ({ className = 'w-3 h-3' }: { className?: string }) => (
  <svg viewBox="0 0 10 8" fill="none" className={className}><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const ChevronIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

// ── Selectable list row ───────────────────────────────────────────────────────

export function PickRow({ title, subtitle, swatch, selected, onSelect }: {
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

// ── Existing-paint picker (search + brand filter + paginated list) ────────────

export function ExistingPaintPicker({ selectedIds, onToggle, excludeIds = [] }: {
  selectedIds: number[];
  onToggle: (id: number) => void;
  excludeIds?: number[];
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [paints, setPaints] = useState<PaintOption[]>([]);
  const [total, setTotal] = useState(0);
  const [brandFilter, setBrandFilter] = useState<string[]>([]);
  const [brandOpen, setBrandOpen] = useState(false);
  const allBrands = useHobbyBrands(true);
  const excludeKey = excludeIds.join(',');

  useEffect(() => {
    let cancelled = false;
    searchPaints(search, page, brandFilter, excludeIds).then(({ items, total }) => {
      if (!cancelled) { setPaints(items); setTotal(total); }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page, brandFilter, excludeKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const toggleBrand = (b: string) => {
    setBrandFilter(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
    setPage(0);
  };

  return (
    <div className="flex flex-col gap-2">
      <Input
        size="sm" type="search" className="w-full"
        placeholder="Search paints…"
        leftIcon={<Magnifer className="w-4 h-4" />}
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(0); }}
      />

      {allBrands.length > 0 && (
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
        {paints.length === 0 ? (
          <p className="font-body text-sm text-neutral-500 py-3 text-center">No paints match.</p>
        ) : paints.map(p => (
          <PickRow key={p.id} title={p.name} subtitle={`${p.brand} · ${p.type}`} swatch={p.swatch}
            selected={selectedIds.includes(p.id)} onSelect={() => onToggle(p.id)} />
        ))}
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
  );
}
