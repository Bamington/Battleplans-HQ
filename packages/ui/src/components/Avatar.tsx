/**
 * Avatar.tsx — User avatar component
 *
 * Renders a user image, falling back to text initials or a placeholder icon
 * when no image source is provided.
 *
 * USAGE EXAMPLES:
 *   <Avatar src="/avatars/jane.png" alt="Jane Lee" />
 *   <Avatar initials="JL" size="lg" color="primary" />
 *   <Avatar status="online" />
 *   <Avatar src="/avatars/jane.png" bordered />
 *
 * COMPOSITION — Avatar with name/metadata (no extra props needed):
 *   <div className="flex items-center gap-3">
 *     <Avatar src="/avatars/jane.png" alt="Jane Lee" />
 *     <div>
 *       <Text variant="paragraph" weight="semibold">Jane Lee</Text>
 *       <Text variant="paragraph" size="sm" color="default">Commander</Text>
 *     </div>
 *   </div>
 *
 * STACKED GROUP:
 *   <AvatarGroup max={4}>
 *     <Avatar src="/avatars/a.png" alt="Alice" />
 *     <Avatar src="/avatars/b.png" alt="Bob" />
 *     <Avatar initials="CJ" />
 *   </AvatarGroup>
 */

import React from 'react';

// ── Type definitions ──────────────────────────────────────────────────────────

/** Dimensions of the avatar */
export type AvatarSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl';

/** Border-radius style */
export type AvatarShape = 'circle' | 'rounded';

/** Online presence status — renders a coloured dot indicator */
export type AvatarStatus = 'online' | 'offline' | 'busy' | 'away';

/**
 * Background colour for initials / placeholder avatars.
 * Has no effect when src is provided.
 */
export type AvatarColor = 'gray' | 'primary' | 'success' | 'danger' | 'warning' | 'purple';

export interface AvatarProps {
  /** Image URL — when omitted, falls back to initials or placeholder icon */
  src?: string;
  /** Alt text for the image */
  alt?: string;
  /** Up to 2 characters shown when no src is provided */
  initials?: string;
  /** Background colour for initials / placeholder (default: gray) */
  color?: AvatarColor;
  /** Size of the avatar */
  size?: AvatarSize;
  /** circle (default) or rounded */
  shape?: AvatarShape;
  /** Adds a white ring border around the avatar */
  bordered?: boolean;
  /** Renders a small status dot in the bottom-right corner */
  status?: AvatarStatus;
  /** Extra Tailwind classes for one-off tweaks */
  className?: string;
}

export interface AvatarGroupProps {
  /** Avatar elements to display */
  children: React.ReactNode;
  /** Maximum avatars to show — excess are replaced with a "+N" counter */
  max?: number;
  /** Extra Tailwind classes on the group container */
  className?: string;
}

// ── Lookup tables ─────────────────────────────────────────────────────────────

/** Container dimensions + text size for each size variant */
const sizeClasses: Record<AvatarSize, string> = {
  xs:  'w-6  h-6  text-xs',
  sm:  'w-8  h-8  text-xs',
  base:'w-10 h-10 text-sm',
  lg:  'w-12 h-12 text-base',
  xl:  'w-14 h-14 text-lg',
  '2xl': 'w-16 h-16 text-xl',
};

/** Status dot size per avatar size */
const dotSizeClasses: Record<AvatarSize, string> = {
  xs:    'w-1.5 h-1.5',
  sm:    'w-2   h-2',
  base:  'w-2.5 h-2.5',
  lg:    'w-3   h-3',
  xl:    'w-3.5 h-3.5',
  '2xl': 'w-4   h-4',
};

const shapeClasses: Record<AvatarShape, string> = {
  circle:  'rounded-full',
  rounded: 'rounded-lg',
};

