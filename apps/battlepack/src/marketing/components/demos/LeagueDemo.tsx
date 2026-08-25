/**
 * LeagueDemo.tsx — the league that dates itself
 *
 * The one section on this site that is a REPLICA rather than a photograph, and
 * the one it was worth building. Everything else BattlePack does can be shown
 * in a still; this can't, because the whole claim is that the dates MOVE. A
 * screenshot of a league schedule is a screenshot of a list of dates, which is
 * what an organiser already has in a spreadsheet.
 *
 * That's a deliberate trade and worth being clear-eyed about — a screenshot
 * can't drift, and this can. If RoundsBreaksForm gets restyled, nothing here
 * fails and nothing tells you. So the drift surface is kept to one component
 * per page, and the arithmetic is the part that has to stay honest: the rules
 * below are lib/leagues.ts's rules, deliberately re-stated rather than
 * imported, because importing the real module would drag the pack types, the
 * Supabase client and the segment shape onto a public marketing page.
 *
 * The three rules it has to keep, from leagues.ts:
 *   - Rounds run end to end from the league's start, every one the same length.
 *   - An Event OCCUPIES the calendar. Everything after it starts later.
 *   - Rounds are numbered among themselves; an Event takes no number.
 *
 * Deliberately dumb: two pieces of state and a pure function. No fetching, no
 * app imports, no reducer.
 */

import { useState } from 'react';

/** Noon-anchored, so a DST boundary can't shift a date by a day. */
const DAY = 24 * 60 * 60 * 1000;

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12);
}

function addDays(iso: string, days: number): string {
  const date = new Date(parse(iso).getTime() + days * DAY);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "07/09" — day and month only. The year is in the header. */
function short(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/*
 * A Monday, because a league's rounds are counted in whole weeks between
 * Mondays — the same convention lib/recurrence.ts keeps and the same one
 * iCalendar defaults to.
 */
const STARTS_ON = '2026-09-07';

interface Segment {
  id: string;
  kind: 'round' | 'event';
  /** Events are named; rounds are numbered among themselves. */
  label?: string;
  /** An Event keeps its own length wherever it lands. Rounds take the league's. */
  weeks: number;
}

/** The league as authored: five rounds, with a painting week after round two. */
const BASE: Segment[] = [
  { id: 'r1', kind: 'round', weeks: 0 },
  { id: 'r2', kind: 'round', weeks: 0 },
  { id: 'br', kind: 'event', label: 'Painting Week', weeks: 1 },
  { id: 'r3', kind: 'round', weeks: 0 },
  { id: 'r4', kind: 'round', weeks: 0 },
  { id: 'r5', kind: 'round', weeks: 0 },
];

interface Laid {
  id: string;
  kind: 'round' | 'event';
  title: string;
  from: string;
  to: string;
}

/**
 * The layout, and the only thing on this page doing real work.
 *
 * Segments run end to end from the league's start. A round takes the league's
 * round length; an Event keeps its own. Rounds are numbered among themselves,
 * so the round after a painting week is still Round 3 — which is what everyone
 * standing in the shop will call it whatever the pack says.
 */
function layout(segments: Segment[], roundWeeks: number): Laid[] {
  let cursor = STARTS_ON;
  let roundNumber = 0;

  return segments.map(segment => {
    const weeks = segment.kind === 'round' ? roundWeeks : segment.weeks;
    const from = cursor;
    const to = addDays(from, weeks * 7 - 1);
    cursor = addDays(to, 1);

    if (segment.kind === 'round') roundNumber += 1;

    return {
      id: segment.id,
      kind: segment.kind,
      title: segment.kind === 'round' ? `Round ${roundNumber}` : segment.label ?? 'Event',
      from,
      to,
    };
  });
}

const LENGTHS = [1, 2, 3, 4];

export function LeagueDemo() {
  const [roundWeeks, setRoundWeeks] = useState(2);
  const [breakWeek, setBreakWeek] = useState(true);

  const segments = breakWeek ? BASE : BASE.filter(s => s.kind === 'round');
  const laid = layout(segments, roundWeeks);
  const ends = laid[laid.length - 1]?.to ?? STARTS_ON;

  /* mk-frame-live: no hover scale, because scaling live text resamples it. */
  return (
    <div className="mk-frame mk-frame-live">
      <div className="mk-frame-inner aspect-[9/13]">
        <div className="mk-demo" role="group" aria-label="Interactive demo of a league schedule">
          <div className="mk-demo-panel">
            <div className="mk-demo-head">
              <span className="mk-demo-head-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
                     strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="16" rx="3" />
                  <path d="M3 10h18M8 3v4M16 3v4M8 14h8M8 17.5h5" />
                </svg>
              </span>
              <h3 className="mk-demo-title">Schedule</h3>
              <p className="mk-demo-sub">
                Starts {short(STARTS_ON)} &middot; ends {short(ends)} &middot; 2026
              </p>
            </div>

            {/*
              The controls a real organiser has, minus the ones that would need
              a database. Round length and "is there a break" are the two that
              move every date below them, which is the whole point.
            */}
            <div className="mk-league-controls">
              <div className="mk-league-control">
                <span className="mk-league-control-label" id="mk-league-length">Round length</span>
                <div className="mk-league-segmented" role="group" aria-labelledby="mk-league-length">
                  {LENGTHS.map(weeks => (
                    <button
                      key={weeks}
                      type="button"
                      className="mk-league-seg"
                      aria-pressed={weeks === roundWeeks}
                      onClick={() => setRoundWeeks(weeks)}
                    >
                      {weeks}w
                    </button>
                  ))}
                </div>
              </div>

              <div className="mk-league-control">
                <span className="mk-league-control-label" id="mk-league-break">Painting week</span>
                <button
                  type="button"
                  className="mk-league-switch"
                  role="switch"
                  aria-checked={breakWeek}
                  aria-labelledby="mk-league-break"
                  onClick={() => setBreakWeek(b => !b)}
                >
                  <span className="mk-league-switch-knob" />
                </button>
              </div>
            </div>

            <ol className="mk-demo-list mk-league-list">
              {laid.map(segment => (
                <li key={segment.id} className="mk-league-row" data-kind={segment.kind}>
                  <span className="mk-league-title">{segment.title}</span>
                  <span className="mk-league-dates">
                    {short(segment.from)} – {short(segment.to)}
                  </span>
                </li>
              ))}
            </ol>

            {/* Present for the shape of the thing, not to be pressed. */}
            <div className="mk-demo-foot" aria-hidden="true">+ Add a round or an event</div>
          </div>
        </div>
      </div>
    </div>
  );
}
