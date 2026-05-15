/**
 * TokenBar.tsx — Vertical bar visualisation for stat-linked counter tokens
 *
 * Used by `TokenOverlay` when a token's `display_style === 'bar'`. Behaves
 * like a classic video-game health bar:
 *   - The bar is anchored to the BOTTOM and grows upward as health is
 *     restored. Maximum extends to the top.
 *   - At 0 token count (no wounds taken), the fill covers the whole bar.
 *   - Each increment of the underlying token count shrinks the fill
 *     downward, revealing the dark container background above.
 *
 * Two numbers are shown:
 *   - Cap label at the top: small, painted in the palette's inactive text
 *     colour so it reads against the dark container background. Always
 *     rendered unless the filled bar covers its position.
 *   - Remaining count centred in the filled section: large, white text.
 *     Hides when the fill is too small to display it legibly.
 *
 * Colours come from a resolved `TokenPalette` (see tokenColorSets.ts):
 *   - Container (inactive): bg = 950, stroke = 800, text = 800
 *   - Filled bar (active):  bg = 700, stroke = 500, text = white
 *
 * Font: Space Grotesk (project-wide token-bar default).
 *
 * USAGE:
 *   <TokenBar max={20} current={3} palette={...} width={80} height={890} />
 */

import { useState, type CSSProperties } from 'react';
import type { TokenPalette } from '../lib/tokenColorSets';
import AddCircle   from '../icons/AddCircle';
import MinusCircle from '../icons/MinusCircle';

export interface TokenBarProps {
  /** Maximum value of the underlying stat (e.g. card.wounds = 20). */
  max: number;
  /** Current token count (e.g. wounds taken = 3). Bar fills from the top
   *  down as this grows. */
  current: number;
  /** Resolved palette — container uses inactive, filled bar uses active. */
  palette: TokenPalette;
  /** Bar width in pixels. */
  width: number;
  /** Bar height in pixels. */
  height: number;
  /** Extra styles merged onto the outer wrapper (e.g. position). */
  style?: CSSProperties;
  /** When provided, the bar becomes interactive. The top third hovers a
   *  plus and clicks decrement `current` by 1 (healing → remaining +1);
   *  the bottom third hovers a minus and clicks increment `current`
   *  (damage → remaining −1). Clamped at [0, max]. */
  onChange?: (newCurrent: number) => void;
}

const BAR_FONT_FAMILY = "'Space Grotesk', sans-serif";

