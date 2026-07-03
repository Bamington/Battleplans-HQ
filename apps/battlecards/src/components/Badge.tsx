/**
 * Badge.tsx — Status label and tag component
 *
 * USAGE EXAMPLES:
 *   <Badge>New</Badge>
 *   <Badge color="success">Active</Badge>
 *   <Badge variant="outline" color="danger">Deprecated</Badge>
 *   <Badge size="lg" shape="pill">Featured</Badge>
 *   <Badge dot color="success">Online</Badge>
 *   <Badge icon={<Star className="w-3 h-3" />} color="warning">Legendary</Badge>
 *   <Badge onDismiss={() => setVisible(false)}>Dismissible</Badge>
 */

import React from 'react';

// ── Type definitions ──────────────────────────────────────────────────────────

/** Solid fill or outlined border */
export type BadgeVariant = 'solid' | 'outline';

/** Semantic colour role */
export type BadgeColor = 'primary' | 'gray' | 'success' | 'danger' | 'warning' | 'purple';

/** Size of the badge */
export type BadgeSize = 'sm' | 'lg';

/** Border-radius style */
export type BadgeShape = 'rounded' | 'pill';

export interface BadgeProps {
  /** Solid fill (default) or outlined border */
  variant?: BadgeVariant;
  /** Semantic colour role */
  color?: BadgeColor;
  /** sm (default) or lg */
  size?: BadgeSize;
  /** rounded (default) or pill (full radius) */
  shape?: BadgeShape;
  /** Optional icon rendered before the label (do not combine with dot) */
  icon?: React.ReactNode;
  /** Renders a small filled circle before the label (status indicator) */
  dot?: boolean;
  /** If provided, a dismiss (×) button appears; call this when it is clicked */
  onDismiss?: () => void;
  /** Extra Tailwind classes for one-off tweaks */
  className?: string;
  children: React.ReactNode;
}

// ── Lookup tables ─────────────────────────────────────────────────────────────

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2   py-0.5 text-xs',
  lg: 'px-2.5 py-1   text-sm',
};

const shapeClasses: Record<BadgeShape, string> = {
  rounded: 'rounded',
  pill:    'rounded-full',
};

const colorClasses: Record<BadgeVariant, Record<BadgeColor, string>> = {
  solid: {
    primary: 'bg-blue-100   text-blue-800   dark:bg-blue-900   dark:text-blue-300',
    gray:    'bg-gray-100   text-gray-800   dark:bg-gray-700   dark:text-gray-300',
    success: 'bg-green-100  text-green-800  dark:bg-green-900  dark:text-green-300',
    danger:  'bg-red-100    text-red-800    dark:bg-red-900    dark:text-red-300',
    warning: 'bg-amber-100  text-amber-800  dark:bg-amber-900  dark:text-amber-300',
    purple:  'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  },
  outline: {
    primary: 'border border-blue-400   text-blue-700   dark:border-blue-400   dark:text-blue-400',
    gray:    'border border-gray-400   text-gray-700   dark:border-gray-500   dark:text-gray-400',
    success: 'border border-green-400  text-green-700  dark:border-green-400  dark:text-green-400',
    danger:  'border border-red-400    text-red-700    dark:border-red-400    dark:text-red-400',
    warning: 'border border-amber-400  text-amber-700  dark:border-amber-400  dark:text-amber-400',
    purple:  'border border-purple-400 text-purple-700 dark:border-purple-400 dark:text-purple-400',
  },
};

/** Dot fill colours — rendered independently of badge variant */
const dotColorClasses: Record<BadgeColor, string> = {
  primary: 'bg-blue-500',
  gray:    'bg-gray-500',
  success: 'bg-green-500',
  danger:  'bg-red-500',
  warning: 'bg-amber-500',
  purple:  'bg-purple-500',
};

// ── Component ─────────────────────────────────────────────────────────────────

const Badge = ({
  variant   = 'solid',
  color     = 'primary',
  size      = 'sm',
  shape     = 'rounded',
  icon,
  dot       = false,
  onDismiss,
  className = '',
  children,
}: BadgeProps) => {

  const classes = [
    'inline-flex items-center gap-1.5 font-body font-medium',
    sizeClasses[size],
    shapeClasses[shape],
    colorClasses[variant][color],
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={classes}>

      {/* Status dot — takes priority over icon */}
      {dot && (
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${dotColorClasses[color]}`}
          aria-hidden="true"
        />
      )}

      {/* Optional icon — only rendered when dot is false */}
      {!dot && icon && (
        <span className="inline-flex w-3.5 h-3.5 shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}

      {children}

      {/* Dismiss button */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-0.5 ml-0.5 inline-flex items-center rounded-sm p-0.5 hover:opacity-75 focus:outline-none"
        >
          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}

    </span>
  );
};

export default Badge;
