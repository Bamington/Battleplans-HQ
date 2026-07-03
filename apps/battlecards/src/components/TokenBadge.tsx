/**
 * TokenBadge.tsx — Inline-painted "badge" token used by User-Created Tokens
 *
 * Substitute for the SVG-asset `<img>` that game tokens use. Renders a
 * colored circle with up to two glyph characters and an optional count
 * indicator. Sized by the parent (TokenMenu uses ~20px, TokenOverlay
 * uses ~84px).
 *
 * Game tokens (display_color = null) still render via their `icon`
 * asset URL — this component is only used when `display_color` is set
 * on the TokenDefinition.
 *
 * USAGE:
 *   <TokenBadge color="#f85908" glyph="P" size={84} count={3} />
 */

import type { CSSProperties } from 'react';

export interface TokenBadgeProps {
  /** Hex / CSS colour for the circle background. */
  color: string;
  /** Up to 2 characters drawn inside the circle. Uppercased for visual weight. */
  glyph: string;
  /** Outer diameter in pixels. */
  size: number;
  /** Stack count — when > 1 a small count chip renders in the top-right. */
  count?: number;
  /** Extra styles merged onto the outer wrapper (e.g. position: 'absolute'). */
  style?: CSSProperties;
  /** Drop-shadow on the badge — matches TokenOverlay's icon shadow. Default true. */
  shadow?: boolean;
}

const TokenBadge = ({
  color,
  glyph,
  size,
  count,
  style,
  shadow = true,
}: TokenBadgeProps) => {
  // Glyph: 1 char ≈ 0.5em, 2 chars ≈ 0.4em so both fit comfortably.
  const glyphChars = glyph.slice(0, 2);
  const fontSize   = size * (glyphChars.length === 2 ? 0.4 : 0.5);

  const countSize     = Math.max(16, Math.round(size * 0.4));
  const countFontSize = Math.max(11, Math.round(size * 0.26));

  return (
    <div
      style={{
        position: 'relative',
        width:  size,
        height: size,
        flexShrink: 0,
        filter: shadow ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))' : undefined,
        ...style,
      }}
    >
      {/* Main badge circle */}
      <div
        style={{
          width:  '100%',
          height: '100%',
          borderRadius: '50%',
          background: color,
          color: '#fff',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 900,
          fontSize,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textTransform: 'uppercase',
          letterSpacing: glyphChars.length === 2 ? '-0.04em' : 0,
          userSelect: 'none',
          // Subtle inner ring so light-colour badges still read on the card.
          boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.25)',
        }}
      >
        {glyphChars}
      </div>

      {/* Count chip (top-right) — only when > 1 */}
      {count != null && count > 1 && (
        <div
          style={{
            position: 'absolute',
            top: -Math.round(size * 0.06),
            right: -Math.round(size * 0.06),
            minWidth: countSize,
            height: countSize,
            padding: '0 4px',
            borderRadius: countSize / 2,
            background: '#111827',
            color: '#fff',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            fontSize: countFontSize,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #fff',
            boxSizing: 'border-box',
            userSelect: 'none',
          }}
        >
          {count}
        </div>
      )}
    </div>
  );
};

export default TokenBadge;
