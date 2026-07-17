/**
 * PaintPacksSheet.tsx — Browse paint packs and add them to the collection.
 * Split into "Your Packs" (added, with Remove) and "Available Packs" (public,
 * with Add), mirroring the BattleCards home-screen pack lists. Add/remove apply
 * immediately and bubble up so the library column refreshes.
 */

import { useEffect, useMemo, useState } from 'react';
import { Sheet, Input, Magnifer } from '@battleplans/ui';
import { CloseIcon } from './paintPickerBits';
import { PaintPackItem } from './PaintPackItem';
import { usePaintPacks, addPaintPack, removePaintPack } from '../hooks/usePaintPacks';
import type { PaintPack } from '../hooks/usePaintPacks';

function matches(pack: PaintPack, q: string): boolean {
  if (!q) return true;
  const hay = `${pack.name} ${pack.brand ?? ''}`.toLowerCase();
  return hay.includes(q);
}

export function PaintPacksSheet({ open, onClose, userId, onChanged }: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  /** Refresh the library column after a pack is added/removed. */
  onChanged?: () => void;
}) {
  const { added, browse, loading, error, refetch } = usePaintPacks(userId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();

  // Reload when the sheet is opened, so packs created since mount appear.
  useEffect(() => { if (open) refetch(); }, [open, refetch]);

  const yourPacks = useMemo(() => added.filter(p => matches(p, q)), [added, q]);
  const available = useMemo(() => browse.filter(p => matches(p, q)), [browse, q]);

  const handleAdd = async (pack: PaintPack) => {
    if (!userId || busyId) return;
    setBusyId(pack.id); setActionError(null);
    const { error: err } = await addPaintPack(userId, pack.id);
    setBusyId(null);
    if (err) { setActionError(`Couldn't add "${pack.name}".`); return; }
    await refetch();
    onChanged?.();
  };

  const handleRemove = async (pack: PaintPack) => {
    if (!userId || busyId) return;
    setBusyId(pack.id); setActionError(null);
    const { error: err } = await removePaintPack(userId, pack.id);
    setBusyId(null);
    if (err) { setActionError(`Couldn't remove "${pack.name}".`); return; }
    await refetch();
    onChanged?.();
  };

  return (
    <Sheet open={open} onClose={onClose} className="max-w-lg">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-2 shrink-0">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h2 className="font-heading text-xl text-white leading-7">Paint Packs</h2>
          <p className="font-body text-sm text-neutral-400">Add sets of paints to your collection.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-white shrink-0 mt-0.5">
          <CloseIcon />
        </button>
      </div>

      {/* Body */}
      <div className="px-5 pb-5 lg:overflow-y-auto lg:flex-1 lg:min-h-0 flex flex-col gap-4">
        <Input
          size="sm" type="search" className="w-full"
          placeholder="Search packs…"
          leftIcon={<Magnifer className="w-4 h-4" />}
          value={search} onChange={e => setSearch(e.target.value)}
        />

        {actionError && <p className="font-body text-sm text-red-400">{actionError}</p>}

        {loading ? (
          <p className="py-8 text-center font-body text-sm text-neutral-400">Loading packs…</p>
        ) : error ? (
          <p className="py-8 text-center font-body text-sm text-red-400">{error}</p>
        ) : (
          <>
            {yourPacks.length > 0 && (
              <section className="flex flex-col gap-2">
                <span className="font-body text-sm font-medium text-white">Your Packs</span>
                {yourPacks.map(p => (
                  <PaintPackItem key={p.id} pack={p} busy={busyId === p.id} onRemove={() => handleRemove(p)} />
                ))}
              </section>
            )}

            <section className="flex flex-col gap-2">
              <span className="font-body text-sm font-medium text-white">Available Packs</span>
              {available.length === 0 ? (
                <p className="py-4 text-center font-body text-sm text-neutral-400">
                  {q ? 'No packs match your search.' : added.length > 0 ? 'You’ve added every available pack.' : 'No packs available yet.'}
                </p>
              ) : (
                available.map(p => (
                  <PaintPackItem key={p.id} pack={p} busy={busyId === p.id} onAdd={() => handleAdd(p)} />
                ))
              )}
            </section>
          </>
        )}
      </div>
    </Sheet>
  );
}
