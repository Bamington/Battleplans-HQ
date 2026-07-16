/**
 * KebabMenu.tsx — A three-dots button that opens a small action popover.
 */

import { useEffect, useRef, useState } from 'react';

const DotsIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="currentColor" className={className}>
    <circle cx="8" cy="3" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="8" cy="13" r="1.4" />
  </svg>
);

export interface KebabItem { label: string; onClick: () => void; danger?: boolean }

export function KebabMenu({ items, label = 'Menu' }: { items: KebabItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" onClick={() => setOpen(o => !o)} aria-label={label} className="p-1 text-neutral-400 hover:text-white transition-colors">
        <DotsIcon />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-36 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl py-1 flex flex-col">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setOpen(false); it.onClick(); }}
              className={`px-3 py-2 text-left font-body text-sm hover:bg-white/5 ${it.danger ? 'text-red-400' : 'text-white'}`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
