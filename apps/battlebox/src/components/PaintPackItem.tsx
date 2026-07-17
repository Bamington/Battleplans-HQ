/**
 * PaintPackItem.tsx — One paint pack in the Paints column: brand thumbnail,
 * name, an "N paints" badge (plus an "In your collection" badge when added),
 * and a description. The whole card is a button — clicking it opens the View
 * Pack modal, where the pack can be added or removed.
 */

import { paintPackImageUrl } from '../hooks/usePaintPacks';
import type { PaintPack } from '../hooks/usePaintPacks';

export function PaintPackItem({ pack, onClick }: {
  pack: PaintPack;
  onClick: () => void;
}) {
  const initial = (pack.brand || pack.name).trim().charAt(0).toUpperCase();
  const logo = paintPackImageUrl(pack.image_path);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2 w-full p-3 bg-neutral-900 border border-neutral-700 rounded-lg text-left hover:border-neutral-500 transition-colors"
    >
      {/* Header: thumbnail + title + brand */}
      <div className="flex gap-2.5 items-start w-full">
        <div className="shrink-0 size-12 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center overflow-hidden font-heading text-lg text-primary-400">
          {logo ? <img src={logo} alt="" className="w-full h-full object-cover" /> : initial}
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

      {/* Badges */}
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
    </button>
  );
}
