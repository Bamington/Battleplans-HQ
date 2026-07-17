/**
 * PaintItem.tsx — One paint in the user's library column: a colour swatch, the
 * paint name, and a brand · range · type subtitle.
 */

import type { LibraryPaint } from '../hooks/usePaintPacks';

const HEX = /^#[0-9a-fA-F]{6}$/;

export function PaintItem({ paint }: { paint: LibraryPaint }) {
  const subtitle = [paint.brand, paint.sub_brand].filter(Boolean).join(' ') + ` · ${paint.type}`;
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-neutral-700 bg-neutral-900">
      <span
        className="w-6 h-6 rounded-full shrink-0 border border-neutral-600"
        style={HEX.test(paint.swatch) ? { backgroundColor: paint.swatch } : undefined}
        aria-hidden="true"
      />
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="font-body text-sm text-white truncate">{paint.name}</span>
        <span className="font-body text-xs text-neutral-400 truncate">{subtitle}</span>
      </span>
    </div>
  );
}
