/**
 * BookingsDemo.tsx — A playable version of the bookings column
 *
 * Everywhere else on this page the product is a photograph of the real app.
 * This one section is a REPLICA: hand-built markup that looks like the app and
 * responds to a click. That's a deliberate trade and worth being clear-eyed
 * about — a screenshot can't drift, and this can. If BookingItem gets restyled,
 * nothing here fails, nothing tells you, and the page quietly becomes a picture
 * of software you no longer ship.
 *
 * Which is why it's one section rather than five. The drift surface is a single
 * component, and the other four frames stay honest.
 *
 * Deliberately dumb: a hardcoded array and one piece of state. No fetching, no
 * app imports, no reducer.
 */

import { useEffect, useRef, useState } from 'react';

import icon40k from '../../assets/shots/icons/40k.webp';
import iconBattletech from '../../assets/shots/icons/battletech.webp';
import iconBloodBowl from '../../assets/shots/icons/blood-bowl.webp';
import iconBoltAction from '../../assets/shots/icons/bolt-action.webp';
import iconNecromunda from '../../assets/shots/icons/necromunda.webp';

interface Booking {
  id: string;
  game: string;
  icon: string;
  venue: string;
  date: string;
  time: string;
  table: string;
}

/*
 * Ten, where the fixture account has six.
 *
 * Six rows fit the frame exactly, which made a list built to be scrolled sit
 * there refusing to move — the one thing the section is demonstrating.
 *
 * Five venues rather than one. This section stopped being a photograph of a
 * single test account the moment it became code, and a player who only ever
 * books at one shop undersells the thing the page is selling — "one place to
 * book at any store" is a claim two panels up.
 *
 * Every date is a Friday night, a Saturday afternoon or a Sunday morning, and
 * the weekday names are real for 2026 — a booking labelled Friday that fell on
 * a Tuesday is exactly the detail this audience would spot.
 */
const BOOKINGS: Booking[] = [
  { id: 'b1',  game: 'Blood Bowl',       icon: iconBloodBowl,  venue: 'Guf Werribee',         date: 'Friday 07/08/26',   time: '6:00 PM – 10:00 PM', table: 'Table 3' },
  { id: 'b2',  game: 'Battletech',       icon: iconBattletech, venue: 'Top Table Games',      date: 'Saturday 15/08/26', time: '3:00 PM – 6:00 PM',  table: 'Table 1' },
  { id: 'b3',  game: 'Necromunda',       icon: iconNecromunda, venue: 'Burrow Games',         date: 'Sunday 23/08/26',   time: '10:30 AM – 3:00 PM', table: 'Table 5' },
  { id: 'b4',  game: 'Warhammer 40,000', icon: icon40k,        venue: 'Mini Myths Clubhouse', date: 'Friday 04/09/26',   time: '6:00 PM – 10:00 PM', table: 'Table 2' },
  { id: 'b5',  game: 'Bolt Action',      icon: iconBoltAction, venue: 'Victorius',            date: 'Saturday 12/09/26', time: '3:00 PM – 6:00 PM',  table: 'Table 4' },
  { id: 'b6',  game: 'Warhammer 40,000', icon: icon40k,        venue: 'Guf Werribee',         date: 'Friday 02/10/26',   time: '6:00 PM – 10:00 PM', table: 'Table 6' },
  { id: 'b7',  game: 'Blood Bowl',       icon: iconBloodBowl,  venue: 'Burrow Games',         date: 'Saturday 17/10/26', time: '3:00 PM – 6:00 PM',  table: 'Table 1' },
  { id: 'b8',  game: 'Battletech',       icon: iconBattletech, venue: 'Top Table Games',      date: 'Sunday 08/11/26',   time: '10:30 AM – 3:00 PM', table: 'Table 3' },
  { id: 'b9',  game: 'Necromunda',       icon: iconNecromunda, venue: 'Mini Myths Clubhouse', date: 'Friday 20/11/26',   time: '6:00 PM – 10:00 PM', table: 'Table 2' },
  { id: 'b10', game: 'Bolt Action',      icon: iconBoltAction, venue: 'Victorius',            date: 'Saturday 05/12/26', time: '3:00 PM – 6:00 PM',  table: 'Table 5' },
];

