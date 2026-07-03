/**
 * AttachedAddonRow.tsx — Compact row for an addon attached to a card.
 *
 * Used in the right-panel editor's "Weapons" / "Skills" / "Abilities" lists
 * to show what's already attached, with a click-to-view affordance and a
 * × button that detaches the addon from the card (without deleting the
 * library row).
 *
 * Design extracted from the inline JSX in CardBuilderHaloFlashpoint so
 * Halo, Starcraft, and any future game can share the same look.
 *
 * USAGE:
 *   <AttachedAddonRow
 *     name="Spartan Fists"
 *     subtitle="Close Combat, AP 0"
 *     onClick={() => openViewer(weapon)}
 *     onRemove={() => detachWeapon(weapon.id)}
 *   />
 */

import CloseCircle from '../icons/CloseCircle';

export interface AttachedAddonRowProps {
  /** Primary label (e.g. weapon or ability name). */
  name:     string;
  /** Compact summary line shown beneath the name. */
  subtitle: string;
  /**
   * Optional row click handler — typically opens a viewer / edit modal.
   * When omitted, the row is not interactive (no cursor pointer, no hover).
   */
  onClick?: () => void;
  /** Called when the × button is clicked. Required. */
  onRemove: () => void;
  /** Custom aria-label for the remove button. Default: `Remove ${name}`. */
  removeAriaLabel?: string;
}

const AttachedAddonRow = ({
  name,
  subtitle,
  onClick,
  onRemove,
  removeAriaLabel,
}: AttachedAddonRowProps) => (
  <div
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onClick={onClick}
    onKeyDown={onClick ? (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    } : undefined}
    className={[
      'flex items-center gap-2 px-3 py-2',
      'bg-gray-800 border border-gray-700 rounded-lg',
      'transition-colors',
      onClick ? 'cursor-pointer hover:border-gray-500' : '',
    ].join(' ')}
  >
    <div className="flex-1 min-w-0">
      <p className="font-body text-sm font-medium text-gray-200 truncate">
        {name}
      </p>
      {subtitle && (
        <p className="font-body text-xs text-gray-500 truncate">
          {subtitle}
        </p>
      )}
    </div>
    <button
      type="button"
      aria-label={removeAriaLabel ?? `Remove ${name}`}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"
    >
      <CloseCircle className="size-4" />
    </button>
  </div>
);

export default AttachedAddonRow;
