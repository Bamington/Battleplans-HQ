/**
 * PaintPackDetailModal.tsx — Opened by "View Pack". Shows a pack's header and
 * the full list of paints it contains, with an Add / Remove action pinned at
 * the bottom.
 */

import { useEffect, useState } from 'react';
import { Sheet, Button, AddCircle } from '@battleplans/ui';
import { CloseIcon } from './paintPickerBits';
import { PaintItem } from './PaintItem';
import { fetchPackPaints, paintPackImageUrl } from '../hooks/usePaintPacks';
import type { PaintPack, LibraryPaint } from '../hooks/usePaintPacks';

const TrashIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M3 4.5h10M6.5 4V3h3v1M5 4.5l.5 8h5l.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function PaintPackDetailModal({ pack, busy, onClose, onAdd, onRemove }: {
  pack: PaintPack | null;
  busy: boolean;
  onClose: () => void;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const [paints, setPaints] = useState<LibraryPaint[]>([]);
  const [loading, setLoading] = useState(true);
  const packId = pack?.id ?? null;

  useEffect(() => {
    if (!packId) return;
    setLoading(true);
    let cancelled = false;
    fetchPackPaints(packId).then(ps => { if (!cancelled) { setPaints(ps); setLoading(false); } });
    return () => { cancelled = true; };
  }, [packId]);

  return (
    <Sheet
      open={pack !== null}
      onClose={onClose}
      className="max-w-lg"
      footer={pack && (
        <div className="p-4 border-t border-neutral-800">
          {pack.added ? (
            <Button variant="outline" color="secondary" leftIcon={<TrashIcon />} disabled={busy} onClick={onRemove} className="w-full justify-center">
              Remove from Collection
            </Button>
          ) : (
            <Button color="primary" leftIcon={<AddCircle className="w-4 h-4" />} disabled={busy} onClick={onAdd} className="w-full justify-center">
              Add to Collection
            </Button>
          )}
        </div>
      )}
    >
      {pack && (
        <>
          {/* Header */}
          <div className="px-5 pt-4 pb-3 flex items-start gap-3 shrink-0">
            {paintPackImageUrl(pack.image_path) && (
              <div className="shrink-0 size-14 rounded-lg overflow-hidden bg-neutral-800 border border-neutral-700">
                <img src={paintPackImageUrl(pack.image_path)!} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              {pack.is_official && (
                <span className="self-start mb-1 px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-body leading-none">
                  Official
                </span>
              )}
              <h2 className="font-heading text-xl text-white leading-7">{pack.name}</h2>
              <p className="font-body text-sm text-neutral-400">
                {pack.brand ? `${pack.brand} · ` : ''}{pack.item_count} {pack.item_count === 1 ? 'paint' : 'paints'}
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-white shrink-0 mt-0.5">
              <CloseIcon />
            </button>
          </div>

          {/* Paint list */}
          <div className="px-5 pb-5 lg:overflow-y-auto lg:flex-1 lg:min-h-0 flex flex-col gap-1.5">
            {loading ? (
              <p className="py-8 text-center font-body text-sm text-neutral-400">Loading paints…</p>
            ) : (
              paints.map(p => <PaintItem key={p.id} paint={p} />)
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
