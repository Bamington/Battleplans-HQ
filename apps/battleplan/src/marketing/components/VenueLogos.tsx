/**
 * VenueLogos.tsx — The stores we're in
 *
 * Lives in the hero rather than down beside the testimonials. A player's first
 * question is "is my local shop on this?", and a venue's first question is
 * "who else is doing this?" — both are better answered above the fold than
 * eight sections later.
 *
 * Kept deliberately quiet: muted type, no accent, no card. It's proof, not a
 * feature, and it sits between the CTA and the hero screenshot where anything
 * loud would compete with both.
 */

interface Props {
  /** Sits above the row, e.g. "Bookable at". */
  label: string;
  /**
   * Real venue names once we have permission to show them. Until then the
   * placeholders render as dashed slots so nobody mistakes them for finished.
   */
  venues?: string[];
  placeholderCount?: number;
}

export function VenueLogos({ label, venues, placeholderCount = 6 }: Props) {
  const items = venues ?? Array.from({ length: placeholderCount }, () => null);

  return (
    <div className="mt-12">
      <p
        className="text-center text-[0.6875rem] font-semibold uppercase"
        style={{ letterSpacing: '0.14em', color: 'var(--mk-text-muted)' }}
      >
        {label}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-5 md:gap-x-12">
        {items.map((venue, i) => (
          <div
            key={venue ?? i}
            /* Only three on a phone. Six dashed boxes pushed the product shot
               most of a screen further down, for no gain. */
            className={`flex h-9 items-center justify-center px-3 ${i >= 3 ? 'hidden sm:flex' : ''}`}
            style={
              venue
                ? { color: 'var(--mk-text-secondary)', fontSize: '0.9375rem' }
                : {
                    width: 122,
                    borderRadius: 'var(--mk-radius-chip)',
                    border: '1px dashed var(--mk-border-strong)',
                    color: 'var(--mk-text-muted)',
                    fontSize: '0.625rem',
                    letterSpacing: '0.1em',
                  }
            }
          >
            {venue ?? 'VENUE LOGO'}
          </div>
        ))}
      </div>
    </div>
  );
}
