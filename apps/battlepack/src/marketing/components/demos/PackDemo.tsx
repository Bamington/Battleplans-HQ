/**
 * PackDemo.tsx — a published pack, as an attendee reads it
 *
 * The second replica, and the hero of the site: this is the thing an organiser
 * is actually making. It stands in for battlepack.app/<slug> — the banner, the
 * Key Info card with the calendar button as its last row, and the three tabs
 * the real page carries (Event Format, Registration & Schedule, FAQ).
 *
 * INVENTED, ENTIRELY. The event, the venue, the club and the prices are all
 * made up, for the same reason the BattlePlan site captures against a fixture:
 * a real organiser's event on a marketing page is somebody's actual Saturday,
 * and the prices on it stop being true the moment they change.
 *
 * It replicates the SHAPE of PublicPack, not its markup — a document with a
 * hero, a key info card and tabbed sections. If PackDocument gets restyled this
 * won't fail and won't tell you; that's the standing cost of a replica, and why
 * there are three on this site rather than one per section.
 */

import { useState } from 'react';

type TabId = 'format' | 'registration' | 'faq';

const TABS: { id: TabId; label: string }[] = [
  { id: 'format',       label: 'Event Format' },
  { id: 'registration', label: 'Registration & Schedule' },
  { id: 'faq',          label: 'FAQ' },
];

/** The Key Info card's rows, in the order the real card puts them. */
const KEY_INFO: [string, string][] = [
  ['Game',   'Warhammer 40,000'],
  ['When',   'Saturday 17/10/26'],
  ['Time',   '9:30 AM – 6:00 PM'],
  ['Where',  'Burrow Games, Ballarat'],
  ['Format', '2000 pts · 5 rounds'],
];

/** One section per category, under the tab the registry files it on. */
const SECTIONS: Record<TabId, { heading: string; body?: string; items?: string[]; pairs?: [string, string][] }[]> = {
  format: [
    {
      heading: 'About',
      body: 'A one-day 2000 point event over five rounds, run to the current Chapter Approved missions. Relaxed pace, a proper lunch break, and a prize for the best painted army that has nothing to do with how many games you won.',
    },
    {
      heading: "What you'll need to play",
      items: [
        'A 2000 point army list, three printed copies',
        'Dice, tape measure and something to score with',
        'Your own objective markers',
      ],
    },
    {
      heading: 'Prizes',
      pairs: [
        ['Best General', 'Store credit, £60'],
        ['Best Painted', 'Store credit, £40'],
        ['Best Sport', 'Voted by the field'],
      ],
    },
  ],
  registration: [
    {
      heading: 'Tickets',
      body: '£25 on the shop website. Refundable up to a week before. Transfers are fine — just tell us who is taking the place.',
    },
    {
      heading: 'Registration',
      body: 'Lists due by Wednesday the 14th. Send them through Best Coast Pairings; we will not chase you for them.',
    },
    {
      heading: 'Schedule',
      pairs: [
        ['9:30 AM', 'Doors and registration'],
        ['10:00 AM', 'Round 1'],
        ['12:15 PM', 'Lunch'],
        ['1:00 PM', 'Round 2'],
        ['3:15 PM', 'Round 3'],
        ['5:30 PM', 'Awards'],
      ],
    },
  ],
  faq: [
    {
      heading: 'FAQ',
      pairs: [
        ['Can I proxy?', 'Yes, as long as it is clearly the right model on the right base.'],
        ['Is there parking?', 'Free on the street after 9 AM, and a car park behind the shop.'],
        ['Can I turn up on the day?', 'Only if someone drops out. Ask us and we will tell you honestly.'],
      ],
    },
  ],
};

export function PackDemo() {
  const [tab, setTab] = useState<TabId>('format');

  /* mk-frame-live: no hover scale, because scaling live text resamples it. */
  return (
    <div className="mk-frame mk-frame-live">
      <div className="mk-frame-inner aspect-[9/14]">
        <div className="mk-demo" role="group" aria-label="Interactive demo of a published event page">
          <div className="mk-demo-panel mk-pack">
            {/*
              The banner. A gradient rather than an image, because the real one
              is the game's artwork and shipping a copy of it onto a marketing
              page means a second place it has to be licensed and kept current.
            */}
            <div className="mk-pack-banner" aria-hidden="true">
              <span className="mk-pack-banner-name">Warhammer 40,000</span>
            </div>

            <h3 className="mk-pack-title">Autumn Open</h3>
            <p className="mk-pack-host">Burrow Games &middot; Ballarat</p>

            <div className="mk-pack-keyinfo">
              <dl className="mk-pack-rows">
                {KEY_INFO.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {/*
                The last row of the Key Info card, not a control in the hero.
                That placement is a decision in the app, not a layout accident
                here — see the app's CLAUDE.md.
              */}
              <div className="mk-pack-calendar" aria-hidden="true">Add to calendar</div>
            </div>

            {/*
              Pressed buttons in a group, NOT role="tab". The real page uses the
              shared <Tabs>, which implements the arrow-key navigation an ARIA
              tab widget promises; this doesn't, and claiming the role without
              the keyboard contract is worse for a screen reader user than not
              claiming it. aria-pressed says exactly what is true — three
              buttons, one of them on — and matches the other two demos.
            */}
            <div className="mk-pack-tabs" role="group" aria-label="Sections">
              {TABS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={tab === t.id}
                  aria-controls="mk-pack-body"
                  className="mk-pack-tab"
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mk-demo-list mk-pack-body" id="mk-pack-body">
              {SECTIONS[tab].map(section => (
                <section key={section.heading} className="mk-pack-section">
                  <h4 className="mk-pack-heading">{section.heading}</h4>

                  {section.body && <p className="mk-pack-text">{section.body}</p>}

                  {section.items && (
                    <ul className="mk-pack-checklist">
                      {section.items.map(item => <li key={item}>{item}</li>)}
                    </ul>
                  )}

                  {section.pairs && (
                    <dl className="mk-pack-pairs">
                      {section.pairs.map(([term, detail]) => (
                        <div key={term}>
                          <dt>{term}</dt>
                          <dd>{detail}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
