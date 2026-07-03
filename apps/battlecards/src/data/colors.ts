/**
 * colors.ts — Color palette data
 *
 * This file defines the full color palette used in BattleCards for display
 * in the Component Gallery. It is NOT imported by components — components
 * use Tailwind utility classes directly (e.g. bg-primary-500, text-danger-600).
 *
 * The data here mirrors what is defined in index.css @theme so the gallery
 * stays in sync with the actual design tokens.
 *
 * STRUCTURE:
 * - RAW_PALETTE:      The 8 base Flowbite color families (built into Tailwind v4)
 * - SEMANTIC_PALETTE: Named role families (primary, danger, etc.) defined in @theme
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ColorShade {
  /** Shade number, e.g. '50', '100', '500', '900' */
  shade: string;
  /** Hex value, e.g. '#3b82f6' — used for inline style on the swatch */
  hex: string;
  /**
   * Whether the label text should be dark (true) or light (false).
   * Light shades need dark text to remain readable; dark shades need light text.
   */
  darkText: boolean;
}

export interface ColorFamily {
  /** Display name, e.g. 'Blue', 'Primary' */
  name: string;
  /** Tailwind class prefix, e.g. 'blue', 'primary' — for displaying class examples */
  prefix: string;
  shades: ColorShade[];
}

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Builds a ColorShade array from a hex map.
 * Shades 50–300 get dark text; 400+ get light text.
 */
const shades = (
  map: Record<string, string>
): ColorShade[] =>
  Object.entries(map).map(([shade, hex]) => ({
    shade,
    hex,
    darkText: ['50', '100', '200', '300'].includes(shade),
  }));

// ── Raw palette ───────────────────────────────────────────────────────────────
// These families are built into Tailwind v4. They do not need to be defined
// in index.css — they are listed here only for gallery display purposes.
// All families run 50–950 for completeness.

export const RAW_PALETTE: ColorFamily[] = [
  {
    // White and black are standalone Tailwind tokens (no shade scale).
    // darkText: true on white so the swatch label stays readable.
    name: 'Base',
    prefix: 'base',
    shades: [
      { shade: 'white', hex: '#ffffff', darkText: true  },
      { shade: 'black', hex: '#000000', darkText: false },
    ],
  },
  {
    name: 'Gray',
    prefix: 'gray',
    shades: shades({
      '50':  '#f9fafb', '100': '#f3f4f6', '200': '#e5e7eb',
      '300': '#d1d5db', '400': '#9ca3af', '500': '#6b7280',
      '600': '#4b5563', '700': '#374151', '800': '#1f2937', '900': '#111827',
      '950': '#030712',
    }),
  },
  {
    name: 'Red',
    prefix: 'red',
    shades: shades({
      '50':  '#fef2f2', '100': '#fee2e2', '200': '#fecaca',
      '300': '#fca5a5', '400': '#f87171', '500': '#ef4444',
      '600': '#dc2626', '700': '#b91c1c', '800': '#991b1b', '900': '#7f1d1d',
      '950': '#450a0a',
    }),
  },
  {
    name: 'Amber',
    prefix: 'amber',
    shades: shades({
      '50':  '#fffbeb', '100': '#fef3c7', '200': '#fde68a',
      '300': '#fcd34d', '400': '#fbbf24', '500': '#f59e0b',
      '600': '#d97706', '700': '#b45309', '800': '#92400e', '900': '#78350f',
      '950': '#431407',
    }),
  },
  {
    name: 'Yellow',
    prefix: 'yellow',
    shades: shades({
      '50':  '#fefce8', '100': '#fef9c3', '200': '#fef08a',
      '300': '#fde047', '400': '#facc15', '500': '#eab308',
      '600': '#ca8a04', '700': '#a16207', '800': '#854d0e', '900': '#713f12',
      '950': '#422006',
    }),
  },
  {
    name: 'Emerald',
    prefix: 'emerald',
    shades: shades({
      '50':  '#ecfdf5', '100': '#d1fae5', '200': '#a7f3d0',
      '300': '#6ee7b7', '400': '#34d399', '500': '#10b981',
      '600': '#059669', '700': '#047857', '800': '#065f46', '900': '#064e3b',
      '950': '#022c22',
    }),
  },
  {
    name: 'Green',
    prefix: 'green',
    shades: shades({
      '50':  '#f0fdf4', '100': '#dcfce7', '200': '#bbf7d0',
      '300': '#86efac', '400': '#4ade80', '500': '#22c55e',
      '600': '#16a34a', '700': '#15803d', '800': '#166534', '900': '#14532d',
      '950': '#052e16',
    }),
  },
  {
    name: 'Teal',
    prefix: 'teal',
    shades: shades({
      '50':  '#f0fdfa', '100': '#ccfbf1', '200': '#99f6e4',
      '300': '#5eead4', '400': '#2dd4bf', '500': '#14b8a6',
      '600': '#0d9488', '700': '#0f766e', '800': '#115e59', '900': '#134e4a',
      '950': '#042f2e',
    }),
  },
  {
    name: 'Blue',
    prefix: 'blue',
    shades: shades({
      '50':  '#eff6ff', '100': '#dbeafe', '200': '#bfdbfe',
      '300': '#93c5fd', '400': '#60a5fa', '500': '#3b82f6',
      '600': '#2563eb', '700': '#1d4ed8', '800': '#1e40af', '900': '#1e3a8a',
      '950': '#172554',
    }),
  },
  {
    name: 'Indigo',
    prefix: 'indigo',
    shades: shades({
      '50':  '#eef2ff', '100': '#e0e7ff', '200': '#c7d2fe',
      '300': '#a5b4fc', '400': '#818cf8', '500': '#6366f1',
      '600': '#4f46e5', '700': '#4338ca', '800': '#3730a3', '900': '#312e81',
      '950': '#1e1b4b',
    }),
  },
  {
    name: 'Violet',
    prefix: 'violet',
    shades: shades({
      '50':  '#f5f3ff', '100': '#ede9fe', '200': '#ddd6fe',
      '300': '#c4b5fd', '400': '#a78bfa', '500': '#8b5cf6',
      '600': '#7c3aed', '700': '#6d28d9', '800': '#5b21b6', '900': '#4c1d95',
      '950': '#2e1065',
    }),
  },
  {
    name: 'Purple',
    prefix: 'purple',
    shades: shades({
      '50':  '#faf5ff', '100': '#f3e8ff', '200': '#e9d5ff',
      '300': '#d8b4fe', '400': '#c084fc', '500': '#a855f7',
      '600': '#9333ea', '700': '#7e22ce', '800': '#6b21a8', '900': '#581c87',
      '950': '#3b0764',
    }),
  },
  {
    name: 'Pink',
    prefix: 'pink',
    shades: shades({
      '50':  '#fdf2f8', '100': '#fce7f3', '200': '#fbcfe8',
      '300': '#f9a8d4', '400': '#f472b6', '500': '#ec4899',
      '600': '#db2777', '700': '#be185d', '800': '#9d174d', '900': '#831843',
      '950': '#500724',
    }),
  },
];

