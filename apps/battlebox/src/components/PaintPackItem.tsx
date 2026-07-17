/**
 * PaintPackItem.tsx — One paint pack in the Paints column: brand thumbnail,
 * name, an "N paints" badge, an optional Official pill and description, and two
 * actions — View Pack (opens the contents modal) and Add / Remove.
 */

import { Button, AddCircle } from '@battleplans/ui';
import type { PaintPack } from '../hooks/usePaintPacks';

const TrashIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M3 4.5h10M6.5 4V3h3v1M5 4.5l.5 8h5l.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EyeIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

export function PaintPackItem({ pack, busy, onAdd, onRemove, onView }: {
  pack: PaintPack;
  busy: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onView: () => void;
}) {
  const initial = (pack.brand || pack.name).trim().charAt(0).toUpperCase();
  return (
    <div className="flex flex-col gap-2 w-full p-3 bg-neutral-900 border border-neutral-700 rounded-lg">
      {/* Header: thumbnail + title + brand */}
      <div className="flex gap-2.5 items-start w-full">
        <div className="shrink-0 size-12 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center font-heading text-lg text-primary-400">
          {initial}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {pack.is_official && (
            <span className="self-start mb-1 px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-body leading-none">
              Official
            </span>
          )}
          <p className="font-heading text-base text-white leading-5 truncate">{pack.name}</p>
          {pack.brand && <p className="font-body text-xs text-neutral-400 truncate">{pack.brand}</p>}
        </div>
      </div>

      {/* Content badge */}
      <div className="flex flex-wrap gap-1">
        <span className="px-2 py-0.5 rounded-full bg-primary-600/20 text-primary-300 text-xs font-body">
          {pack.item_count} {pack.item_count === 1 ? 'paint' : 'paints'}
        </span>
        {pack.added && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-300 text-xs font-body">
            In your collection
          </span>
        )}
      </div>

      {pack.description && (
        <p className="font-body text-sm text-neutral-300">{pack.description}</p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 w-full pt-0.5">
        <Button variant="ghost" color="secondary" size="sm" leftIcon={<EyeIcon />} onClick={onView}>
          View Pack
        </Button>
        {pack.added ? (
          <Button variant="ghost" color="secondary" size="sm" leftIcon={<TrashIcon />} disabled={busy} onClick={onRemove}>
            Remove
          </Button>
        ) : (
          <Button variant="outline" color="primary" size="sm" leftIcon={<AddCircle className="w-4 h-4" />} disabled={busy} onClick={onAdd}>
            Add to Collection
          </Button>
        )}
      </div>
    </div>
  );
}
