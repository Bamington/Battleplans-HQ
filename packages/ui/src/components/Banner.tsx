/**
 * Banner.tsx — Full-width notification banner
 *
 * A slim, full-width bar that sits at the top of a page or section.
 * Contains an optional leading icon, a centred message, and an optional
 * dismiss button on the far right.
 *
 * Matches the Figma "Banner" component (node 170:6585).
 *
 * USAGE EXAMPLES:
 *   <Banner>Scheduled maintenance on Sunday at 2 am UTC.</Banner>
 *
 *   <Banner
 *     icon={<InfoCircle className="w-4 h-4" />}
 *     onDismiss={() => setVisible(false)}
 *   >
 *     A new version of BattleCards is available.
 *   </Banner>
 *
 * PROPS:
 *   children  — The banner message (text or any inline content).
 *   icon      — Optional 16×16 icon shown in a circular container to the left
 *               of the message. Pass an icon component, e.g. <InfoCircle />.
 *   onDismiss — When provided, renders a dismiss (×) button on the right.
 *   className — Extra Tailwind classes on the outer element.
 */

import React from 'react';

// ── Close icon (inline SVG — avoids coupling to the icon library) ─────────────

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

// ── Type definitions ──────────────────────────────────────────────────────────

export interface BannerProps {
  /** The banner message */
  children: React.ReactNode;
  /**
   * Optional icon displayed in a circular container to the left of the text.
   * Expected size: 16×16 (w-4 h-4). The container handles the background circle.
   */
  icon?: React.ReactNode;
  /** When provided, a dismiss button (×) is rendered on the right */
  onDismiss?: () => void;
  /** Extra Tailwind classes on the outer <div> */
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const Banner = ({ children, icon, onDismiss, className = '' }: BannerProps) => {
  return (
    <div
      className={[
        'w-full flex items-center gap-3 px-4 py-4',
        'bg-gray-800 border-b border-gray-700',
        className,
      ].filter(Boolean).join(' ')}
    >
      {/* ── Icon + message (centred in the remaining space) ──────────────── */}
      <div className="flex flex-1 items-center justify-center gap-2.5 min-w-0">

        {/* Circular icon container — only rendered when an icon is supplied */}
        {icon && (
          <div className="shrink-0 flex items-center justify-center size-6 rounded-full bg-gray-700 text-gray-300">
            {icon}
          </div>
        )}

        {/* Message text */}
        <p className="font-body text-sm text-white text-center">
          {children}
        </p>

      </div>

      {/* ── Dismiss button ────────────────────────────────────────────────── */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss banner"
          className="shrink-0 flex items-center justify-center size-8 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
};

export default Banner;
