/**
 * PickerTile.tsx — one option in a row of mutually exclusive choices.
 *
 * A title and a line explaining what picking it means, in a bordered tile that
 * fills its share of the row. Used where a <Select> would hide the thing that
 * actually decides the answer: "One-Day Tournament" tells you far less on its
 * own than it does next to "Event starts and finishes on the same day."
 *
 * Matches the Figma Picker Tile (node 1069:23434). Selected is primary-950 on
 * primary-700, so it re-themes with each app's accent.
 *
 * Renders as a radio rather than a button — a row of these is one choice, not
 * several independent toggles, and arrow-key navigation between them comes free.
 * Wrap a row in an element with role="radiogroup" and an accessible name.
 *
 * USAGE:
 *   <div role="radiogroup" aria-label="Timeline" className="flex gap-1.5">
 *     <PickerTile
 *       title="One-Day Tournament"
 *       description="Event starts and finishes on the same day."
 *       selected={kind === 'one-day'}
 *       onSelect={() => setKind('one-day')}
 *     />
 *     <PickerTile title="League" description="…" disabled disabledHint="Coming soon" />
 *   </div>
 */

export interface PickerTileProps {
  title: string;
  /** One line on what choosing this means. */
  description?: string;
  selected?: boolean;
  disabled?: boolean;
  /** Tooltip explaining why it is unavailable. Only used when `disabled`. */
  disabledHint?: string;
  onSelect?: () => void;
  className?: string;
}

const PickerTile = ({
  title,
  description,
  selected = false,
  disabled = false,
  disabledHint,
  onSelect,
  className = '',
}: PickerTileProps) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    disabled={disabled}
    title={disabled ? disabledHint : undefined}
    onClick={disabled ? undefined : onSelect}
    className={[
      'flex-1 min-w-0 flex flex-col items-center justify-center gap-2 p-1.5',
      'rounded border text-center transition-colors',
      disabled
        ? 'border-neutral-800 opacity-40 cursor-not-allowed'
        : selected
          ? 'bg-primary-950 border-primary-700 cursor-pointer'
          : 'border-neutral-700 hover:border-neutral-500 cursor-pointer',
      className,
    ].filter(Boolean).join(' ')}
  >
    <span className="w-full flex flex-col gap-1">
      <span className="w-full font-heading text-lg leading-[18px] text-neutral-50 truncate">
        {title}
      </span>
      {description && (
        <span className="w-full font-body text-xs leading-4 text-gray-300">
          {description}
        </span>
      )}
    </span>
  </button>
);

export default PickerTile;
