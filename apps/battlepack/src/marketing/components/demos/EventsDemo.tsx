/**
 * EventsDemo.tsx — a shop's events, all in one column
 *
 * The /stores page's one replica. It stands in for the home screen: every pack
 * the venue is running, drafts and published together, with the filter that
 * decides which. The filter is the interaction, and it's the right one for this
 * audience — a shop's question is "what have we got on", not "what does one
 * event look like", which is what the organiser page's PackDemo answers.
 *
 * INVENTED. Burrow Games is the fixture venue the BattlePlan screenshots use;
 * the events are made up. A real shop's diary does not belong on a page selling
 * the thing that holds it.
 *
 * Same standing caveat as every replica: if BattlepackListItem gets restyled,
 * this quietly becomes a picture of software we no longer ship.
 */

import { useState } from 'react';

type Filter = 'upcoming' | 'past' | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'upcoming', label: 'Current & Upcoming' },
  { value: 'past',     label: 'Past' },
  { value: 'all',      label: 'All' },
];

interface Event {
  id: string;
  name: string;
  game: string;
  dates: string;
  status: 'draft' | 'published' | 'unpublished';
  past?: boolean;
}

/*
 * A shop's actual mix: a big one-dayer, a league running for months, a monthly
 * club night, a draft nobody has finished, and two that have been and gone.
 * The point of the list is that they are different SHAPES of event and the same
 * column holds all of them.
 */
const EVENTS: Event[] = [
  { id: 'e1', name: 'Autumn Open',                 game: 'Warhammer 40,000', dates: '17/10/26',             status: 'published' },
  { id: 'e2', name: 'Escalation League — Season 6', game: 'Warhammer 40,000', dates: '07/09/26 – 16/11/26', status: 'published' },
  { id: 'e3', name: 'Friday Night Necromunda',      game: 'Necromunda',       dates: 'Monthly, to 18/12/26', status: 'published' },
  { id: 'e4', name: 'Winter Doubles',               game: 'Age of Sigmar',    dates: '12/12/26 – 13/12/26',  status: 'draft' },
  { id: 'e5', name: 'Kill Team Kickoff',            game: 'Kill Team',        dates: '08/08/26',             status: 'published',   past: true },
  { id: 'e6', name: 'Spring Narrative Weekend',     game: 'Warhammer 40,000', dates: '02/05/26 – 03/05/26',  status: 'unpublished', past: true },
];

const STATUS_LABEL: Record<Event['status'], string> = {
  draft:       'Draft',
  published:   'Published',
  unpublished: 'Unpublished',
};

export function EventsDemo() {
  const [filter, setFilter] = useState<Filter>('upcoming');

  const shown = EVENTS.filter(event =>
    filter === 'all' ? true : filter === 'past' ? event.past : !event.past
  );

  /* mk-frame-live: no hover scale, because scaling live text resamples it. */
  return (
    <div className="mk-frame mk-frame-live">
      <div className="mk-frame-inner aspect-[9/13]">
        <div className="mk-demo" role="group" aria-label="Interactive demo of a venue's events">
          <div className="mk-demo-panel">
            <div className="mk-demo-head">
              <span className="mk-demo-head-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
                     strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 20V7l6-3v16M10 20h10V10l-6-3M13.5 11h.01M17 11h.01M13.5 14.5h.01M17 14.5h.01M6.5 11h.01M6.5 14.5h.01" />
                </svg>
              </span>
              <h3 className="mk-demo-title">Burrow Games</h3>
              <p className="mk-demo-sub">Every event the shop is running, in one place.</p>
            </div>

            <div className="mk-events-filter" role="group" aria-label="Filter events">
              {FILTERS.map(f => (
                <button
                  key={f.value}
                  type="button"
                  className="mk-events-chip"
                  aria-pressed={filter === f.value}
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <ul className="mk-demo-list">
              {shown.map(event => (
                <li key={event.id}>
                  <div className="mk-demo-row mk-events-row">
                    <span className="mk-demo-row-text">
                      <span className="mk-demo-row-game">{event.name}</span>
                      <span className="mk-demo-row-venue">{event.game}</span>
                      <span className="mk-demo-row-when">{event.dates}</span>
                    </span>
                    <span className={`mk-events-badge is-${event.status}`}>
                      {STATUS_LABEL[event.status]}
                    </span>
                  </div>
                </li>
              ))}
              {/* An empty state, because a shop with nothing on is a real
                  Tuesday and a list that renders nothing looks broken. */}
              {shown.length === 0 && (
                <li className="mk-events-empty">Nothing on. Yet.</li>
              )}
            </ul>

            {/* Present for the shape of the thing, not to be pressed. */}
            <div className="mk-demo-foot" aria-hidden="true">+ New Battlepack</div>
          </div>
        </div>
      </div>
    </div>
  );
}
