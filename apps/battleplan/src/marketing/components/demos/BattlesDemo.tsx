/**
 * BattlesDemo.tsx — A playable version of the battle gallery
 *
 * The second replica on this page, and the same trade as the first: markup that
 * looks like the app rather than a photograph of it, so it can drift when the
 * app changes and nothing will say so. See BookingsDemo for the full argument.
 *
 * The photographs are real — the platform owner's own miniatures, the same
 * images the gallery screenshot was made from, pulled out of storage by
 * tools/screenshots/fetch-battle-photos.mjs. Everything written over them is
 * invented: the opponents, the results, the venues.
 */

import { useEffect, useRef, useState } from 'react';

import photo01 from '../../assets/shots/battles/battle-01.webp';
import photo02 from '../../assets/shots/battles/battle-02.webp';
import photo03 from '../../assets/shots/battles/battle-03.webp';
import photo04 from '../../assets/shots/battles/battle-04.webp';
import photo05 from '../../assets/shots/battles/battle-05.webp';
import photo06 from '../../assets/shots/battles/battle-06.webp';
import photo07 from '../../assets/shots/battles/battle-07.webp';
import photo08 from '../../assets/shots/battles/battle-08.webp';
import photo09 from '../../assets/shots/battles/battle-09.webp';
import photo10 from '../../assets/shots/battles/battle-10.webp';

type Result = 'won' | 'lost' | 'drew';

interface Battle {
  id: string;
  game: string;
  photo: string;
  opponent: string;
  handle: string;
  result: Result;
  date: string;
  venue: string;
  /** Head-to-head against this opponent, which is the point of the feature. */
  record: string;
}

const RESULT_LABEL: Record<Result, string> = { won: 'Victory', lost: 'Defeat', drew: 'Draw' };

/*
 * The venues match the bookings demo, so a reader moving between the two
 * sections sees one player's life rather than two unrelated data sets. The
 * opponents are the same invented friends whose handles appear in the booking
 * dialog and whose faces are in the friends screenshot below.
 *
 * Tom Ashworth carries a losing head-to-head on purpose: the copy beside this
 * promises you'll find out who your nemesis is, and a demo where every
 * matchup is even quietly fails to demonstrate that.
 */
const BATTLES: Battle[] = [
  { id: 'x1',  game: 'Star Wars Shatterpoint', photo: photo01, opponent: 'Hannah Foster', handle: '@hannahfoster', result: 'won',  date: 'Tuesday 04/08/26',   venue: 'Guf Werribee',         record: '5 – 0 – 0' },
  { id: 'x2',  game: 'Blood Bowl',             photo: photo02, opponent: 'Priya Nair',    handle: '@priyanair',    result: 'won',  date: 'Thursday 30/07/26',  venue: 'Burrow Games',         record: '4 – 2 – 0' },
  { id: 'x3',  game: 'Star Wars Shatterpoint', photo: photo03, opponent: 'Josh Brennan',  handle: '@joshbrennan',  result: 'won',  date: 'Saturday 25/07/26',  venue: 'Top Table Games',      record: '3 – 1 – 0' },
  { id: 'x4',  game: 'Star Wars Shatterpoint', photo: photo04, opponent: 'Tom Ashworth',  handle: '@tomashworth',  result: 'lost', date: 'Monday 20/07/26',    venue: 'Guf Werribee',         record: '0 – 7 – 1' },
  { id: 'x5',  game: 'Halo: Flashpoint',       photo: photo05, opponent: 'Ellie Zhang',   handle: '@elliezhang',   result: 'lost', date: 'Wednesday 15/07/26', venue: 'Mini Myths Clubhouse', record: '1 – 3 – 0' },
  { id: 'x6',  game: 'Star Wars Shatterpoint', photo: photo06, opponent: 'Sofia Reyes',   handle: '@sofiareyes',   result: 'won',  date: 'Friday 10/07/26',    venue: 'Victorius',            record: '3 – 2 – 0' },
  { id: 'x7',  game: 'Blood Bowl',             photo: photo07, opponent: 'Hannah Foster', handle: '@hannahfoster', result: 'won',  date: 'Sunday 05/07/26',    venue: 'Burrow Games',         record: '5 – 0 – 0' },
  { id: 'x8',  game: 'Star Wars Shatterpoint', photo: photo08, opponent: 'Tom Ashworth',  handle: '@tomashworth',  result: 'lost', date: 'Tuesday 30/06/26',   venue: 'Top Table Games',      record: '0 – 7 – 1' },
  { id: 'x9',  game: 'Blood Bowl',             photo: photo09, opponent: 'Rob Sinclair',  handle: '@robsinclair',  result: 'drew', date: 'Thursday 25/06/26',  venue: 'Guf Werribee',         record: '1 – 1 – 1' },
  { id: 'x10', game: 'Star Wars Shatterpoint', photo: photo10, opponent: 'Daniel Okafor', handle: '@danielokafor', result: 'won',  date: 'Saturday 20/06/26',  venue: 'Mini Myths Clubhouse', record: '2 – 2 – 0' },
];

