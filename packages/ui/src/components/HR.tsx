/**
 * HR.tsx — Horizontal Rule component
 *
 * Decorative dividers for separating sections of content.
 * Five variants are available, from a plain full-width rule
 * to trimmed, icon, labelled, and diamond shape styles.
 *
 * USAGE EXAMPLES:
 *   <HR />
 *   <HR variant="trimmed" />
 *   <HR variant="text" label="or" />
 *   <HR variant="icon" icon={<SwordIcon />} />
 *   <HR variant="shape" />
 */

import React from 'react';

// ── Type definitions ─────────────────────────────────────────────────────────

/** All available HR style variants */
export type HRVariant =
  | 'default'  // Full-width 1px line
  | 'trimmed'  // Short centred line
  | 'icon'     // Line with an icon centred on it
  | 'text'     // Line with a text label centred on it
  | 'shape';   // Small solid rectangle

export interface HRProps {
  /** Controls the visual style rendered */
  variant?: HRVariant;
  /**
   * Text label displayed across the centre of the rule.
   * Only used when variant='text'.
   */
  label?: string;
  /**
   * Icon element displayed across the centre of the rule.
   * Only used when variant='icon'.
   */
  icon?: React.ReactNode;
  /** Extra Tailwind classes to merge onto the wrapper */
  className?: string;
}

/** Shared rule colour — adapts to light and dark mode */
const RULE_COLOR = 'bg-gray-200 dark:bg-gray-700';

// ── Component ─────────────────────────────────────────────────────────────────

const HR = ({
  variant = 'default',
  label,
  icon,
  className = '',
}: HRProps) => {

  // ── default ────────────────────────────────────────────────────────────────
  // A simple full-width 1px horizontal rule.
  if (variant === 'default') {
    return (
      <hr className={`h-px my-8 border-0 ${RULE_COLOR} ${className}`.trim()} />
    );
  }

  // ── trimmed ────────────────────────────────────────────────────────────────
  // A short centred rule — good for section breaks that don't need full width.
  if (variant === 'trimmed') {
    return (
      <hr
        className={`w-48 h-1 mx-auto my-6 border-0 rounded-sm ${RULE_COLOR} ${className}`.trim()}
      />
    );
  }

  // ── shape ──────────────────────────────────────────────────────────────────
  // A small solid rectangle — a more decorative alternative to a plain rule.
  if (variant === 'shape') {
    return (
      <hr
        className={`w-8 h-8 mx-auto my-8 border-0 rounded-sm ${RULE_COLOR} ${className}`.trim()}
      />
    );
  }

  // ── icon ───────────────────────────────────────────────────────────────────
  // A rule with an icon element centred on it.
  // The icon is wrapped in a <span> that sits on top of the line.
  if (variant === 'icon') {
    return (
      <div className={`flex items-center my-8 ${className}`.trim()}>
        {/* Left rule */}
        <hr className={`flex-1 h-px border-0 ${RULE_COLOR}`} />
        {/* Centred icon — background matches the page to "cut" through the line */}
        <span className="mx-3 text-gray-400 dark:text-gray-500">
          {icon}
        </span>
        {/* Right rule */}
        <hr className={`flex-1 h-px border-0 ${RULE_COLOR}`} />
      </div>
    );
  }

  // ── text ───────────────────────────────────────────────────────────────────
  // A rule with a short text label centred on it (e.g. "or", "and").
  if (variant === 'text') {
    return (
      <div className={`flex items-center my-8 ${className}`.trim()}>
        {/* Left rule */}
        <hr className={`flex-1 h-px border-0 ${RULE_COLOR}`} />
        {/* Centred label */}
        <span className="mx-3 font-body text-sm font-medium text-gray-500 dark:text-gray-400">
          {label}
        </span>
        {/* Right rule */}
        <hr className={`flex-1 h-px border-0 ${RULE_COLOR}`} />
      </div>
    );
  }

  // Fallback (should never be reached given the type constraint)
  return <hr className={`h-px my-8 border-0 ${RULE_COLOR} ${className}`.trim()} />;
};

export default HR;
