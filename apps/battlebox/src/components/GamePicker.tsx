/**
 * GamePicker.tsx — Searchable single-select of a game (for the Edit forms).
 */

import { useState } from 'react';
import { GAME_ICONS } from './gameIcons';
import { useAllGames } from '../hooks/useCollection';

const ChevronIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" className={className}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export function GamePicker({ value, onChange, enabled = true }: {
  value: string | null;
  onChange: (id: string | null) => void;
  enabled?: boolean;
}) {
  const games = useAllGames(enabled);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = games.find(g => g.id === value) ?? null;
  const shown = games.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 font-body text-sm"
      >
        <span className="flex items-center gap-2 min-w-0">
          {selected && GAME_ICONS[selected.slug] && <img src={GAME_ICONS[selected.slug]} alt="" className="w-5 h-5 rounded object-cover shrink-0" />}
          <span className={selected ? 'text-white truncate' : 'text-neutral-400'}>{selected ? selected.name : 'Select a game'}</span>
        </span>
        <ChevronIcon className={`w-4 h-4 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-2 bg-neutral-800 border border-neutral-700 rounded-lg p-2 flex flex-col gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search games…"
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-2 font-body text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="max-h-56 overflow-y-auto flex flex-col gap-px">
            {shown.length === 0 ? (
              <p className="px-2 py-2 font-body text-sm text-neutral-500">No games found.</p>
            ) : shown.map(g => {
              const icon = GAME_ICONS[g.slug];
              const isSel = g.id === value;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => { onChange(g.id); setOpen(false); setSearch(''); }}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors ${isSel ? 'bg-primary-950' : 'hover:bg-white/5'}`}
                >
                  {icon ? <img src={icon} alt="" className="w-5 h-5 rounded object-cover shrink-0" /> : <span className="w-5 h-5 shrink-0" />}
                  <span className="flex-1 font-body text-sm text-white truncate">{g.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