/** Background + text colour for initials / placeholder avatars */
const colorClasses: Record<AvatarColor, string> = {
  gray:    'bg-gray-200   text-gray-600   dark:bg-gray-600   dark:text-gray-300',
  primary: 'bg-blue-100   text-blue-700   dark:bg-blue-900   dark:text-blue-300',
  success: 'bg-green-100  text-green-700  dark:bg-green-900  dark:text-green-300',
  danger:  'bg-red-100    text-red-700    dark:bg-red-900    dark:text-red-300',
  warning: 'bg-amber-100  text-amber-700  dark:bg-amber-900  dark:text-amber-300',
  purple:  'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

/** Coloured dot for the status indicator */
const statusDotClasses: Record<AvatarStatus, string> = {
  online:  'bg-green-400',
  offline: 'bg-gray-400',
  busy:    'bg-red-500',
  away:    'bg-amber-400',
};

// ── Placeholder icon ──────────────────────────────────────────────────────────

/** Generic user silhouette — shown when no src or initials are provided */
const PlaceholderIcon = () => (
  <svg
    className="w-[60%] h-[60%]"
    fill="currentColor"
    viewBox="0 0 20 20"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
      clipRule="evenodd"
    />
  </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────

const Avatar = ({
  src,
  alt      = '',
  initials,
  color    = 'gray',
  size     = 'base',
  shape    = 'circle',
  bordered = false,
  status,
  className = '',
}: AvatarProps) => {

  const shapeClass   = shapeClasses[shape];
  const sizeClass    = sizeClasses[size];
  const borderClass  = bordered ? 'ring-2 ring-white dark:ring-gray-800' : '';

  // Inner element — image, initials, or icon
  const inner = src ? (
    <img
      src={src}
      alt={alt}
      className={`w-full h-full object-cover ${shapeClass} ${borderClass}`}
    />
  ) : (
    <div
      className={[
        'inline-flex items-center justify-center w-full h-full font-body font-semibold',
        shapeClass,
        borderClass,
        colorClasses[color],
      ].filter(Boolean).join(' ')}
      aria-label={alt || undefined}
    >
      {initials
        ? <span>{initials.slice(0, 2).toUpperCase()}</span>
        : <PlaceholderIcon />
      }
    </div>
  );

  return (
    <div
      className={[
        'relative inline-flex items-center justify-center shrink-0',
        sizeClass,
        className,
      ].filter(Boolean).join(' ')}
    >
      {inner}

      {/* Status dot — absolutely positioned at bottom-right */}
      {status && (
        <span
          aria-label={status}
          className={[
            'absolute bottom-0 right-0 rounded-full ring-1 ring-white dark:ring-gray-800',
            dotSizeClasses[size],
            statusDotClasses[status],
          ].join(' ')}
        />
      )}
    </div>
  );
};

// ── AvatarGroup ───────────────────────────────────────────────────────────────

/**
 * AvatarGroup — Displays a stack of overlapping avatars.
 *
 * When a `max` is set, avatars beyond the limit are replaced with a "+N"
 * counter styled to match the default avatar size.
 *
 * USAGE:
 *   <AvatarGroup max={3}>
 *     <Avatar src="..." bordered />
 *     <Avatar src="..." bordered />
 *     <Avatar initials="AB" bordered />
 *     <Avatar initials="CD" bordered />
 *   </AvatarGroup>
 */
const AvatarGroup = ({ children, max, className = '' }: AvatarGroupProps) => {
  const all      = React.Children.toArray(children);
  const visible  = max !== undefined ? all.slice(0, max) : all;
  const overflow = max !== undefined ? Math.max(0, all.length - max) : 0;

  return (
    <div className={`flex -space-x-3 rtl:space-x-reverse ${className}`}>
      {visible}
      {overflow > 0 && (
        <div className="relative inline-flex items-center justify-center shrink-0 w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-600 ring-2 ring-white dark:ring-gray-800 font-body text-sm font-medium text-gray-600 dark:text-gray-300">
          +{overflow}
        </div>
      )}
    </div>
  );
};

export { AvatarGroup };
export default Avatar;
