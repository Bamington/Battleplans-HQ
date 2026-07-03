/**
 * VR.tsx — Vertical Rule component
 *
 * A thin vertical dividing line, with two style variants:
 *   - "default" — a plain 1px line, height taken from the parent
 *   - "or"      — a line · "OR" label · line, for layout separators
 *                 (e.g. the login form's "Sign in / Continue as guest" split)
 *
 * The `indented` prop adds top/bottom padding so the rule doesn't bleed
 * to the very edge of its container.
 *
 * USAGE EXAMPLES:
 *   <div className="flex h-40">
 *     <VR />                                   // plain line, fills parent height
 *     <VR style="or" />                        // OR separator, fills parent height
 *     <VR style="or" indented />               // OR separator with vertical padding
 *   </div>
 *
 * PROPS:
 *   style    — "default" (plain line) | "or" (line + OR + line). Default: "default".
 *   indented — Adds py-2.5 padding so the rule doesn't reach the container edge.
 *   className — Extra Tailwind classes on the outer element.
 */


// ── Type definitions ──────────────────────────────────────────────────────────

export type VrStyle = 'default' | 'or';

export interface VrProps {
  /** "default" renders a plain line; "or" renders line + OR label + line */
  style?: VrStyle;
  /** Adds top/bottom padding so the rule doesn't reach the container edges */
  indented?: boolean;
  /** Extra Tailwind classes */
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const VR = ({ style = 'default', indented = false, className = '' }: VrProps) => {

  // ── Default: plain vertical line ──────────────────────────────────────────
  if (style === 'default') {
    if (!indented) {
      // Simplest case — the element itself is the line
      return (
        <div
          className={['w-px bg-gray-700', className].filter(Boolean).join(' ')}
        />
      );
    }

    // Indented: wrap in a padded column so the line doesn't reach the edges
    return (
      <div className={['flex flex-col items-center py-2.5', className].filter(Boolean).join(' ')}>
        <div className="flex-1 w-px bg-gray-700 min-h-px" />
      </div>
    );
  }

  // ── Or: line + "OR" label + line ─────────────────────────────────────────
  return (
    <div
      className={[
        'flex flex-col items-center gap-1.5',
        indented ? 'py-2.5' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="flex-1 w-px bg-gray-700 min-h-px" />
      <span className="font-body font-bold text-base text-gray-500 uppercase shrink-0">
        OR
      </span>
      <div className="flex-1 w-px bg-gray-700 min-h-px" />
    </div>
  );
};

export default VR;
