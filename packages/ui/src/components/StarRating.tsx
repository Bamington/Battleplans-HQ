/**
 * StarRating.tsx — Star rating display and input component
 *
 * In display mode (interactive=false), renders a read-only row of stars.
 * In interactive mode, stars are clickable and a hover preview is shown.
 *
 * USAGE EXAMPLES:
 *   <StarRating rating={4} />
 *   <StarRating rating={3.7} size="lg" count={128} />
 *   <StarRating rating={4.9} showLabel />
 *   <StarRating
 *     rating={value}
 *     interactive
 *     onChange={(r) => setValue(r)}
 *   />
 */

import { useState } from 'react';

// ── Type definitions ──────────────────────────────────────────────────────────

export type StarRatingSize = 'sm' | 'base' | 'lg';

export interface StarRatingProps {
  /** Current rating value (0 – max) */
  rating: number;
  /** Total number of stars (default: 5) */
  max?: number;
  /** Visual size of each star */
  size?: StarRatingSize;
  /**
   * Number of reviews — renders a "(N reviews)" count after the stars.
   * Only shown when provided.
   */
  count?: number;
  /** Renders "X out of Y" text after the stars */
  showLabel?: boolean;
  /**
   * Makes the stars clickable.
   * Use with `onChange` to handle the selected rating.
   */
  interactive?: boolean;
  /** Called with the selected rating when a star is clicked */
  onChange?: (rating: number) => void;
  className?: string;
}

// ── Lookup tables ─────────────────────────────────────────────────────────────

const sizeClasses: Record<StarRatingSize, string> = {
  sm:   'w-4 h-4',
  base: 'w-5 h-5',
  lg:   'w-6 h-6',
};

// ── Star SVG ──────────────────────────────────────────────────────────────────

interface StarProps {
  filled:      boolean;
  sizeClass:   string;
  interactive: boolean;
  onHover?:    () => void;
  onLeave?:    () => void;
  onClick?:    () => void;
}

const Star = ({ filled, sizeClass, interactive, onHover, onLeave, onClick }: StarProps) => (
  <svg
    className={[
      sizeClass,
      filled ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600',
      interactive ? 'cursor-pointer transition-colors' : '',
    ].filter(Boolean).join(' ')}
    aria-hidden="true"
    fill="currentColor"
    viewBox="0 0 22 20"
    xmlns="http://www.w3.org/2000/svg"
    onMouseEnter={onHover}
    onMouseLeave={onLeave}
    onClick={onClick}
  >
    <path d="M20.924 7.625a1.523 1.523 0 0 0-1.238-1.044l-5.051-.734-2.259-4.577a1.534 1.534 0 0 0-2.752 0L7.365 5.847l-5.051.734A1.535 1.535 0 0 0 1.463 9.2l3.656 3.563-.863 5.031a1.532 1.532 0 0 0 2.226 1.616L11 17.033l4.518 2.375a1.534 1.534 0 0 0 2.226-1.617l-.863-5.03L20.537 9.2a1.523 1.523 0 0 0 .387-1.575Z" />
  </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────

const StarRating = ({
  rating,
  max         = 5,
  size        = 'base',
  count,
  showLabel   = false,
  interactive = false,
  onChange,
  className   = '',
}: StarRatingProps) => {

  const [hovered, setHovered] = useState<number | null>(null);

  // The effective rating to display — hovered value overrides in interactive mode
  const displayRating = interactive && hovered !== null ? hovered : Math.round(rating);
  const sizeClass     = sizeClasses[size];

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>

      {/* Stars */}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: max }, (_, i) => {
          const starValue = i + 1;
          return (
            <Star
              key={i}
              filled={starValue <= displayRating}
              sizeClass={sizeClass}
              interactive={interactive}
              onHover={interactive ? () => setHovered(starValue) : undefined}
              onLeave={interactive ? () => setHovered(null) : undefined}
              onClick={interactive ? () => onChange?.(starValue) : undefined}
            />
          );
        })}
      </div>

      {/* Label: "X out of Y" */}
      {showLabel && (
        <span className="font-body text-sm font-medium text-gray-500 dark:text-gray-400">
          {rating.toFixed(1)} out of {max}
        </span>
      )}

      {/* Review count */}
      {count !== undefined && (
        <span className="font-body text-sm font-medium text-gray-500 dark:text-gray-400">
          ({count.toLocaleString()} {count === 1 ? 'review' : 'reviews'})
        </span>
      )}

    </div>
  );
};

export default StarRating;
