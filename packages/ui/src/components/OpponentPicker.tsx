/**
 * OpponentPicker.tsx — Chip picker for people from the user's list.
 *
 * Search your existing people and add them as chips; typing a name that
 * doesn't exist yet offers "Create …", which adds it as a new (id-less) chip to
 * be created on save. Friends are offered too (tagged "Friend").
 *
 * Battleplan uses it multi-select for a battle's opponents. With `single`, it
 * holds at most one person (BattleBench's painter): the input hides once
 * someone is picked, and on focus it lists your Friends before you type.
 */

import { useRef, useState, type KeyboardEvent } from 'react';
import CloseCircle from '../icons/CloseCircle';
import UserRounded from '../icons/UserRounded';
import type { Opponent, SelectedOpponent } from '../hooks/useOpponents';

const pick = (o: Opponent): SelectedOpponent => ({ id: o.id, name: o.name, linkedUserId: o.linkedUserId ?? null });

export function OpponentPicker({ value, onChange, options, label = 'Opponents', placeholder = 'Search or add an opponent…', single = false }: {
  value:       SelectedOpponent[];
  onChange:    (v: SelectedOpponent[]) => void;
  options:     Opponent[];
  label?:      string;
  placeholder?: string;
  /** Hold at most one person. */
  single?:     boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const chosen  = new Set(value.map(v => v.name.trim().toLowerCase()));
  const q       = query.trim().toLowerCase();
  // Suggestions once the user has typed — or, picking one person, their Friends straight away.
  const matches = q
    ? options.filter(o => !chosen.has(o.name.trim().toLowerCase()) && o.name.toLowerCase().includes(q)).slice(0, 6)
    : single ? options.filter(o => o.isFriend && !chosen.has(o.name.trim().toLowerCase())).slice(0, 6) : [];
  const exactExists = options.some(o => o.name.trim().toLowerCase() === q);
  const canCreate = q.length > 0 && !exactExists && !chosen.has(q);
  const full = single && value.length > 0;

  const add = (item: SelectedOpponent) => {
    if (chosen.has(item.name.trim().toLowerCase())) return;
    onChange(single ? [item] : [...value, item]);
    setQuery('');
    if (!single) inputRef.current?.focus();
  };
  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const setEmail = (i: number, email: string) =>
    onChange(value.map((v, idx) => (idx === i ? { ...v, email } : v)));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault();
      const existing = options.find(o => o.name.trim().toLowerCase() === q);
      add(existing ? pick(existing) : { id: null, name: query.trim() });
    } else if (e.key === 'Backspace' && !query && value.length) {
      removeAt(value.length - 1);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="block text-sm font-medium font-body text-white">{label}</label>

      <div className="relative">
      <div
        className="flex flex-wrap gap-1.5 items-center w-full px-2.5 py-2 rounded-lg bg-neutral-700 border border-neutral-600 focus-within:border-primary-500 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((v, i) => (
          <span
            key={`${v.id ?? 'new'}-${v.name}-${i}`}
            className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-sm font-body ${v.id || v.linkedUserId ? 'bg-neutral-600 text-white' : 'bg-primary-600/30 text-primary-200 border border-primary-500/50'}`}
          >
            {v.name}
            {!v.id && !v.linkedUserId && <span className="text-[10px] uppercase tracking-wide opacity-70">new</span>}
            <button type="button" aria-label={`Remove ${v.name}`} onClick={e => { e.stopPropagation(); removeAt(i); }} className="text-neutral-300 hover:text-white">
              <CloseCircle className="w-4 h-4" />
            </button>
          </span>
        ))}
        {!full && <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder={value.length ? '' : placeholder}
          className="flex-1 min-w-[8rem] bg-transparent outline-none font-body text-sm text-white placeholder-neutral-400 py-0.5"
        />}
      </div>

      {open && !full && (matches.length > 0 || canCreate) && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg bg-neutral-800 border border-neutral-700 shadow-xl overflow-hidden max-h-56 overflow-y-auto">
          {matches.map(o => (
            <button
              key={o.id ?? `friend-${o.linkedUserId}`}
              type="button"
              onMouseDown={e => { e.preventDefault(); add(pick(o)); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-body text-white hover:bg-neutral-700 text-left"
            >
              <UserRounded className="w-4 h-4 text-neutral-400" /> {o.name}
              {o.isFriend && <span className="ml-auto text-[10px] uppercase tracking-wide text-primary-300">Friend</span>}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); add({ id: null, name: query.trim() }); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-body text-primary-300 hover:bg-neutral-700 text-left border-t border-neutral-700"
            >
              Create “{query.trim()}”
            </button>
          )}
        </div>
      )}
      </div>

      {/* Email inputs for opponents being created — optional, for later matching.
          Friends are already matched to their account, so they get none. */}
      {value.some(v => !v.id && !v.linkedUserId) && (
        <div className="flex flex-col gap-1.5">
          {value.map((v, i) => v.id || v.linkedUserId ? null : (
            <input
              key={`email-${v.name}-${i}`}
              type="email"
              value={v.email ?? ''}
              onChange={e => setEmail(i, e.target.value)}
              placeholder={`${v.name}'s email (optional)`}
              className="w-full px-3 py-2 rounded-lg bg-neutral-700 border border-neutral-600 focus:border-primary-500 outline-none font-body text-sm text-white placeholder-neutral-400"
            />
          ))}
        </div>
      )}
    </div>
  );
}
