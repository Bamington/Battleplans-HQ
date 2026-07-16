/**
 * filterControls.tsx — Shared building blocks for the filter sheets (models +
 * collections): section headers, collapsible accordions, a date range with
 * presets, toggle chips, and the game multi-select dropdown. All in BattleBox's
 * neutral/amber language.
 */

import { useState } from 'react';
import { GAME_ICONS } from './gameIcons';
import type { OwnedGame } from '../hooks/useCollection';

// ── Icons ─────────────────────────────────────────────────────────────────────

const ChevronDown = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Check = ({ className = 'w-3 h-3' }: { className?: string }) => (
  <svg viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── Section + accordion ───────────────────────────────────────────────────────

export function Section({ title, active, onReset, children }: {
  title: string; active: boolean; onReset: () => void; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base text-white">{title}</h3>
        {active && (
          <button type="button" onClick={onReset} className="font-body text-sm text-primary-500 hover:text-primary-400">
            Reset
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/** A collapsible section — collapsed by default, opens when its filter is set. */
export function Accordion({ title, active, expanded, onToggle, onReset, children }: {
  title: string; active: boolean; expanded: boolean; onToggle: () => void; onReset: () => void; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onToggle} className="flex items-center gap-2 min-w-0">
          <h3 className="font-heading text-base text-white">{title}</h3>
          {active && <span className="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" aria-hidden="true" />}
        </button>
        <div className="flex items-center gap-3 shrink-0">
          {active && (
            <button type="button" onClick={onReset} className="font-body text-sm text-primary-500 hover:text-primary-400">
              Reset
            </button>
          )}
          <button type="button" onClick={onToggle} aria-label={expanded ? 'Collapse' : 'Expand'} className="text-neutral-400 hover:text-neutral-200">
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      {expanded && children}
    </div>
  );
}

// ── Toggle chip ───────────────────────────────────────────────────────────────

export function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full font-body text-sm transition-colors ${
        selected ? 'bg-primary-600 text-white' : 'border border-neutral-700 text-neutral-300 hover:bg-neutral-800'
      }`}
    >
      {label}
    </button>
  );
}

// ── Date range ────────────────────────────────────────────────────────────────

/** Local YYYY-MM-DD (avoids the UTC shift of toISOString). */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const PRESETS: { label: string; range: () => { from: string; to: string } }[] = [
  { label: 'Today',      range: () => { const t = new Date(); return { from: iso(t), to: iso(t) }; } },
  { label: 'This Week',  range: () => { const t = new Date(); const s = new Date(t); s.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return { from: iso(s), to: iso(t) }; } },
  { label: 'This Month', range: () => { const t = new Date(); return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(t) }; } },
];

function DateField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <label className="flex-1 flex flex-col gap-1 min-w-0">
      <span className="font-body text-xs text-neutral-400">{label}</span>
      <input
        type="date"
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 font-body text-sm text-white [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
    </label>
  );
}

export function DateRange({ from, to, onChange }: {
  from: string | null; to: string | null; onChange: (from: string | null, to: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <DateField label="From" value={from} onChange={v => onChange(v, to)} />
        <DateField label="To"   value={to}   onChange={v => onChange(from, v)} />
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => { const r = p.range(); onChange(r.from, r.to); }}
            className="px-3 py-1.5 rounded-full border border-neutral-700 font-body text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Game multi-select ─────────────────────────────────────────────────────────

/** A searchable multi-select of games with per-game counts. Its open/search
 *  state is local and resets when the sheet remounts it. */
export function GameMultiSelect({ games, selected, onToggle }: {
  games: OwnedGame[]; selected: string[]; onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const shown = games.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 font-body text-sm"
      >
        <span className={selected.length ? 'text-white' : 'text-neutral-400'}>
          {selected.length ? `${selected.length} selected` : 'All games'}
        </span>
        <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-2 bg-neutral-800 border border-neutral-700 rounded-lg p-2 flex flex-col gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search games…"
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-2 font-body text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="flex flex-col gap-px">
            {shown.length === 0 ? (
              <p className="px-2 py-2 font-body text-sm text-neutral-500">No games found.</p>
            ) : shown.map(g => {
              const checked = selected.includes(g.id);
              const icon = GAME_ICONS[g.slug];
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onToggle(g.id)}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors ${checked ? 'bg-primary-950' : 'hover:bg-white/5'}`}
                >
                  {icon ? <img src={icon} alt="" className="w-5 h-5 rounded object-cover shrink-0" /> : <span className="w-5 h-5 shrink-0" />}
                  <span className="flex-1 font-body text-sm text-white truncate">
                    {g.name} <span className="text-neutral-500">({g.count})</span>
                  </span>
                  <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${checked ? 'bg-primary-600 border-primary-600' : 'border-neutral-500'}`}>
                    {checked && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
