/**
 * Text.tsx — Universal typography component
 *
 * The single component for all text in the app. The `variant` prop
 * controls the visual style and the HTML element that gets rendered.
 * Additional props layer on as modifiers (size, weight, colour, etc).
 *
 * USAGE EXAMPLES:
 *   <Text variant="h1">Page Title</Text>
 *   <Text variant="paragraph" size="lg" weight="semibold">Intro</Text>
 *   <Text variant="blockquote" align="center">A great quote.</Text>
 *   <Text variant="paragraph" color="brand" italic>Highlighted note</Text>
 *
 * HEADING SPECIAL STYLES (gradient, underline, highlight, mark):
 * These involve wrapping part of the text in a <span> with extra classes.
 * They are intentionally left as composition patterns rather than variants —
 * wrap the relevant words in a <span> inside your <Text variant="h1"> call.
 * Examples are shown in ComponentGallery.tsx.
 */

import React from 'react';

// ── Type definitions ─────────────────────────────────────────────────────────

/** All available text style variants */
export type TextVariant =
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'       // Headings (Tanker font)
  | 'paragraph'                                        // Default body paragraph
  | 'paragraph-lead'                                   // Larger intro paragraph
  | 'paragraph-dropcap'                                // Drop-cap first letter
  | 'blockquote'                                       // Simple italic quote
  | 'blockquote-solid'                                 // Quote with border + background
  | 'blockquote-icon';                                 // Quote with opening quotation mark icon

/** Tailwind font size scale */
export type TextSize =
  | 'xs' | 'sm' | 'base' | 'lg' | 'xl'
  | '2xl' | '3xl' | '4xl' | '5xl' | '6xl'
  | '7xl' | '8xl' | '9xl';

/** Tailwind font weight scale */
export type TextWeight =
  | 'thin' | 'extralight' | 'light' | 'normal' | 'medium'
  | 'semibold' | 'bold' | 'extrabold' | 'black';

/** Text alignment */
export type TextAlign = 'left' | 'center' | 'right';

/**
 * Semantic colour roles.
 * 'default' defers to each variant's built-in light/dark colours.
 */
export type TextColor = 'default' | 'secondary' | 'brand' | 'success' | 'danger' | 'purple' | 'teal';

/** Tailwind letter-spacing (tracking) scale */
export type TextSpacing =
  | 'tighter' | 'tight' | 'normal' | 'wide' | 'wider' | 'widest';

/** Tailwind line-height (leading) scale */
export type TextLeading =
  | 'none' | 'tight' | 'snug' | 'normal' | 'relaxed' | 'loose';

export interface TextProps {
  /** Controls the overall visual style and the HTML element rendered */
  variant?: TextVariant;
  /** Override the default font size for this variant */
  size?: TextSize;
  /** Override the default font weight for this variant */
  weight?: TextWeight;
  /** Text alignment */
  align?: TextAlign;
  /** Text colour — maps to a semantic role with light + dark values */
  color?: TextColor;
  /** Letter spacing override */
  spacing?: TextSpacing;
  /** Line height override */
  leading?: TextLeading;
  /** Italicise the text */
  italic?: boolean;
  /** Underline the text */
  underline?: boolean;
  /** Strike through the text */
  strikethrough?: boolean;
  /** Transform text to uppercase */
  uppercase?: boolean;
  /** Extra Tailwind classes to merge in (for one-off tweaks) */
  className?: string;
  children: React.ReactNode;
}

// ── Lookup tables ─────────────────────────────────────────────────────────────
//
// Each table maps a prop value to a complete Tailwind class string.
// Using full static strings (rather than template literals like `text-${size}`)
// ensures Tailwind's scanner detects and includes every class in the build.

const sizeClasses: Record<TextSize, string> = {
  xs:   'text-xs',
  sm:   'text-sm',
  base: 'text-base',
  lg:   'text-lg',
  xl:   'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
  '4xl': 'text-4xl',
  '5xl': 'text-5xl',
  '6xl': 'text-6xl',
  '7xl': 'text-7xl',
  '8xl': 'text-8xl',
  '9xl': 'text-9xl',
};

const weightClasses: Record<TextWeight, string> = {
  thin:       'font-thin',
  extralight: 'font-extralight',
  light:      'font-light',
  normal:     'font-normal',
  medium:     'font-medium',
  semibold:   'font-semibold',
  bold:       'font-bold',
  extrabold:  'font-extrabold',
  black:      'font-black',
};

const alignClasses: Record<TextAlign, string> = {
  left:   'text-left',
  center: 'text-center',
  right:  'text-right',
};

/**
 * Colour classes — each entry includes both light and dark values.
 * 'default' is intentionally empty — each variant handles its own default colour.
 */
const colorClasses: Record<TextColor, string> = {
  default:   '',
  secondary: 'text-gray-400',
  brand:     'text-blue-600 dark:text-blue-400',
  success: 'text-green-600 dark:text-green-400',
  danger:  'text-red-600 dark:text-red-400',
  purple:  'text-purple-600 dark:text-purple-400',
  teal:    'text-teal-600 dark:text-teal-400',
};

const spacingClasses: Record<TextSpacing, string> = {
  tighter: 'tracking-tighter',
  tight:   'tracking-tight',
  normal:  'tracking-normal',
  wide:    'tracking-wide',
  wider:   'tracking-wider',
  widest:  'tracking-widest',
};

const leadingClasses: Record<TextLeading, string> = {
  none:    'leading-none',
  tight:   'leading-tight',
  snug:    'leading-snug',
  normal:  'leading-normal',
  relaxed: 'leading-relaxed',
  loose:   'leading-loose',
};

