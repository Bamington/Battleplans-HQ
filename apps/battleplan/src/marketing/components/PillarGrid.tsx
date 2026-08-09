/**
 * PillarGrid.tsx — The "here's the whole product" section
 *
 * Sits directly under the hero and names the pillars before any of them are
 * explained. Three or four cards; the grid adapts so the venue page's three
 * don't stretch.
 */

import React from 'react';
import { Reveal, SectionHeading } from './Section';

export interface Pillar {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}

export function PillarGrid({
  eyebrow,
  title,
  pillars,
}: {
  eyebrow: string;
  title: string;
  pillars: Pillar[];
}) {
  return (
    <>
      <Reveal>
        <SectionHeading eyebrow={eyebrow} title={title} align="center" />
      </Reveal>

      <div
        className={`mt-14 grid gap-6 md:mt-16 ${
          pillars.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'
        }`}
      >
        {pillars.map((pillar, i) => (
          <Reveal key={pillar.title} delay={i * 60}>
            <div className="mk-card mk-card-hover h-full p-7">
              {/* Icons are secondary-coloured by default — the accent is
                  reserved for the things we actually want looked at. */}
              <pillar.icon className="w-7 h-7" />
              <h3 className="mk-display-3 mt-5">{pillar.title}</h3>
              <p className="mk-body-sm mt-3">{pillar.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </>
  );
}
