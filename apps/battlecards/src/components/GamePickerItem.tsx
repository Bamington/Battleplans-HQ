/**
 * GamePickerItem.tsx — Selectable game tile for the "Create New Deck" modal
 *
 * Displays a game's logo image inside a clickable tile.
 * Supports three visual states: default, hover, and selected.
 * Only one tile should be selected at a time — the parent manages selection.
 *
 * USAGE EXAMPLES:
 *   <GamePickerItem
 *     logoSrc={logoHaloFlashpoint}
 *     logoAlt="Halo: Flashpoint"
 *     selected={selectedGame === 'halo-flashpoint'}
 *     onClick={() => setSelectedGame('halo-flashpoint')}
 *   />
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GamePickerItemProps {
  /** Path or URL for the game's wide logo image. Omit to show logoAlt as text. */
  logoSrc?: string;
  /** Alt text for the logo image */
  logoAlt: string;
  /** Whether this tile is currently selected */
  selected?: boolean;
  /** Called when the tile is clicked */
  onClick?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const GamePickerItem = ({
  logoSrc,
  logoAlt,
  selected = false,
  onClick,
}: GamePickerItemProps) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      'w-full rounded-lg border py-3 transition-colors cursor-pointer',
      selected
        ? 'bg-green-900 border-green-500'
        : 'bg-gray-900 border-gray-700 hover:bg-gray-700 hover:border-gray-500',
    ].join(' ')}
  >
    {logoSrc ? (
      <img
        src={logoSrc}
        alt={logoAlt}
        className="h-[60px] w-full object-contain"
      />
    ) : (
      // No logo asset in the app yet (most games in the shared catalog):
      // show the game name at the same height as a logo.
      <span className="h-[60px] w-full flex items-center justify-center px-4 font-heading text-xl text-white text-center leading-tight">
        {logoAlt}
      </span>
    )}
  </button>
);

export default GamePickerItem;