const TokenBar = ({
  max,
  current,
  palette,
  width,
  height,
  style,
  onChange,
}: TokenBarProps) => {
  const safeMax    = Math.max(0, Math.floor(max));
  const safeCurr   = Math.max(0, Math.min(safeMax, Math.floor(current)));
  const remaining  = safeMax - safeCurr;
  const fillPct    = safeMax > 0 ? (remaining / safeMax) * 100 : 0;

  // Number sizes scale with bar width so both stay legible at any carousel
  // zoom level. Cap label sits at ~half the size of the remaining number
  // to match the visual hierarchy in the design.
  const remainingFontSize = Math.max(28, Math.floor(width * 0.7));
  const maxFontSize       = Math.max(14, Math.floor(width * 0.32));

  // When the filled section grows tall enough to overlap the cap label,
  // hide the cap so we don't render the number twice on top of itself.
  const CAP_BAND_PCT = 18;
  const remainingNumberOverlapsCap = fillPct > 100 - CAP_BAND_PCT;

  // ── Interactive zone state (only used when `onChange` is provided) ──
  const [hoveredZone, setHoveredZone] = useState<'top' | 'bottom' | null>(null);
  const canHeal   = safeCurr > 0;            // can decrement wound count
  const canDamage = safeCurr < safeMax;      // can increment wound count
  const iconSize  = Math.max(24, Math.floor(width * 0.5));

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        background: palette.inactive.bg,
        border: `2px solid ${palette.inactive.stroke}`,
        borderRadius: 12,
        boxSizing: 'border-box',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        // The bar lives inside TokenOverlay, which sets
        // `pointerEvents: 'none'` on its wrapper so badges/icons don't
        // intercept clicks meant for the card. When the bar is
        // interactive, opt back into pointer events here so the
        // hit-zone buttons below actually receive hover/click.
        pointerEvents: onChange ? 'auto' : 'none',
        ...style,
      }}
    >
      {/* Filled section — anchored to the BOTTOM, grows upward. The
          remaining count is centred inside it. Uses the palette's active
          state: bg-700, stroke-500, text white. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: `${fillPct}%`,
          background: palette.active.bg,
          // Stroke only on the top edge so the filled bar reads as a
          // "water level" against the container, without competing with
          // the outer border on the sides.
          borderTop: `2px solid ${palette.active.stroke}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: palette.active.text,
          fontFamily: BAR_FONT_FAMILY,
          fontWeight: 700,
          fontSize: remainingFontSize,
          lineHeight: 1,
          letterSpacing: '-0.04em',
          textShadow: '0 2px 4px rgba(0,0,0,0.55)',
          overflow: 'hidden',
          ...(fillPct < 12 ? { color: 'transparent' } : null),
        }}
      >
        {remaining}
      </div>

      {/* Cap label — small, inactive-text-coloured, fixed at the top of
          the bar. Hides when the filled section would overlap it. */}
      {!remainingNumberOverlapsCap && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 0,
            right: 0,
            textAlign: 'center',
            color: palette.inactive.text,
            fontFamily: BAR_FONT_FAMILY,
            fontWeight: 700,
            fontSize: maxFontSize,
            lineHeight: 1,
            letterSpacing: '-0.04em',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          {safeMax}
        </div>
      )}

      {/* ── Interactive zones (only when onChange is provided) ────────
          Three invisible buttons split the bar into thirds. Top heals
          (decrements current), bottom damages (increments current); the
          middle stays inert. On hover, each shows a white 50% overlay
          and its respective icon. Disabled when at the relevant limit. */}
      {onChange && (
        <>
          {/* Top — heal (plus). Decrements current by 1, clamped at 0. */}
          <button
            type="button"
            aria-label="Heal"
            disabled={!canHeal}
            onMouseEnter={() => canHeal && setHoveredZone('top')}
            onMouseLeave={() => setHoveredZone(null)}
            onFocus={() => canHeal && setHoveredZone('top')}
            onBlur={() => setHoveredZone(null)}
            onClick={() => onChange(safeCurr - 1)}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: '33.333%',
              padding: 0,
              border: 'none',
              background: hoveredZone === 'top'
                ? 'rgba(255,255,255,0.5)'
                : 'transparent',
              cursor: canHeal ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 120ms ease',
              zIndex: 2,
            }}
          >
            {hoveredZone === 'top' && canHeal && (
              <div style={{ width: iconSize, height: iconSize, color: '#fff' }}>
                <AddCircle className="w-full h-full" />
              </div>
            )}
          </button>

          {/* Bottom — damage (minus). Increments current by 1, clamped at max. */}
          <button
            type="button"
            aria-label="Damage"
            disabled={!canDamage}
            onMouseEnter={() => canDamage && setHoveredZone('bottom')}
            onMouseLeave={() => setHoveredZone(null)}
            onFocus={() => canDamage && setHoveredZone('bottom')}
            onBlur={() => setHoveredZone(null)}
            onClick={() => onChange(safeCurr + 1)}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '33.333%',
              padding: 0,
              border: 'none',
              background: hoveredZone === 'bottom'
                ? 'rgba(255,255,255,0.5)'
                : 'transparent',
              cursor: canDamage ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 120ms ease',
              zIndex: 2,
            }}
          >
            {hoveredZone === 'bottom' && canDamage && (
              <div style={{ width: iconSize, height: iconSize, color: '#fff' }}>
                <MinusCircle className="w-full h-full" />
              </div>
            )}
          </button>
        </>
      )}
    </div>
  );
};

export default TokenBar;
