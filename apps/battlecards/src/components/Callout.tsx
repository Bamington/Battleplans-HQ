/**
 * Callout.tsx — Inline callout / alert box
 *
 * A bordered, coloured box used to draw attention to important information.
 * Supports four semantic flavours that map to the design system's colour roles.
 *
 * Matches the Figma "Callout" component (node 170:6977).
 *
 * USAGE EXAMPLES:
 *   <Callout>Your roster has been saved.</Callout>
 *
 *   <Callout flavour="good" onDismiss={() => setVisible(false)}>
 *     Unit added successfully.
 *   </Callout>
 *
 *   <Callout flavour="warning" leadingIcon={false}>
 *     This action cannot be undone.
 *   </Callout>
 *
 *   <Callout flavour="bad" icon={<MyCustomIcon />}>
 *     Failed to save — check your connection.
 *   </Callout>
 *
 * PROPS:
 *   children    — The callout message (text or inline content).
 *   flavour     — "default" | "good" | "warning" | "bad". Controls colours.
 *   leadingIcon — Show the circular icon on the left (default: true).
 *   icon        — Custom 16×16 icon overriding the flavour default.
 *   onDismiss   — When provided, renders a dismiss (×) button on the right.
 *   className   — Extra Tailwind classes on the outer element.
 */

import React from 'react';

// ── Type definitions ──────────────────────────────────────────────────────────

export type CalloutFlavour = 'default' | 'good' | 'warning' | 'bad';

export interface CalloutProps {
  /** The callout message */
  children: React.ReactNode;
  /** Semantic flavour — controls background, border, and text colour */
  flavour?: CalloutFlavour;
  /** Show the circular leading icon (default: true) */
  leadingIcon?: boolean;
  /**
   * Custom 16×16 icon. When omitted, a sensible default is shown per flavour.
   * Pass `null` to suppress the icon entirely (same effect as leadingIcon={false}).
   */
  icon?: React.ReactNode;
  /** When provided, a dismiss (×) button is rendered on the right */
  onDismiss?: () => void;
  /** Extra Tailwind classes on the outer element */
  className?: string;
}

// ── Lookup tables ─────────────────────────────────────────────────────────────

const flavourClasses: Record<CalloutFlavour, {
  wrapper:  string;  // border + background on the outer box
  text:     string;  // message text colour
  iconBg:   string;  // circular icon container background
  closeBg:  string;  // close button hover background
}> = {
  default: {
    wrapper: 'bg-gray-800 border-gray-600',
    text:    'text-white',
    iconBg:  'bg-gray-700',
    closeBg: 'hover:bg-white/10',
  },
  good: {
    wrapper: 'bg-emerald-950 border-emerald-600',
    text:    'text-emerald-400',
    iconBg:  'bg-emerald-900',
    closeBg: 'hover:bg-emerald-800/50',
  },
  warning: {
    wrapper: 'bg-amber-900 border-amber-600',
    text:    'text-amber-300',
    iconBg:  'bg-amber-800',
    closeBg: 'hover:bg-amber-700/50',
  },
  bad: {
    wrapper: 'bg-red-950 border-red-600',
    text:    'text-red-400',
    iconBg:  'bg-red-900',
    closeBg: 'hover:bg-red-800/50',
  },
};

// ── Default icons per flavour (inline SVG — no icon-library dependency) ───────

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M8 7.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="8" cy="5.75" r="0.75" fill="currentColor" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3 8.5l3.5 3.5 6.5-7"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const WarningIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M8 2.5 14 13.5H2L8 2.5Z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path d="M8 7v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="8" cy="11.25" r="0.75" fill="currentColor" />
  </svg>
);

const ErrorIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" />
    <path
      d="M5.75 5.75l4.5 4.5M10.25 5.75l-4.5 4.5"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4.5 4.5l7 7M11.5 4.5l-7 7"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const DEFAULT_ICONS: Record<CalloutFlavour, React.ReactNode> = {
  default: <InfoIcon />,
  good:    <CheckIcon />,
  warning: <WarningIcon />,
  bad:     <ErrorIcon />,
};

// ── Component ─────────────────────────────────────────────────────────────────

const Callout = ({
  children,
  flavour     = 'default',
  leadingIcon = true,
  icon,
  onDismiss,
  className   = '',
}: CalloutProps) => {
  const styles = flavourClasses[flavour];
  const resolvedIcon = icon ?? DEFAULT_ICONS[flavour];

  return (
    <div
      className={[
        'flex items-center gap-2.5 p-4 rounded-[6px] border w-full',
        styles.wrapper,
        className,
      ].filter(Boolean).join(' ')}
    >
      {/* ── Icon + message ─────────────────────────────────────────────── */}
      <div className="flex flex-1 items-center gap-2.5 min-w-0">

        {/* Circular icon container */}
        {leadingIcon && resolvedIcon && (
          <div
            className={[
              'shrink-0 flex items-center justify-center size-6 rounded-full',
              styles.iconBg,
              styles.text,
            ].join(' ')}
          >
            {resolvedIcon}
          </div>
        )}

        {/* Message */}
        <p className={['font-body text-sm flex-1 min-w-0', styles.text].join(' ')}>
          {children}
        </p>

      </div>

      {/* ── Dismiss button ───────────────────────────────────────────────── */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className={[
            'shrink-0 flex items-center justify-center size-8 rounded-xl transition-colors',
            styles.text,
            styles.closeBg,
          ].join(' ')}
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
};

export default Callout;