export function BookingsDemo() {
  const [open, setOpen] = useState<Booking | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  /* Where to send focus back to, so keyboard users don't lose their place. */
  const openerRef = useRef<HTMLButtonElement | null>(null);

  const close = () => {
    setOpen(null);
    /* Put the caret back where it came from — a keyboard user who dismisses
       this shouldn't be dropped at the top of the document. */
    openerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    // Escape has to go through close(), not setOpen(null): dismissing with the
    // keyboard is precisely the case where focus needs restoring.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div>
      {/* mk-frame-live: no hover scale, because scaling live text resamples it. */}
      <div className="mk-frame mk-frame-live">
        {/*
          Wider than the 9:21 screenshots it sits among, and not as tall as
          widening at that ratio would make it — 20% more width at 9:21 would
          stand 1120px high and tower over every neighbouring section.
        */}
        <div className="mk-frame-inner aspect-[9/17]">
          <div className="mk-demo" role="group" aria-label="Interactive demo of the bookings screen">
            <div className="mk-demo-panel">
              <div className="mk-demo-head">
                <span className="mk-demo-head-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
                       strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8.5 4.5 5h15L21 8.5M3 8.5h18M3 8.5V19h18V8.5M9.5 12h5" />
                  </svg>
                </span>
                <h3 className="mk-demo-title">Your Bookings</h3>
                <p className="mk-demo-sub">Tables you&rsquo;ve booked at your favorite local game stores.</p>
              </div>

              <ul className="mk-demo-list">
                {BOOKINGS.map(booking => (
                  <li key={booking.id}>
                    {/*
                      A real button, not a clickable div. This is an interactive
                      control on a public page now, so it has to be reachable and
                      operable from a keyboard like any other.
                    */}
                    <button
                      type="button"
                      className="mk-demo-row"
                      aria-haspopup="dialog"
                      onClick={e => { openerRef.current = e.currentTarget; setOpen(booking); }}
                    >
                      <img className="mk-demo-row-icon" src={booking.icon} alt="" />
                      <span className="mk-demo-row-text">
                        <span className="mk-demo-row-game">{booking.game}</span>
                        <span className="mk-demo-row-venue">{booking.venue}</span>
                        {/* One line now there's width for it. */}
                        <span className="mk-demo-row-when">{booking.date} &middot; {booking.time}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {/* Present for the shape of the thing, not to be pressed. */}
              <div className="mk-demo-foot" aria-hidden="true">+ New Booking</div>
            </div>

            {open && (
              /*
               * Scoped to the frame rather than the page: it pops over the
               * screenshot, exactly as asked, and clipping to the frame means it
               * can never take the whole page hostage.
               *
               * Deliberately NOT a page-level modal — no body scroll lock and no
               * focus trap, so a reader who scrolls past mid-demo just carries
               * on. That also means no aria-modal, which would claim a trap that
               * doesn't exist. Escape and click-outside both close it, and focus
               * returns to the row that opened it.
               */
              <div className="mk-demo-scrim" onClick={close}>
                <div
                  ref={dialogRef}
                  role="dialog"
                  aria-label={`${open.game} booking details`}
                  tabIndex={-1}
                  className="mk-demo-dialog"
                  onClick={e => e.stopPropagation()}
                >
                  <button type="button" className="mk-demo-dialog-close" onClick={close} aria-label="Close details">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>

                  <img className="mk-demo-dialog-icon" src={open.icon} alt="" />
                  <h4 className="mk-demo-dialog-title">{open.game}</h4>
                  <p className="mk-demo-dialog-venue">{open.venue}</p>

                  <dl className="mk-demo-dialog-rows">
                    <div><dt>When</dt><dd>{open.date}</dd></div>
                    <div><dt>Time</dt><dd>{open.time}</dd></div>
                    <div><dt>Table</dt><dd>{open.table}</dd></div>
                    <div><dt>Status</dt><dd className="mk-demo-dialog-ok">Confirmed</dd></div>
                  </dl>

                  <div className="mk-demo-dialog-actions" aria-hidden="true">
                    <span className="mk-demo-dialog-action">Invite a friend</span>
                    <span className="mk-demo-dialog-action is-danger">Cancel booking</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="mk-caption mt-4 text-center">
        A live demo — pick a booking.
      </p>
    </div>
  );
}
