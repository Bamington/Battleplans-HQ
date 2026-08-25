/**
 * SuiteSection.tsx — The three apps, one account
 *
 * Not borrowed from the reference site — they don't have a suite. It's here
 * because one login across BattlePlan, BattleBox and BattlePack is a genuine
 * differentiator, and because it sets up the landing pages for the other two.
 *
 * Each card carries its OWN app's accent rather than the accent of the site
 * it's rendered on. It's the one place on a page where a colour other than the
 * accent is allowed to be saturated, and it earns it by being the point of the
 * section: three apps, told apart by the three colours they're told apart by
 * everywhere else.
 *
 * Which is also why this lives in the shared package rather than in one app's
 * directory. Every site wants this section, and every copy of it would have to
 * be edited the day a fourth app ships.
 *
 * `current` is passed in rather than baked in, so each site marks itself.
 */

import { Reveal, SectionHeading } from './Section';

const APPS = [
  {
    name: 'BattlePlan',
    tagline: 'Book tables, log battles, track your record.',
    accent: '#8b5cf6',
  },
  {
    name: 'BattleBox',
    tagline: 'Your collection and your paints, catalogued and photographed.',
    accent: '#f59e0b',
  },
  {
    name: 'BattlePack',
    tagline: 'Run an event, and give players a page that tells them everything.',
    accent: '#22c55e',
  },
];

/** @param current The app whose site this is, marked "You're here". */
export function SuiteSection({ current }: { current: string }) {
  return (
    <>
      <Reveal>
        <SectionHeading
          eyebrow="The suite"
          title="One account. The whole hobby."
          lead="Start with one, add the others when you need them. The same login works across all three."
          align="center"
        />
      </Reveal>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {APPS.map((app, i) => (
          <Reveal key={app.name} delay={i * 60}>
            <div className="mk-card mk-card-hover h-full overflow-hidden">
              {/* A single accent rule along the top edge — enough to identify
                  the app without turning the card into a colour swatch. */}
              <div style={{ height: 3, background: app.accent }} />
              <div className="p-7">
                <div className="flex items-center gap-3">
                  <span
                    style={{
                      width: 10, height: 10, borderRadius: 999,
                      background: app.accent, flexShrink: 0,
                    }}
                  />
                  <h3 className="mk-display-3">{app.name}</h3>
                </div>
                <p className="mk-body-sm mt-4">{app.tagline}</p>
                {app.name === current && (
                  <p className="mk-caption mt-5" style={{ color: 'var(--mk-accent-400)' }}>
                    You're here
                  </p>
                )}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </>
  );
}
