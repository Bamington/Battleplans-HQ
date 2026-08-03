/**
 * TileGrid.tsx — The small features, one line each
 *
 * No screenshots here on purpose. After four screenshot-led sections the page
 * needs a change of texture, and none of these earn an image.
 */

import React from 'react';
import { Reveal, SectionHeading } from './Section';

export interface Tile {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}

export function TileGrid({ title, tiles }: { title: string; tiles: Tile[] }) {
  return (
    <>
      <Reveal>
        <SectionHeading title={title} align="center" />
      </Reveal>

      <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile, i) => (
          // Stagger resets each row so the last tile isn't half a second behind
          // the first — 60ms x 8 is long enough to notice.
          <Reveal key={tile.title} delay={(i % 4) * 60}>
            <tile.icon className="w-6 h-6" />
            <h3
              className="mt-4 text-[1.0625rem] font-medium"
              style={{ color: 'var(--mk-text-primary)' }}
            >
              {tile.title}
            </h3>
            <p className="mk-body-sm mt-2">{tile.body}</p>
          </Reveal>
        ))}
      </div>
    </>
  );
}