export function BattlesDemo() {
  const [open, setOpen] = useState<Battle | null>(null);
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
          <div className="mk-demo" role="group" aria-label="Interactive demo of the battle record">
            <div className="mk-demo-panel">
              <div className="mk-demo-head">
                <span className="mk-demo-head-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
                       strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l7.5 3v6c0 4.5-3 7.8-7.5 9.5C7.5 19.8 4.5 16.5 4.5 12V6Z" />
                  </svg>
                </span>
                <h3 className="mk-demo-title">Your Battles</h3>
                <p className="mk-demo-sub">The games you&rsquo;ve played, and how they went.</p>
              </div>

              {/* Two up, like the app's gallery view. */}
              <ul className="mk-demo-list mk-demo-grid">
                {BATTLES.map(battle => (
                  <li key={battle.id}>
                    <button
                      type="button"
                      className="mk-battle-card"
                      aria-haspopup="dialog"
                      onClick={e => { openerRef.current = e.currentTarget; setOpen(battle); }}
                    >
                      <img className="mk-battle-photo" src={battle.photo} alt="" loading="lazy" decoding="async" />
                      <span className="mk-battle-meta">
                        <span className="mk-battle-game">{battle.game}</span>
                        <span className={`mk-battle-result is-${battle.result}`}>
                          {RESULT_LABEL[battle.result]}
                        </span>
                      </span>
                      <span className="mk-battle-opp">vs {battle.opponent}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mk-demo-foot" aria-hidden="true">+ Add Battle</div>
            </div>

            {open && (
              /* Same contract as the bookings dialog: scoped to the frame, no
                 scroll lock, no focus trap, Escape and click-outside both close
                 and restore focus. See BookingsDemo for why not aria-modal. */
              <div className="mk-demo-scrim" onClick={close}>
                <div
                  ref={dialogRef}
                  role="dialog"
                  aria-label={`${open.game} against ${open.opponent}`}
                  tabIndex={-1}
                  className="mk-demo-dialog"
                  onClick={e => e.stopPropagation()}
                >
                  <button type="button" className="mk-demo-dialog-close" onClick={close} aria-label="Close details">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>

                  <img className="mk-battle-dialog-photo" src={open.photo} alt="" />
                  <h4 className="mk-demo-dialog-title">{open.game}</h4>
                  <p className="mk-demo-dialog-venue">{open.venue}</p>

                  <dl className="mk-demo-dialog-rows">
                    <div><dt>Result</dt><dd className={`mk-battle-result is-${open.result}`}>{RESULT_LABEL[open.result]}</dd></div>
                    <div><dt>Opponent</dt><dd className="mk-demo-dialog-handle">{open.handle}</dd></div>
                    <div><dt>Played</dt><dd>{open.date}</dd></div>
                    {/* The head-to-head is the reason opponents are records
                        rather than free text — worth its own line. */}
                    <div><dt>Head to head</dt><dd>{open.record}</dd></div>
                  </dl>

                  <div className="mk-demo-dialog-actions" aria-hidden="true">
                    <span className="mk-demo-dialog-action">Edit battle</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="mk-caption mt-4 text-center">
        A live demo — pick a battle.
      </p>
    </div>
  );
}
