/**
 * TileGrid.tsx — The small features, one line each
 *
 * No screenshots here on purpose. After four screenshot-led sections the page
 * needs a change of texture, and none of these earn an image.
 *
 * `body` is optional. The player page runs four headline benefits with no
 * supporting copy, which needs the titles to carry more weight; the venue page
 * runs eight smaller items where the supporting line is doing the explaining.
 */

import React from 'react';
import { Reveal, SectionHeading } from './Section';

export interface Tile {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body?: string;
}

export function TileGrid({ title, tiles }: { title: string; tiles: Tile[] }) {
  // Four or fewer means one row on desktop, and titles that stand alone.
  const spare = tiles.length <= 4;

  return (
    <>
      <Reveal>
        <SectionHeading title={title} align="center" />
      </Reveal>

      <div
        className={`mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4 ${
          spare ? 'md:mt-16' : ''
        }`}
      >
        {tiles.map((tile, i) => (
          // Stagger resets each row so the last tile isn't half a second behind
          // the first — 60ms x 8 is long enough to notice.
          <Reveal key={tile.title} delay={(i % 4) * 60}>
            {/* Larger icon rather than an accent-coloured one: four accent
                icons would blow the page's accent budget, and the rule that
                keeps the accent meaningful is worth more than the lift. */}
            <tile.icon className={spare ? 'w-7 h-7' : 'w-6 h-6'} />
            {spare ? (
              <h3 className="mk-display-3 mt-5 max-w-[16ch]">{tile.title}</h3>
            ) : (
              <h3
                className="mt-4 text-[1.0625rem] font-medium"
                style={{ color: 'var(--mk-text-primary)' }}
              >
                {tile.title}
              </h3>
            )}
            {tile.body && <p className="mk-body-sm mt-2">{tile.body}</p>}
          </Reveal>
        ))}
      </div>
    </>
  );
}
