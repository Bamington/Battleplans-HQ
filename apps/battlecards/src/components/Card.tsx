/**
 * Card.tsx — Composable card container
 *
 * Three building-block components that compose into any card layout:
 *   - Card      — the outer shell (border, rounded, shadow, overflow-hidden)
 *   - CardImage — full-width image block (no padding; placed before CardBody)
 *   - CardBody  — padded content area
 *
 * Because Card uses overflow-hidden, CardImage never needs its own border-radius —
 * the card's rounded corners clip everything inside automatically.
 *
 * USAGE EXAMPLES:
 *
 *   // Default card (title + description)
 *   <Card>
 *     <CardBody>
 *       <Text variant="h5">Card title</Text>
 *       <Text variant="paragraph">Supporting description text.</Text>
 *     </CardBody>
 *   </Card>
 *
 *   // Card with top image
 *   <Card>
 *     <CardImage src="/img/unit.jpg" alt="Heavy Infantry" />
 *     <CardBody>
 *       <Badge color="purple">Legendary</Badge>
 *       <Text variant="h5">Heavy Infantry</Text>
 *       <Button>Deploy</Button>
 *     </CardBody>
 *   </Card>
 *
 *   // Horizontal card (image left, content right)
 *   <Card horizontal>
 *     <CardImage src="/img/unit.jpg" alt="Heavy Infantry" className="h-48 md:h-auto md:w-48 shrink-0" />
 *     <CardBody>
 *       <Text variant="h5">Heavy Infantry</Text>
 *       <Text variant="paragraph">Holds the line while flankers advance.</Text>
 *       <Button>Read more</Button>
 *     </CardBody>
 *   </Card>
 */

import React from 'react';

// ── Type definitions ──────────────────────────────────────────────────────────

export interface CardProps {
  /** Lay out children in a row (image left, body right) on md+ screens */
  horizontal?: boolean;
  /** Drop shadow beneath the card (default: true) */
  shadow?: boolean;
  /** Extra Tailwind classes on the card container */
  className?: string;
  /** Inline styles for one-off overrides (e.g. animation) */
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export interface CardImageProps {
  src: string;
  alt?: string;
  /**
   * Use to control dimensions and flex behaviour, e.g.:
   *   - Vertical:   className="h-48"
   *   - Horizontal: className="h-48 md:h-auto md:w-48 shrink-0"
   */
  className?: string;
}

export interface CardBodyProps {
  /**
   * Use to override padding, set flex layout, or control alignment, e.g.:
   *   className="p-6 flex flex-col items-center text-center"
   */
  className?: string;
  children: React.ReactNode;
}

// ── Card ──────────────────────────────────────────────────────────────────────

/**
 * The outer shell. overflow-hidden ensures CardImage and other children
 * are clipped to the card's rounded corners without needing their own
 * border-radius classes.
 */
const Card = ({
  horizontal = false,
  shadow     = true,
  className  = '',
  style,
  children,
}: CardProps) => {
  const classes = [
    'bg-white border border-gray-200 rounded-lg overflow-hidden',
    'dark:bg-gray-800 dark:border-gray-700',
    shadow ? 'shadow-md' : '',
    horizontal ? 'flex flex-col md:flex-row' : '',
    className,
  ].filter(Boolean).join(' ');

  return <div className={classes} style={style}>{children}</div>;
};

// ── CardImage ─────────────────────────────────────────────────────────────────

/**
 * A full-width image block. Place before CardBody for a top image, or as the
 * first child of a horizontal Card for a side image.
 *
 * No padding — the image sits flush against the card edge.
 * Dimensions are controlled via className (see CardProps example above).
 */
const CardImage = ({ src, alt = '', className = '' }: CardImageProps) => (
  <img
    src={src}
    alt={alt}
    className={`w-full object-cover ${className}`.trim()}
  />
);

// ── CardBody ──────────────────────────────────────────────────────────────────

/**
 * The padded content area. Defaults to p-5; override via className.
 * Place after CardImage, or directly inside Card when there is no image.
 */
const CardBody = ({ className = '', children }: CardBodyProps) => (
  <div className={`p-5 ${className}`.trim()}>
    {children}
  </div>
);

// ── Exports ───────────────────────────────────────────────────────────────────

export { CardImage, CardBody };
export default Card;