// ── Variant base styles ───────────────────────────────────────────────────────

/** Default heading colour (light / dark) */
const HEADING_COLOR = 'text-gray-900 dark:text-white';
/** Default body text colour (light / dark) */
const BODY_COLOR    = 'text-gray-700 dark:text-gray-300';

/**
 * The baseline Tailwind classes for each variant.
 * Prop overrides are layered on top of these.
 * Headings use font-heading (Tanker); everything else uses font-body (Space Grotesk).
 */
const variantBaseClasses: Record<TextVariant, string> = {
  // ── Headings ──────────────────────────────────────────────────────────────
  h1: `font-heading text-5xl font-bold tracking-tight ${HEADING_COLOR}`,
  h2: `font-heading text-4xl font-bold tracking-tight ${HEADING_COLOR}`,
  h3: `font-heading text-3xl font-bold tracking-tight ${HEADING_COLOR}`,
  h4: `font-heading text-2xl font-bold tracking-tight ${HEADING_COLOR}`,
  h5: `font-heading text-xl  font-bold tracking-tight ${HEADING_COLOR}`,
  h6: `font-heading text-lg  font-bold tracking-tight ${HEADING_COLOR}`,

  // ── Paragraphs ────────────────────────────────────────────────────────────
  paragraph:
    `font-body text-base ${BODY_COLOR}`,

  'paragraph-lead':
    `font-body text-lg md:text-xl ${BODY_COLOR}`,

  // first-letter and first-line modifiers create the drop-cap effect
  'paragraph-dropcap':
    `font-body text-base ${BODY_COLOR} ` +
    `first-line:uppercase first-line:tracking-widest ` +
    `first-letter:text-7xl first-letter:font-bold first-letter:float-start first-letter:me-3`,

  // ── Blockquotes ───────────────────────────────────────────────────────────
  // Note: blockquote-solid and blockquote-icon render custom HTML structures
  // (see the component body below) — these base classes apply to the inner <p>.
  blockquote:
    `font-body text-xl italic font-semibold tracking-tight ${HEADING_COLOR}`,

  'blockquote-solid':
    `font-body text-xl italic font-medium leading-relaxed ${HEADING_COLOR}`,

  'blockquote-icon':
    `font-body text-2xl italic font-semibold text-center ${HEADING_COLOR}`,
};

/**
 * The HTML element each variant renders as.
 * blockquote-solid and blockquote-icon are handled separately below
 * because they require custom wrapper markup.
 */
const variantElements: Partial<Record<TextVariant, keyof React.JSX.IntrinsicElements>> = {
  h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6',
  paragraph:            'p',
  'paragraph-lead':     'p',
  'paragraph-dropcap':  'p',
  blockquote:           'blockquote',
};

// ── Component ─────────────────────────────────────────────────────────────────

const Text = ({
  variant = 'paragraph',
  size,
  weight,
  align,
  color,
  spacing,
  leading,
  italic,
  underline,
  strikethrough,
  uppercase,
  className = '',
  children,
}: TextProps) => {

  // Build the resolved colour class (empty string if 'default' — variant handles it)
  const resolvedColor = color && color !== 'default' ? colorClasses[color] : '';

  // Collect modifier classes from optional props, filtering out empty strings
  const modifiers = [
    size          ? sizeClasses[size]       : '',
    weight        ? weightClasses[weight]   : '',
    align         ? alignClasses[align]     : '',
    resolvedColor,
    spacing       ? spacingClasses[spacing] : '',
    leading       ? leadingClasses[leading] : '',
    italic        ? 'italic'                : '',
    underline     ? 'underline'             : '',
    strikethrough ? 'line-through'          : '',
    uppercase     ? 'uppercase'             : '',
    className,
  ].filter(Boolean).join(' ');

  const baseClasses  = variantBaseClasses[variant];
  const finalClasses = `${baseClasses} ${modifiers}`.trim();

  // ── blockquote-solid ───────────────────────────────────────────────────────
  // Requires a <blockquote> wrapper with a left border + background,
  // with the text content inside a <p>.
  if (variant === 'blockquote-solid') {
    return (
      <blockquote className="p-4 my-4 border-s-4 border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-800">
        <p className={finalClasses}>{children}</p>
      </blockquote>
    );
  }

  // ── blockquote-icon ────────────────────────────────────────────────────────
  // Renders a <figure> with a decorative quotation mark SVG above the quote text.
  if (variant === 'blockquote-icon') {
    return (
      <figure className="max-w-screen-md mx-auto">
        {/* Opening quotation mark — decorative, hidden from screen readers */}
        <svg
          className="w-10 h-10 mx-auto mb-3 text-gray-400 dark:text-gray-600"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="currentColor"
          viewBox="0 0 18 14"
        >
          <path d="M6 0H2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4v1a3 3 0 0 1-3 3H2a1 1 0 0 0 0 2h1a5.006 5.006 0 0 0 5-5V2a2 2 0 0 0-2-2Zm10 0h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4v1a3 3 0 0 1-3 3h-1a1 1 0 0 0 0 2h1a5.006 5.006 0 0 0 5-5V2a2 2 0 0 0-2-2Z" />
        </svg>
        <blockquote>
          <p className={finalClasses}>{children}</p>
        </blockquote>
      </figure>
    );
  }

  // ── All other variants ─────────────────────────────────────────────────────
  // Look up the correct HTML element, falling back to <p> if not found.
  const Tag = (variantElements[variant] ?? 'p') as React.ElementType;
  return <Tag className={finalClasses}>{children}</Tag>;
};

export default Text;
