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
}

const HALO_FLASHPOINT: OverlayZoneConfig = {
  other:  { x: 42,  y: -70, gap: 57 },
  shield: { x: 695, y: -70, gap: 57 },
  damage: { x: 935, y: 160, offset: 30 },
  badge:  { x: 42,  y: 740, gap: 16 },
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
};

export const TOKEN_OVERLAY_CONFIG: Record<string, OverlayZoneConfig> = {
  'halo-flashpoint': HALO_FLASHPOINT,
  'kill-team':       KILL_TEAM,
};

/** Fallback used when a game slug isn't listed — same as Halo's. */
export const DEFAULT_OVERLAY_CONFIG: OverlayZoneConfig = HALO_FLASHPOINT;
