/**
 * DayDemo.tsx — A playable version of the venue's booking day
 *
 * Fifth replica across the two pages. Same trade as the others: markup that
 * looks like the app rather than a photograph of it, so it can drift silently.
 * See BookingsDemo for the full argument.
 *
 * Two interactions, both taken straight from the copy beside it. "Today's
 * bookings, always front and centre" is the default view; "look ahead to any
 * date" is the stepper. A section that claims you can move through the diary
 * and then shows a still image is asking to be taken on trust.
 */

import { useEffect, useRef, useState } from 'react';

type SlotName = 'Morning' | 'Afternoon' | 'Evening';

interface Booking {
  id: string;
  who: string;
  handle: string;
  game: string;
  slot: SlotName;
  table: string;
  booked: string;
}

interface Day {
  label: string;
  date: string;
  bookings: Booking[];
}

const SLOT_TIMES: Record<SlotName, string> = {
  Morning: '10:30 AM – 3:00 PM',
  Afternoon: '3:00 PM – 6:00 PM',
  Evening: '6:00 PM – 10:00 PM',
};

const SLOT_ORDER: SlotName[] = ['Morning', 'Afternoon', 'Evening'];

/*
 * Five days at Burrow Games, opening on the busy one.
 *
 * Monday is deliberately empty. A stepper that only ever moves between full
 * days doesn't show a venue anything it didn't already assume, and the quiet
 * Monday is the observation the Store Stats section two panels down is built
 * on — the page shouldn't contradict itself between sections.
 *
 * Evenings only run Wednesday to Friday at this venue, which is why the
 * weekend days here are mornings and afternoons only.
 */
const DAYS: Day[] = [
  {
    label: 'Today', date: 'Friday 07/08/26',
    bookings: [
      { id: 'd1a', who: 'Marcus Webb',   handle: '@marcuswebb',   game: 'Blood Bowl',       slot: 'Evening',   table: 'Table 3', booked: '31/07/26' },
      { id: 'd1b', who: 'Priya Nair',    handle: '@priyanair',    game: 'Warhammer 40,000', slot: 'Evening',   table: 'Table 1', booked: '02/08/26' },
      { id: 'd1c', who: 'Tom Ashworth',  handle: '@tomashworth',  game: 'Necromunda',       slot: 'Evening',   table: 'Table 5', booked: '03/08/26' },
      { id: 'd1d', who: 'Ellie Zhang',   handle: '@elliezhang',   game: 'Age of Sigmar',    slot: 'Afternoon', table: 'Table 2', booked: '05/08/26' },
    ],
  },
  {
    label: 'Tomorrow', date: 'Saturday 08/08/26',
    bookings: [
      { id: 'd2a', who: 'Hannah Foster', handle: '@hannahfoster', game: 'Battletech',       slot: 'Morning',   table: 'Table 4', booked: '01/08/26' },
      { id: 'd2b', who: 'Josh Brennan',  handle: '@joshbrennan',  game: 'Blood Bowl',       slot: 'Afternoon', table: 'Table 1', booked: '04/08/26' },
      { id: 'd2c', who: 'Sofia Reyes',   handle: '@sofiareyes',   game: 'Warhammer 40,000', slot: 'Afternoon', table: 'Table 6', booked: '04/08/26' },
    ],
  },
  {
    label: '', date: 'Sunday 09/08/26',
    bookings: [
      { id: 'd3a', who: 'Rob Sinclair',  handle: '@robsinclair',  game: 'Bolt Action',      slot: 'Morning',   table: 'Table 2', booked: '02/08/26' },
    ],
  },
  { label: '', date: 'Monday 10/08/26', bookings: [] },
  {
    label: '', date: 'Tuesday 11/08/26',
    bookings: [
      { id: 'd5a', who: 'Amara Diallo',  handle: '@amaradiallo',  game: 'Necromunda',       slot: 'Afternoon', table: 'Table 3', booked: '05/08/26' },
      { id: 'd5b', who: 'Daniel Okafor', handle: '@danielokafor', game: 'Battletech',       slot: 'Afternoon', table: 'Table 5', booked: '06/08/26' },
    ],
  },
];

