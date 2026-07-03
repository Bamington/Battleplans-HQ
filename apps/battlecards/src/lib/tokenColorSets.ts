/**
 * tokenColorSets.ts — Named colour palettes for tokens + trackers.
 *
 * `token_definitions.color_set` stores a name (e.g. 'Green', 'Amber') that
 * resolves to a two-state palette here. Used when an SVG asset isn't
 * available — i.e. badge-style tokens (UCTs) and bar-style trackers.
 *
 * Each palette exposes two states:
 *   • active   — used for "on" tokens and the filled portion of a bar.
 *                bg = 700, stroke = 500, text = white.
 *   • inactive — used for "off" tokens and the container/background of a
 *                bar. bg = 950, stroke = 800, text = 800.
 *
 * Hex values come from the Tailwind v4 default palette.
 *
 * To add a new palette: append an entry below. The string name in the DB
 * matches the map key. Case-insensitive at lookup time so 'green' and
 * 'Green' both resolve.
 */

export interface TokenPaletteState {
  /** Background colour for the state. */
  bg:     string;
  /** Border / stroke colour for the state. */
  stroke: string;
  /** Foreground (text) colour for the state. */
  text:   string;
}

export interface TokenPalette {
  active:   TokenPaletteState;
  inactive: TokenPaletteState;
  /** Original colour-set name (canonical-cased), or null when the palette
   *  was derived from a hex `display_color` instead of a `color_set`. */
  name:     string | null;
}

/** Tailwind v4 hex values for shades 500 / 700 / 800 / 950 per palette. */
const SHADES: Record<string, { 500: string; 700: string; 800: string; 950: string }> = {
  Red:    { 500: '#ef4444', 700: '#b91c1c', 800: '#991b1b', 950: '#450a0a' },
  Orange: { 500: '#f97316', 700: '#c2410c', 800: '#9a3412', 950: '#431407' },
  Amber:  { 500: '#f59e0b', 700: '#b45309', 800: '#92400e', 950: '#451a03' },
  Yellow: { 500: '#eab308', 700: '#a16207', 800: '#854d0e', 950: '#422006' },
  Green:  { 500: '#22c55e', 700: '#15803d', 800: '#166534', 950: '#052e16' },
  Teal:   { 500: '#14b8a6', 700: '#0f766e', 800: '#115e59', 950: '#042f2e' },
  Blue:   { 500: '#3b82f6', 700: '#1d4ed8', 800: '#1e40af', 950: '#172554' },
  Purple: { 500: '#a855f7', 700: '#7e22ce', 800: '#6b21a8', 950: '#3b0764' },
  Pink:   { 500: '#ec4899', 700: '#be185d', 800: '#9d174d', 950: '#500724' },
  Slate:  { 500: '#64748b', 700: '#334155', 800: '#1e293b', 950: '#020617' },
};

/** Case-insensitive lookup so the DB string casing doesn't matter. */
const SHADES_BY_LOWER = new Map<string, { name: string; shades: typeof SHADES[string] }>();
for (const [name, shades] of Object.entries(SHADES)) {
  SHADES_BY_LOWER.set(name.toLowerCase(), { name, shades });
}

/** All available palette names — useful for pickers / dropdowns. */
export const COLOR_SET_NAMES: readonly string[] = Object.keys(SHADES);

/** Build the two-state palette for a named color set. Returns null when
 *  the name isn't recognised. */
export const paletteFromColorSet = (name: string | null | undefined): TokenPalette | null => {
  if (!name) return null;
  const hit = SHADES_BY_LOWER.get(name.toLowerCase());
  if (!hit) return null;
  return {
    name: hit.name,
    active: {
      bg:     hit.shades[700],
      stroke: hit.shades[500],
      text:   '#fff',
    },
    inactive: {
      bg:     hit.shades[950],
      stroke: hit.shades[800],
      text:   hit.shades[800],
    },
  };
};

/** Legacy fallback: build a palette from a single hex `display_color`
 *  using CSS color-mix in srgb to derive darker shades. Used when a token
 *  has a display_color but no color_set (e.g. older UCTs). The result is
 *  approximate — exact named-palette values come from `paletteFromColorSet`. */
export const paletteFromHex = (hex: string): TokenPalette => ({
  name: null,
  active: {
    bg:     hex,                                            // ≈ 700-ish
    stroke: `color-mix(in srgb, ${hex} 60%, #fff 40%)`,     // ≈ 500-ish (lighter)
    text:   '#fff',
  },
  inactive: {
    bg:     `color-mix(in srgb, ${hex} 22%, #000 78%)`,     // ≈ 950
    stroke: `color-mix(in srgb, ${hex} 60%, #000 40%)`,     // ≈ 800
    text:   `color-mix(in srgb, ${hex} 60%, #000 40%)`,     // ≈ 800
  },
});

/** Resolve a token row's preferred palette: color_set wins, falls back
 *  to deriving from display_color, returns null if neither is set. */
export const resolveTokenPalette = (def: {
  color_set?:     string | null;
  display_color?: string | null;
}): TokenPalette | null => {
  const named = paletteFromColorSet(def.color_set);
  if (named) return named;
  if (def.display_color) return paletteFromHex(def.display_color);
  return null;
};
