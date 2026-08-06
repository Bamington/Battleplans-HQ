/**
 * TablesDemo.tsx — A playable version of the venue's tables panel
 *
 * Fourth replica across the two pages, and the only one on the venue side. Same
 * trade as the others: markup that looks like the app rather than a photograph
 * of it, so it can drift silently. See BookingsDemo for the full argument.
 *
 * This is the one section where the interaction is the argument. The copy beside
 * it says "you decide what's bookable, the app enforces it" and "change any of
 * it whenever you like — it takes effect immediately", and a switch that
 * actually moves demonstrates that better than any amount of prose. Which is
 * why the toggle mutates state here where the other three demos only open a
 * dialog.
 */

import { useEffect, useRef, useState } from 'react';

type Slot = 'Morning' | 'Afternoon' | 'Evening';

interface Table {
  id: string;
  name: string;
  size: 'wargaming' | 'tcg';
  slots: Slot[];
}

/*
 * Burrow Games' actual layout from the fixture: six wargaming tables and two
 * for card games, the TCG pair not open in the mornings. Table 6 starts
 * switched off, because a panel where everything is on doesn't show that
 * anything can be turned off.
 */
const TABLES: Table[] = [
  { id: 't1', name: 'Table 1', size: 'wargaming', slots: ['Morning', 'Afternoon', 'Evening'] },
  { id: 't2', name: 'Table 2', size: 'wargaming', slots: ['Morning', 'Afternoon', 'Evening'] },
  { id: 't3', name: 'Table 3', size: 'wargaming', slots: ['Morning', 'Afternoon', 'Evening'] },
  { id: 't4', name: 'Table 4', size: 'wargaming', slots: ['Morning', 'Afternoon', 'Evening'] },
  { id: 't5', name: 'Table 5', size: 'wargaming', slots: ['Morning', 'Afternoon', 'Evening'] },
  { id: 't6', name: 'Table 6', size: 'wargaming', slots: ['Morning', 'Afternoon', 'Evening'] },
  { id: 'c1', name: 'TCG 1',   size: 'tcg',       slots: ['Afternoon', 'Evening'] },
  { id: 'c2', name: 'TCG 2',   size: 'tcg',       slots: ['Afternoon', 'Evening'] },
];

const ALL_SLOTS: Slot[] = ['Morning', 'Afternoon', 'Evening'];

export function TablesDemo() {
  const [bookable, setBookable] = useState<Record<string, boolean>>(
    () => Object.fromEntries(TABLES.map(t => [t.id, t.id !== 't6'])),
  );
  const [open, setOpen] = useState<Table | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  const close = () => {
    setOpen(null);
    openerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div>
      <div className="mk-frame mk-frame-live">
        <div className="mk-frame-inner aspect-[9/17]">
          <div className="mk-demo" role="group" aria-label="Interactive demo of the venue tables panel">
            <div className="mk-demo-panel">
              <div className="mk-demo-head">
                <span className="mk-demo-head-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
                       strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
                    <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
                  </svg>
                </span>
                <h3 className="mk-demo-title">Tables</h3>
                <p className="mk-demo-sub">The tables players can book at Burrow Games.</p>
              </div>

              <ul className="mk-demo-list">
                {TABLES.map(table => {
                  const on = bookable[table.id];
                  return (
                    /*
                      The row is a plain element with two controls inside it, not
                      one button wrapping another — nesting buttons is invalid
                      and leaves the inner one unreachable in some browsers.
                    */
                    <li key={table.id} className={`mk-table-row ${on ? '' : 'is-off'}`}>
                      <button
                        type="button"
                        className="mk-table-open"
                        aria-haspopup="dialog"
                        onClick={e => { openerRef.current = e.currentTarget; setOpen(table); }}
                      >
                        <span className="mk-table-name">
                          {table.name}
                          <span className="mk-table-badge">{table.size === 'tcg' ? 'TCG' : 'Wargaming'}</span>
                        </span>
                        <span className="mk-table-slots">
                          Available for {table.slots.length} of {ALL_SLOTS.length} timeslots
                        </span>
                        <span className={`mk-table-state ${on ? 'is-on' : ''}`}>
                          {on ? 'On — bookable' : 'Off — hidden from players'}
                        </span>
                      </button>

                      {/*
                        role="switch" rather than a checkbox: it's an on/off
                        state that takes effect immediately, which is exactly
                        what the copy beside this section claims.
                      */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={`${table.name} bookable`}
                        className="mk-table-switch"
                        onClick={() => setBookable(b => ({ ...b, [table.id]: !b[table.id] }))}
                      >
                        <span className="mk-table-switch-knob" />
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="mk-demo-foot" aria-hidden="true">+ Add Table</div>
            </div>

            {open && (
              /* Same contract as the other dialogs — scoped to the frame, no
                 scroll lock, no focus trap, Escape and click-outside close and
                 restore focus. See BookingsDemo for why not aria-modal. */
              <div className="mk-demo-scrim" onClick={close}>
                <div
                  ref={dialogRef}
                  role="dialog"
                  aria-label={`${open.name} settings`}
                  tabIndex={-1}
                  className="mk-demo-dialog"
                  onClick={e => e.stopPropagation()}
                >
                  <button type="button" className="mk-demo-dialog-close" onClick={close} aria-label="Close details">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>

                  <h4 className="mk-demo-dialog-title">{open.name}</h4>
                  <p className="mk-demo-dialog-venue">Burrow Games</p>

                  {/*
                    Every slot shown, with the ones this table isn't open for
                    dimmed. Listing only the active ones would hide the actual
                    point — that a venue chooses, per table.
                  */}
                  <div className="mk-table-chips" aria-hidden="true">
                    {ALL_SLOTS.map(slot => (
                      <span key={slot} className={`mk-table-chip ${open.slots.includes(slot) ? 'is-on' : ''}`}>
                        {slot}
                      </span>
                    ))}
                  </div>

                  <dl className="mk-demo-dialog-rows">
                    <div><dt>Type</dt><dd>{open.size === 'tcg' ? 'Card games' : 'Wargaming'}</dd></div>
                    <div>
                      <dt>Bookable in</dt>
                      <dd>{open.slots.join(', ')}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd className={bookable[open.id] ? 'mk-demo-dialog-ok' : 'mk-friend-poor'}>
                        {bookable[open.id] ? 'Bookable' : 'Hidden'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="mk-caption mt-4 text-center">
        A live demo — switch a table off.
      </p>
    </div>
  );
}