export function DayDemo() {
  const [dayIndex, setDayIndex] = useState(0);
  const [open, setOpen] = useState<Booking | null>(null);
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

  const day = DAYS[dayIndex];
  const slotsWithBookings = SLOT_ORDER.filter(slot => day.bookings.some(b => b.slot === slot));

  return (
    <div>
      <div className="mk-frame mk-frame-live">
        <div className="mk-frame-inner aspect-[9/17]">
          <div className="mk-demo" role="group" aria-label="Interactive demo of a venue's booking day">
            <div className="mk-demo-panel">
              <div className="mk-demo-head">
                <span className="mk-demo-head-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
                       strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="16" rx="3" />
                    <path d="M3 10h18M8 3v4M16 3v4" />
                  </svg>
                </span>
                {/*
                  "Bookings by Date", not "Today's Bookings".
                  Adding a stepper made the old title contradict itself the
                  moment you moved off today — and Manage Store already has a
                  panel of exactly this shape under exactly this name, so
                  matching it is the accurate choice as well as the coherent
                  one. The Today chip below carries the "front and centre" part.
                */}
                <h3 className="mk-demo-title">Bookings by Date</h3>
                <p className="mk-demo-sub">Bookings at Burrow Games on the chosen date.</p>
              </div>

              {/* Stepping through days is the section's second bullet, so it's
                  a real control rather than a painted-on arrow. */}
              <div className="mk-day-nav">
                <button
                  type="button"
                  className="mk-day-arrow"
                  aria-label="Previous day"
                  disabled={dayIndex === 0}
                  onClick={() => setDayIndex(i => Math.max(0, i - 1))}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 6l-6 6 6 6" />
                  </svg>
                </button>

                {/* Announced on change, since the list below it swaps silently. */}
                <p className="mk-day-label" aria-live="polite">
                  {day.label && <span className="mk-day-today">{day.label}</span>}
                  {day.date}
                </p>

                <button
                  type="button"
                  className="mk-day-arrow"
                  aria-label="Next day"
                  disabled={dayIndex === DAYS.length - 1}
                  onClick={() => setDayIndex(i => Math.min(DAYS.length - 1, i + 1))}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              </div>

              <div className="mk-demo-list">
                {slotsWithBookings.length === 0 ? (
                  /* The quiet day. A venue recognises this screen. */
                  <p className="mk-day-empty">No bookings on this day.</p>
                ) : slotsWithBookings.map(slot => (
                  <div key={slot} className="mk-day-group">
                    <p className="mk-day-slot">{slot} &middot; {SLOT_TIMES[slot]}</p>
                    {day.bookings.filter(b => b.slot === slot).map(booking => (
                      <button
                        key={booking.id}
                        type="button"
                        className="mk-day-booking"
                        aria-haspopup="dialog"
                        onClick={e => { openerRef.current = e.currentTarget; setOpen(booking); }}
                      >
                        <span className="mk-day-who">{booking.who}</span>
                        <span className="mk-day-game">{booking.game}</span>
                        <span className="mk-day-table">{booking.table}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              <div className="mk-demo-foot" aria-hidden="true">+ New Booking</div>
            </div>

            {open && (
              /* Same contract as the other dialogs — scoped to the frame, no
                 scroll lock, no focus trap, Escape and click-outside close and
                 restore focus. See BookingsDemo for why not aria-modal. */
              <div className="mk-demo-scrim" onClick={close}>
                <div
                  ref={dialogRef}
                  role="dialog"
                  aria-label={`Booking for ${open.who}`}
                  tabIndex={-1}
                  className="mk-demo-dialog"
                  onClick={e => e.stopPropagation()}
                >
                  <button type="button" className="mk-demo-dialog-close" onClick={close} aria-label="Close details">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>

                  <h4 className="mk-demo-dialog-title">{open.who}</h4>
                  <p className="mk-demo-dialog-venue">{open.game}</p>

                  <dl className="mk-demo-dialog-rows">
                    <div><dt>Slot</dt><dd>{open.slot} &middot; {SLOT_TIMES[open.slot]}</dd></div>
                    <div><dt>Table</dt><dd>{open.table}</dd></div>
                    <div><dt>Booked on</dt><dd>{open.booked}</dd></div>
                    {/* Bookings group by account, not by the name typed on them
                        — the distinction the Store Stats section relies on. */}
                    <div><dt>Account</dt><dd className="mk-demo-dialog-handle">{open.handle}</dd></div>
                  </dl>

                  <div className="mk-demo-dialog-actions" aria-hidden="true">
                    <span className="mk-demo-dialog-action">Message player</span>
                    <span className="mk-demo-dialog-action is-danger">Cancel booking</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
