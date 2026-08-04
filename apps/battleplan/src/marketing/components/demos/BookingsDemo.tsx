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
 * app imports, no reducer. The data matches the Burrow Games fixture used by
 * every screenshot on the page, so a reader who scrolls between them sees one
 * coherent account rather than two different sets of invented people.
 */

import { useState } from 'react';

import icon40k from '../../assets/shots/icons/40k.webp';
import iconBattletech from '../../assets/shots/icons/battletech.webp';
import iconBloodBowl from '../../assets/shots/icons/blood-bowl.webp';
import iconBoltAction from '../../assets/shots/icons/bolt-action.webp';
import iconNecromunda from '../../assets/shots/icons/necromunda.webp';

interface Booking {
  id: string;
  game: string;
  icon: string;
  date: string;
  time: string;
  /** Revealed on selection — the detail a real booking row hides until tapped. */
  table: string;
}

/*
 * Ten, where the fixture account has six.
 *
 * Six rows fit the frame exactly, which made a list built to be scrolled sit
 * there refusing to move — the one thing the section is demonstrating. The
 * extra four continue the same account's pattern rather than inventing a
 * different one.
 */
const BOOKINGS: Booking[] = [
  { id: 'bt',  game: 'Battletech',       icon: iconBattletech, date: 'Wednesday 05/08/26', time: '3:00 PM – 6:00 PM',  table: 'Table 2' },
  { id: 'ba1', game: 'Bolt Action',      icon: iconBoltAction, date: 'Thursday 06/08/26',  time: '6:00 PM – 10:00 PM', table: 'Table 4' },
  { id: 'bb',  game: 'Blood Bowl',       icon: iconBloodBowl,  date: 'Thursday 06/08/26',  time: '6:00 PM – 10:00 PM', table: 'Table 1' },
  { id: '40k', game: 'Warhammer 40,000', icon: icon40k,        date: 'Thursday 01/10/26',  time: '6:00 PM – 10:00 PM', table: 'Table 5' },
  { id: 'nec', game: 'Necromunda',       icon: iconNecromunda, date: 'Thursday 15/10/26',  time: '6:00 PM – 10:00 PM', table: 'Table 3' },
  { id: 'ba2', game: 'Bolt Action',      icon: iconBoltAction, date: 'Thursday 26/11/26',  time: '6:00 PM – 10:00 PM', table: 'Table 2' },
  { id: 'bb2', game: 'Blood Bowl',       icon: iconBloodBowl,  date: 'Thursday 10/12/26',  time: '6:00 PM – 10:00 PM', table: 'Table 1' },
  { id: '40k2', game: 'Warhammer 40,000', icon: icon40k,       date: 'Thursday 17/12/26',  time: '6:00 PM – 10:00 PM', table: 'Table 5' },
  { id: 'bt2', game: 'Battletech',       icon: iconBattletech, date: 'Saturday 19/12/26',  time: '3:00 PM – 6:00 PM',  table: 'Table 4' },
  { id: 'nec2', game: 'Necromunda',      icon: iconNecromunda, date: 'Wednesday 30/12/26', time: '6:00 PM – 10:00 PM', table: 'Table 3' },
];

export function BookingsDemo() {
  const [selected, setSelected] = useState<string | null>('bb');

  return (
    <div>
      <div className="mk-frame">
        {/* Same shape as the column screenshots it sits among, so the section
            reads identically whether it's a picture or a demo. */}
        <div className="mk-frame-inner aspect-[9/21]">
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
                {BOOKINGS.map(booking => {
                  const isSelected = selected === booking.id;
                  return (
                    <li key={booking.id}>
                      {/*
                        A real button, not a clickable div. This is an
                        interactive control on a public page now, so it has to
                        be reachable and operable from a keyboard like any other.
                      */}
                      <button
                        type="button"
                        className={`mk-demo-row ${isSelected ? 'is-selected' : ''}`}
                        aria-pressed={isSelected}
                        onClick={() => setSelected(isSelected ? null : booking.id)}
                      >
                        <img className="mk-demo-row-icon" src={booking.icon} alt="" />
                        <span className="mk-demo-row-text">
                          <span className="mk-demo-row-game">{booking.game}</span>
                          <span className="mk-demo-row-venue">Burrow Games</span>
                          <span className="mk-demo-row-when">{booking.date}</span>
                          <span className="mk-demo-row-when">{booking.time}</span>
                          {isSelected && (
                            <span className="mk-demo-row-detail">{booking.table} &middot; Confirmed</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Present for the shape of the thing, not to be pressed. */}
              <div className="mk-demo-foot" aria-hidden="true">+ New Booking</div>
            </div>
          </div>
        </div>
      </div>

      <p className="mk-caption mt-4 text-center">
        A live demo — pick a booking.
      </p>
    </div>
  );
}