// ── Semantic palette ──────────────────────────────────────────────────────────
// These families ARE defined in index.css @theme. Updating those hex values
// should be reflected here too to keep the gallery accurate.

export const SEMANTIC_PALETTE: ColorFamily[] = [
  {
    name: 'Primary',
    prefix: 'primary',
    shades: shades({
      '50':  '#eff6ff', '100': '#dbeafe', '200': '#bfdbfe',
      '300': '#93c5fd', '400': '#60a5fa', '500': '#3b82f6',
      '600': '#2563eb', '700': '#1d4ed8', '800': '#1e40af', '900': '#1e3a8a',
      '950': '#172554',
    }),
  },
  {
    name: 'Danger',
    prefix: 'danger',
    shades: shades({
      '50':  '#fef2f2', '100': '#fee2e2', '200': '#fecaca',
      '300': '#fca5a5', '400': '#f87171', '500': '#ef4444',
      '600': '#dc2626', '700': '#b91c1c', '800': '#991b1b', '900': '#7f1d1d',
      '950': '#450a0a',
    }),
  },
  {
    name: 'Success',
    prefix: 'success',
    shades: shades({
      '50':  '#ecfdf5', '100': '#d1fae5', '200': '#a7f3d0',
      '300': '#6ee7b7', '400': '#34d399', '500': '#10b981',
      '600': '#059669', '700': '#047857', '800': '#065f46', '900': '#064e3b',
      '950': '#022c22',
    }),
  },
  {
    name: 'Warning',
    prefix: 'warning',
    shades: shades({
      '50':  '#fffbeb', '100': '#fef3c7', '200': '#fde68a',
      '300': '#fcd34d', '400': '#fbbf24', '500': '#f59e0b',
      '600': '#d97706', '700': '#b45309', '800': '#92400e', '900': '#78350f',
      '950': '#431407',
    }),
  },
  {
    name: 'Info',
    prefix: 'info',
    shades: shades({
      '50':  '#eef2ff', '100': '#e0e7ff', '200': '#c7d2fe',
      '300': '#a5b4fc', '400': '#818cf8', '500': '#6366f1',
      '600': '#4f46e5', '700': '#4338ca', '800': '#3730a3', '900': '#312e81',
      '950': '#1e1b4b',
    }),
  },
  {
    name: 'Neutral',
    prefix: 'neutral',
    shades: shades({
      '50':  '#f9fafb', '100': '#f3f4f6', '200': '#e5e7eb',
      '300': '#d1d5db', '400': '#9ca3af', '500': '#6b7280',
      '600': '#4b5563', '700': '#374151', '800': '#1f2937', '900': '#111827',
      '950': '#030712',
    }),
  },
];
