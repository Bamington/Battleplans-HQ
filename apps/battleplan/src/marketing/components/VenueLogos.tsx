/**
 * VenueLogos.tsx — The stores we're in
 *
 * Lives in the hero rather than down beside the testimonials. A player's first
 * question is "is my local shop on this?", and a venue's first question is
 * "who else is doing this?" — both are better answered above the fold than
 * eight sections later.
 *
 * Kept deliberately quiet: muted, no accent, no card. It's proof, not a
 * feature, and it sits between the CTA and the hero screenshot where anything
 * loud would compete with both.
 */

import logoGufWerribee from '../assets/logos/gufw.png';
import logoGufBallarat from '../assets/logos/gufb.png';
import logoTopTable from '../assets/logos/ttg.png';
import logoMiniMyths from '../assets/logos/mm.png';

/*
 * Four real venues, replacing the six dashed placeholders.
 *
 * Sized by HEIGHT rather than width. The artwork runs 189 to 300px wide at
 * roughly the same height, so matching widths would leave the wordy ones tiny
 * and the compact ones enormous — a common way for a logo wall to look wrong
 * without anyone being able to say why.
 *
 * The files are white on transparent, so they're used as-is and simply dimmed:
 * a logo wall that shouts competes with the call to action directly above it.
 */
const VENUES = [
  { name: 'Guf Werribee',         src: logoGufWerribee },
  { name: 'Guf Ballarat',         src: logoGufBallarat },
  { name: 'Top Table Games',      src: logoTopTable },
  { name: 'Mini Myths Clubhouse', src: logoMiniMyths },
];

export function VenueLogos({ label }: { label: string }) {
  return (
    <div className="mt-12">
      <p
        className="text-center text-[0.6875rem] font-semibold uppercase"
        style={{ letterSpacing: '0.14em', color: 'var(--mk-text-muted)' }}
      >
        {label}
      </p>

      <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-7 md:gap-x-14">
        {VENUES.map(venue => (
          <li key={venue.name} className="flex items-center">
            <img
              src={venue.src}
              /* The venue name is the information here — a decorative alt would
                 make the row meaningless to anyone not looking at it. */
              alt={venue.name}
              className="h-6 w-auto md:h-7"
              style={{ opacity: 0.72 }}
              loading="lazy"
              decoding="async"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
