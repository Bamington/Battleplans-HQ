import { useEffect, useState } from 'react';
import { Sheet, Button } from '@battleplans/ui';
import { GAME_ICONS } from './gameIcons';
import { useOwnedGames, EMPTY_MODEL_FILTERS, activeModelFilterCount } from '../hooks/useCollection';
import type { ModelFilters, ModelStatus } from '../hooks/useCollection';

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

// ── Statuses + date presets ───────────────────────────────────────────────────

const STATUSES: { value: ModelStatus; label: string }[] = [
  { value: 'None',              label: 'Unpainted' },
  { value: 'Assembled',         label: 'Assembled' },
  { value: 'Primed',            label: 'Primed' },
  { value: 'Partially Painted', label: 'Partially Painted' },
  { value: 'Painted',           label: 'Painted' },
];

/** Local YYYY-MM-DD (avoids the UTC shift of toISOString). */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const PRESETS: { label: string; range: () => { from: string; to: string } }[] = [
  { label: 'Today',      range: () => { const t = new Date(); return { from: iso(t), to: iso(t) }; } },
  { label: 'This Week',  range: () => { const t = new Date(); const s = new Date(t); s.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return { from: iso(s), to: iso(t) }; } },
  { label: 'This Month', range: () => { const t = new Date(); return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(t) }; } },
];

// ── Building blocks ───────────────────────────────────────────────────────────

function Section({ title, active, onReset, children }: {
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

function DateRange({ from, to, onChange }: {
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

// ── Sheet ─────────────────────────────────────────────────────────────────────

export function ModelFilterSheet({ open, onClose, userId, value, onApply }: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  value: ModelFilters;
  onApply: (filters: ModelFilters) => void;
}) {
  const games = useOwnedGames(userId);
  const [draft, setDraft] = useState<ModelFilters>(value);
  const [gameOpen, setGameOpen] = useState(false);
  const [gameSearch, setGameSearch] = useState('');

  // Reset the working copy to the applied filters each time the sheet opens.
  useEffect(() => {
    if (open) { setDraft(value); setGameOpen(false); setGameSearch(''); }
  }, [open, value]);

  const toggleStatus = (s: ModelStatus) => setDraft(d => ({
    ...d, statuses: d.statuses.includes(s) ? d.statuses.filter(x => x !== s) : [...d.statuses, s],
  }));
  const toggleGame = (id: string) => setDraft(d => ({
    ...d, gameIds: d.gameIds.includes(id) ? d.gameIds.filter(x => x !== id) : [...d.gameIds, id],
  }));

  const count = activeModelFilterCount(draft);
  const shownGames = games.filter(g => g.name.toLowerCase().includes(gameSearch.toLowerCase()));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      className="max-w-md"
      footer={
        <div className="px-5 py-4 border-t border-neutral-800 flex gap-3">
          <Button variant="outline" color="secondary" className="flex-1 justify-center" onClick={() => setDraft(EMPTY_MODEL_FILTERS)}>
            Reset All
          </Button>
          <Button color="primary" className="flex-1 justify-center" onClick={() => onApply(draft)}>
            Apply Filters{count ? ` (${count})` : ''}
          </Button>
        </div>
      }
    >
      <div className="px-5 pt-5 pb-1 shrink-0">
        <h2 className="font-heading text-xl text-white">Filter Models</h2>
      </div>

      <div className="px-5 py-4 lg:overflow-y-auto lg:flex-1 lg:min-h-0 flex flex-col gap-6">
        <Section
          title="Purchase Date"
          active={!!(draft.purchaseFrom || draft.purchaseTo)}
          onReset={() => setDraft(d => ({ ...d, purchaseFrom: null, purchaseTo: null }))}
        >
          <DateRange
            from={draft.purchaseFrom} to={draft.purchaseTo}
            onChange={(f, t) => setDraft(d => ({ ...d, purchaseFrom: f, purchaseTo: t }))}
          />
        </Section>

        <hr className="border-neutral-800" />

        <Section
          title="Painted Date"
          active={!!(draft.paintedFrom || draft.paintedTo)}
          onReset={() => setDraft(d => ({ ...d, paintedFrom: null, paintedTo: null }))}
        >
          <DateRange
            from={draft.paintedFrom} to={draft.paintedTo}
            onChange={(f, t) => setDraft(d => ({ ...d, paintedFrom: f, paintedTo: t }))}
          />
        </Section>

        <hr className="border-neutral-800" />

        <Section title="Painted Status" active={draft.statuses.length > 0} onReset={() => setDraft(d => ({ ...d, statuses: [] }))}>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map(s => {
              const sel = draft.statuses.includes(s.value);
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => toggleStatus(s.value)}
                  className={`px-3 py-1.5 rounded-full font-body text-sm transition-colors ${
                    sel ? 'bg-primary-600 text-white' : 'border border-neutral-700 text-neutral-300 hover:bg-neutral-800'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </Section>

        <hr className="border-neutral-800" />

        <Section title="Game" active={draft.gameIds.length > 0} onReset={() => setDraft(d => ({ ...d, gameIds: [] }))}>
          <button
            type="button"
            onClick={() => setGameOpen(o => !o)}
            className="w-full flex items-center justify-between bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 font-body text-sm"
          >
            <span className={draft.gameIds.length ? 'text-white' : 'text-neutral-400'}>
              {draft.gameIds.length ? `${draft.gameIds.length} selected` : 'All games'}
            </span>
            <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${gameOpen ? 'rotate-180' : ''}`} />
          </button>

          {gameOpen && (
            <div className="mt-2 bg-neutral-800 border border-neutral-700 rounded-lg p-2 flex flex-col gap-2">
              <input
                value={gameSearch}
                onChange={e => setGameSearch(e.target.value)}
                placeholder="Search games…"
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-2 font-body text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <div className="flex flex-col gap-px">
                {shownGames.length === 0 ? (
                  <p className="px-2 py-2 font-body text-sm text-neutral-500">No games found.</p>
                ) : shownGames.map(g => {
                  const checked = draft.gameIds.includes(g.id);
                  const icon = GAME_ICONS[g.slug];
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGame(g.id)}
                      className={`flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors ${checked ? 'bg-primary-950' : 'hover:bg-white/5'}`}
                    >
                      {icon ? <img src={icon} alt="" className="w-5 h-5 rounded object-cover shrink-0" /> : <span className="w-5 h-5 shrink-0" />}
                      <span className="flex-1 font-body text-sm text-white truncate">{g.name}</span>
                      <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${checked ? 'bg-primary-600 border-primary-600' : 'border-neutral-500'}`}>
                        {checked && <Check className="w-2.5 h-2.5 text-white" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Section>
      </div>
    </Sheet>
  );
}
