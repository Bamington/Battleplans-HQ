/**
 * CollectionPicker.tsx — Searchable single-select of one of the user's
 * collections. Optional: the selection can be cleared with "No collection".
 *
 * When a game is selected, only that game's collections are offered; with no
 * game, every collection is.
 */

import { useEffect, useState } from 'react';
import { useUserBoxes } from '../hooks/useCollection';

const ChevronIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export function CollectionPicker({ userId, gameId, value, onChange, enabled = true }: {
  userId: string | null;
  /** Restrict the options to this game's collections; null shows them all. */
  gameId: string | null;
  value: string | null;
  onChange: (id: string | null) => void;
  enabled?: boolean;
}) {
  const boxes = useUserBoxes(userId, enabled);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const forGame = gameId ? boxes.filter(b => b.game_id === gameId) : boxes;
  const selected = forGame.find(b => b.id === value) ?? null;
  const shown = forGame.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));

  // Changing the game can strand an already-picked collection — drop it once
  // the list has loaded so we never save a mismatched pairing.
  useEffect(() => {
    if (!value || boxes.length === 0) return;
    if (!forGame.some(b => b.id === value)) onChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, boxes.length, value]);

  const pick = (id: string | null) => { onChange(id); setOpen(false); setSearch(''); };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 font-body text-sm"
      >
        <span className={selected ? 'text-white truncate' : 'text-neutral-400'}>
          {selected ? selected.name : 'No collection'}
        </span>
        <ChevronIcon className={`w-4 h-4 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-2 bg-neutral-800 border border-neutral-700 rounded-lg p-2 flex flex-col gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search collections…"
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-2 font-body text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="max-h-56 overflow-y-auto flex flex-col gap-px">
            {/* Clearing option — the field is optional. */}
            <button
              type="button"
              onClick={() => pick(null)}
              className={`flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors ${value === null ? 'bg-primary-950' : 'hover:bg-white/5'}`}
            >
              <span className="flex-1 font-body text-sm text-neutral-400">No collection</span>
            </button>

            {shown.length === 0 ? (
              <p className="px-2 py-2 font-body text-sm text-neutral-500">
                {boxes.length === 0 ? 'No collections yet.'
                  : forGame.length === 0 ? 'No collections for this game.'
                  : 'No collections found.'}
              </p>
            ) : shown.map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => pick(b.id)}
                className={`flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors ${b.id === value ? 'bg-primary-950' : 'hover:bg-white/5'}`}
              >
                <span className="flex-1 font-body text-sm text-white truncate">{b.name}</span>
                <span className="shrink-0 font-body text-xs text-neutral-500">{b.type}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
