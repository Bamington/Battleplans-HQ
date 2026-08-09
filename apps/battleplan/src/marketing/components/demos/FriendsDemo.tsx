/**
 * FriendsDemo.tsx — A playable version of the friends column
 *
 * Third replica on this page. Same trade as the other two: markup that looks
 * like the app rather than a photograph of it, so it can drift silently when
 * the app changes. See BookingsDemo for the full argument.
 *
 * Just the list. The real column also carries incoming and outgoing friend
 * requests with accept and decline controls, and those are deliberately absent:
 * rendering buttons that look live and do nothing is worse than not showing
 * them, and a whole accept-decline flow is more demo than this section needs.
 */

import { useEffect, useRef, useState } from 'react';

interface Friend {
  handle: string;
  name: string;
  /** Record against them: won, lost, drew. */
  won: number;
  lost: number;
  drew: number;
  favourites: string[];
}

/*
 * The same cast as the battles demo and the booking dialog, with the same
 * records — Tom Ashworth is 0-7-1 here because he's 0-7-1 there, and the
 * section above promises a nemesis. Three names beyond the fixture's nine, so
 * the list is long enough to scroll.
 */
const FRIENDS: Friend[] = [
  { handle: '@hannahfoster', name: 'Hannah Foster', won: 5, lost: 0, drew: 0, favourites: ['Star Wars Shatterpoint', 'Blood Bowl'] },
  { handle: '@priyanair',    name: 'Priya Nair',    won: 4, lost: 2, drew: 0, favourites: ['Blood Bowl', 'Age of Sigmar'] },
  { handle: '@joshbrennan',  name: 'Josh Brennan',  won: 3, lost: 1, drew: 0, favourites: ['Star Wars Shatterpoint'] },
  { handle: '@sofiareyes',   name: 'Sofia Reyes',   won: 3, lost: 2, drew: 0, favourites: ['Star Wars Shatterpoint', 'Necromunda'] },
  { handle: '@amaradiallo',  name: 'Amara Diallo',  won: 2, lost: 1, drew: 0, favourites: ['Battletech'] },
  { handle: '@danielokafor', name: 'Daniel Okafor', won: 2, lost: 2, drew: 0, favourites: ['Warhammer 40,000', 'Blood Bowl'] },
  { handle: '@ninaalvarez',  name: 'Nina Alvarez',  won: 2, lost: 3, drew: 1, favourites: ['Necromunda'] },
  { handle: '@robsinclair',  name: 'Rob Sinclair',  won: 1, lost: 1, drew: 1, favourites: ['Blood Bowl', 'Bolt Action'] },
  { handle: '@elliezhang',   name: 'Ellie Zhang',   won: 1, lost: 3, drew: 0, favourites: ['Halo: Flashpoint', 'Necromunda'] },
  { handle: '@yukitanaka',   name: 'Yuki Tanaka',   won: 1, lost: 4, drew: 0, favourites: ['Warhammer 40,000'] },
  { handle: '@chrisduval',   name: 'Chris Duval',   won: 0, lost: 2, drew: 2, favourites: ['Bolt Action'] },
  { handle: '@tomashworth',  name: 'Tom Ashworth',  won: 0, lost: 7, drew: 1, favourites: ['Star Wars Shatterpoint', 'Warhammer 40,000'] },
];

const initials = (name: string) =>
  name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();

export function FriendsDemo() {
  const [open, setOpen] = useState<Friend | null>(null);
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

  /*
   * Wins over games played, matching the app's own stats page — its headline
   * figure of 38% is 124 wins from 323 battles, so draws count for nothing.
   *
   * Counting a draw as half a win, which was the first attempt, put Tom
   * Ashworth on 6% instead of 0. Defensible arithmetic, wrong answer: the
   * section beside this promises you'll find your nemesis, and 0% is the number
   * that says it.
   */
  const played = open ? open.won + open.lost + open.drew : 0;
  const winRate = played ? Math.round((open!.won / played) * 100) : 0;

  return (
    <div className="mk-frame mk-frame-live">
        <div className="mk-frame-inner aspect-[9/17]">
          <div className="mk-demo" role="group" aria-label="Interactive demo of the friends list">
            <div className="mk-demo-panel">
              <div className="mk-demo-head">
                <span className="mk-demo-head-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
                       strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="8" r="3.5" />
                    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 5.2a3.5 3.5 0 0 1 0 6.6M18.5 14.4A6.5 6.5 0 0 1 21.5 20" />
                  </svg>
                </span>
                <h3 className="mk-demo-title">My Friends</h3>
                <p className="mk-demo-sub">Users you&rsquo;ve connected with on BattlePlan. Invite them to your games!</p>
              </div>

              <ul className="mk-demo-list">
                {FRIENDS.map(friend => (
                  <li key={friend.handle}>
                    <button
                      type="button"
                      className="mk-friend-row"
                      aria-haspopup="dialog"
                      onClick={e => { openerRef.current = e.currentTarget; setOpen(friend); }}
                    >
                      <span className="mk-friend-avatar" aria-hidden="true">{initials(friend.name)}</span>
                      <span className="mk-friend-text">
                        <span className="mk-friend-handle">{friend.handle}</span>
                        <span className="mk-friend-name">{friend.name}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mk-demo-foot" aria-hidden="true">+ Add Friends</div>
            </div>

            {open && (
              /* Same contract as the other two dialogs — scoped to the frame, no
                 scroll lock, no focus trap, Escape and click-outside both close
                 and restore focus. See BookingsDemo for why not aria-modal. */
              <div className="mk-demo-scrim" onClick={close}>
                <div
                  ref={dialogRef}
                  role="dialog"
                  aria-label={`Your record against ${open.name}`}
                  tabIndex={-1}
                  className="mk-demo-dialog"
                  onClick={e => e.stopPropagation()}
                >
                  <button type="button" className="mk-demo-dialog-close" onClick={close} aria-label="Close details">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>

                  <span className="mk-friend-avatar is-large" aria-hidden="true">{initials(open.name)}</span>
                  <h4 className="mk-demo-dialog-title">{open.name}</h4>
                  <p className="mk-demo-dialog-venue">{open.handle}</p>

                  {/*
                    A bar rather than a number alone. "0%" against Tom Ashworth
                    is a statistic; a bar with no green in it is a feeling, and
                    the feeling is what the section above is selling.
                  */}
                  <div className="mk-friend-bar" aria-hidden="true">
                    <span className="is-won"  style={{ flexGrow: open.won }} />
                    <span className="is-drew" style={{ flexGrow: open.drew }} />
                    <span className="is-lost" style={{ flexGrow: open.lost }} />
                  </div>

                  <dl className="mk-demo-dialog-rows">
                    <div>
                      <dt>Win / loss</dt>
                      <dd>{open.won} – {open.lost} – {open.drew}</dd>
                    </div>
                    <div>
                      <dt>Win rate</dt>
                      <dd className={winRate >= 50 ? 'mk-demo-dialog-ok' : 'mk-friend-poor'}>{winRate}%</dd>
                    </div>
                    <div>
                      <dt>Favourite games</dt>
                      <dd className="mk-friend-games">
                        {open.favourites.map(game => <span key={game}>{game}</span>)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
