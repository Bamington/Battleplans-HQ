/**
 * TextLink.tsx — Link component
 *
 * Renders anchor links in several visual styles. All variants use the
 * Space Grotesk body font for consistency with surrounding text.
 *
 * For in-app navigation use the `to` prop (React Router).
 * For external URLs use the `href` prop — external links automatically
 * open in a new tab with rel="noopener noreferrer" for security.
 *
 * USAGE EXAMPLES:
 *   <TextLink href="https://example.com">External link</TextLink>
 *   <TextLink to="/library">Go to Library</TextLink>
 *   <TextLink variant="button" to="/create">Create Card</TextLink>
 *   <TextLink variant="icon" href="https://example.com" icon={<ArrowIcon />}>
 *     Learn more
 *   </TextLink>
 *   <TextLink variant="cta" to="/start">Get started →</TextLink>
 */

import React from 'react';
import { Link } from 'react-router-dom';

// ── Type definitions ─────────────────────────────────────────────────────────

/** All available link style variants */
export type LinkVariant =
  | 'default'    // Inline text link with underline on hover
  | 'paragraph'  // Inline link always underlined (for use within body copy)
  | 'icon'       // Link with an icon to the left of the label
  | 'cta'        // Call-to-action — bordered pill button
  | 'button';    // Filled button-style link

export interface TextLinkProps {
  /** Controls the visual style of the link */
  variant?: LinkVariant;
  /** External URL — opens in a new tab */
  href?: string;
  /** Internal route path (React Router) */
  to?: string;
  /**
   * Icon element displayed to the left of the label.
   * Only used when variant='icon'.
   */
  icon?: React.ReactNode;
  /** Extra Tailwind classes to merge in */
  className?: string;
  children: React.ReactNode;
}

// ── Variant styles ────────────────────────────────────────────────────────────

const variantClasses: Record<LinkVariant, string> = {
  // Inline link — underline appears on hover
  default:
    'font-body font-medium text-blue-600 dark:text-blue-400 hover:underline',

  // Inline link always underlined — for embedding in paragraphs
  paragraph:
    'font-body font-medium text-blue-600 dark:text-blue-400 underline hover:no-underline',

  // Link with icon — uses flexbox to align icon and text
  icon:
    'font-body inline-flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400 hover:underline',

  // Call-to-action — subtle bordered block
  cta:
    'font-body inline-flex items-center justify-center gap-2 px-5 py-2.5 ' +
    'text-sm font-medium border border-gray-300 dark:border-gray-600 ' +
    'text-gray-700 dark:text-gray-300 rounded-lg ' +
    'bg-gray-50 dark:bg-gray-800 ' +
    'hover:bg-gray-100 dark:hover:bg-gray-700 ' +
    'hover:text-gray-900 dark:hover:text-white ' +
    'transition-colors',

  // Filled button — primary action style
  button:
    'font-body inline-flex items-center justify-center px-4 py-2.5 ' +
    'text-sm font-medium text-white bg-blue-600 rounded-lg ' +
    'hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 ' +
    'dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800 ' +
    'transition-colors',
};

// ── Component ─────────────────────────────────────────────────────────────────

const TextLink = ({
  variant = 'default',
  href,
  to,
  icon,
  className = '',
  children,
}: TextLinkProps) => {

  const finalClasses = `${variantClasses[variant]} ${className}`.trim();

  // ── Internal link (React Router) ───────────────────────────────────────────
  if (to) {
    return (
      <Link to={to} className={finalClasses}>
        {variant === 'icon' && icon}
        {children}
      </Link>
    );
  }

  // ── External link ──────────────────────────────────────────────────────────
  // rel="noopener noreferrer" prevents the new tab from accessing the
  // opener window — a standard security practice for external links.
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={finalClasses}
    >
      {variant === 'icon' && icon}
      {children}
    </a>
  );
};

export default TextLink;
