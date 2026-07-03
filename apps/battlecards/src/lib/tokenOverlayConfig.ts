/**
 * tokenOverlayConfig.ts — Per-game token overlay positioning
 *
 * `TokenOverlay` paints token icons at native card coordinates. Different
 * games have different card layouts, so each game declares its zone
 * positions here. `TokenOverlay` looks the config up by game slug.
 *
 * Coordinate space: the card's NATIVE pixel size (matches the bg.svg
 * canvas — e.g. Halo Flashpoint is 1270×890, Kill Team operatives are
 * 1270×890). Use negative `y` to position above the card edge.
 *
 * Zones:
 *   • other  — single-instance toggles (e.g. Activated, Crouch, Pinned)
 *              laid out left-to-right with `gap` spacing
 *   • shield — multi-instance toggles (e.g. Energy Shield) laid out
 *              left-to-right with `gap` spacing
 *   • damage — stacking counters (e.g. Damage / Wounds) overlapped
 *              by `offset` to form a stack
 */

export interface OverlayZoneConfig {
  other:  { x: number; y: number; gap: number };
  shield: { x: number; y: number; gap: number };
  damage: { x: number; y: number; offset: number };
  /** UCT badges — laid out in a row, wrapping if needed. `gap` is the
   *  horizontal space between badges. */
  badge:  { x: number; y: number; gap: number };
  /** Bars for stat-linked counters (display_style='bar'). One bar per
   *  eligible token.
   *
   *  - `orientation: 'vertical'` (default): each bar is taller than wide;
   *    multiple bars stack left-to-right starting at `x`.
   *  - `orientation: 'horizontal'`: each bar is wider than tall; multiple
   *    bars stack top-to-bottom starting at `y` — used by the mobile
   *    portrait layout where the bars sit beneath the card. */
  bar:    {
    x: number; y: number;
    width: number; height: number;
    gap: number;
    orientation?: 'vertical' | 'horizontal';
  };
}

const HALO_FLASHPOINT: OverlayZoneConfig = {
  other:  { x: 42,  y: -70, gap: 57 },
  shield: { x: 695, y: -70, gap: 57 },
  damage: { x: 935, y: 160, offset: 30 },
  badge:  { x: 42,  y: 740, gap: 16 },
  bar:    { x: 1290, y: 20, width: 80, height: 850, gap: 16 },
};

/** Kill Team operative coordinates. Starting values mirror Halo; tune in
 *  place once we have proper token artwork to align against the card. */
const KILL_TEAM: OverlayZoneConfig = {
  other:  { x: 42,  y: -70, gap: 57 },
  shield: { x: 695, y: -70, gap: 57 },
  damage: { x: 935, y: 160, offset: 30 },
  // Bottom band of the operative card is around y=810; we sit UCT badges
  // just above it so they read as deck-level annotations independent from
  // the built-in tokens.
  badge:  { x: 42,  y: 720, gap: 16 },
  // Bar zone sits to the RIGHT of the card (operative is 1270 wide).
  // First bar starts 20px past the right edge; subsequent bars stack
  // horizontally with `gap` spacing. Height is just shy of card height
  // so the bar reads as a sibling to the card, not part of it.
  bar:    { x: 1290, y: 20, width: 80, height: 850, gap: 16 },
};

/** Kill Team operative coordinates for the mobile portrait layout
 *  (890×1270). Inherits non-bar zones from the desktop config — those
 *  may need their own mobile coordinates later, but only the bar zone is
 *  currently mobile-aware. Bars sit beneath the card as horizontal
 *  strips: 6px inset from each edge, ~80px tall, stacked top-to-bottom
 *  if there's more than one. */
const KILL_TEAM_MOBILE: OverlayZoneConfig = {
  ...KILL_TEAM,
  bar: {
    x: 6, y: 1290,
    width: 878, height: 80,
    gap: 12,
    orientation: 'horizontal',
  },
};

/** RYG warrior card (890×1270 portrait).
 *  Bar and badges both sit BELOW the card so they don't obscure artwork.
 *  Bar: a full-width horizontal life strip at y=1286.
 *  Badges: condition chips in a row at y=1382. */
const RYG: OverlayZoneConfig = {
  other:  { x: 20,   y: -70,  gap: 57 },
  shield: { x: 480,  y: -70,  gap: 57 },
  damage: { x: 710,  y: 160,  offset: 30 },
  badge:  { x: 6,    y: 1382, gap: 10 },
  bar:    { x: 6,    y: 1286, width: 878, height: 80, gap: 12, orientation: 'horizontal' },
};

export const TOKEN_OVERLAY_CONFIG: Record<string, OverlayZoneConfig> = {
  'halo-flashpoint':  HALO_FLASHPOINT,
  'kill-team':        KILL_TEAM,
  'kill-team-mobile': KILL_TEAM_MOBILE,
  'ryg':              RYG,
};

/** Fallback used when a game slug isn't listed — same as Halo's. */
export const DEFAULT_OVERLAY_CONFIG: OverlayZoneConfig = HALO_FLASHPOINT;
