/**
 * AddonListItem.tsx — Addon row in the Add Addon picker list
 *
 * Displays an addon's name and a one-line summary subtitle.
 * Clicking the row selects it (highlighted blue border).
 * The ⋯ menu gives access to Edit and Delete actions.
 *
 * Matches Figma "Card / Addon List Item" (node 293:3504).
 *
 * USAGE:
 *   <AddonListItem
 *     name="BR55 Battle Rifle"
 *     subtitle="Ranged, R5, AP 1, Optics"
 *     selected={selectedId === addon.id}
 *     onSelect={() => setSelectedId(addon.id)}
 *     onEdit={() => openEditForm(addon)}
 *     onDelete={() => handleDelete(addon.id)}
 *     addonTypeName="Weapon"
 *   />
 */

import { Dropdown, DropdownItem } from '@battleplans/ui';
import { MenuDots } from '@battleplans/ui';
import { TrashBinMinimalistic } from '@battleplans/ui';
import { Pen2 } from '@battleplans/ui';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AddonListItemProps {
  name: string;
  /** One-line summary shown below the name — truncated if too long */
  subtitle: string;
  /** Source label shown top-right, e.g. the pack name */
  packLabel?: string;
  /** Whether this item is currently selected in the picker */
  selected?: boolean;
  /** Called when the row body is clicked */
  onSelect?: () => void;
  /** Called when "Edit" is chosen from the ⋯ menu */
  onEdit?: () => void;
  /** Called when "Delete" is chosen from the ⋯ menu */
  onDelete?: () => void;
  /** Used to label the menu actions — e.g. "Weapon" → "Edit Weapon" */
  addonTypeName?: string;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const AddonListItem = ({
  name,
  subtitle,
  packLabel,
  selected = false,
  onSelect,
  onEdit,
  onDelete,
  addonTypeName = 'Addon',
  className = '',
}: AddonListItemProps) => {
  return (
    <div
      className={[
        // Layout — no overflow-hidden so the Dropdown panel can escape
        'group flex gap-1.5 items-start w-full px-[7px] py-px h-[66px]',
        'bg-gray-800 rounded-lg shadow-sm',
        selected
          ? 'border border-blue-500'
          : 'border border-gray-700 hover:border-gray-500',
        'transition-colors',
        className,
      ].filter(Boolean).join(' ')}
    >
      {/* Selectable body */}
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 flex flex-col justify-center min-w-0 h-full text-left leading-none"
        disabled={!onSelect}
      >
        <div className="flex items-center gap-2 min-w-0 w-full">
          <p className="flex-1 min-w-0 font-heading text-[18px] leading-6 text-gray-300 group-hover:text-white transition-colors truncate">
            {name}
          </p>
          {packLabel && (
            <span className="shrink-0 font-body text-xs text-gray-500">{packLabel}</span>
          )}
        </div>
        <p className="font-body text-[12px] leading-4 text-gray-400 truncate w-full">
          {subtitle}
        </p>
      </button>

      {/* ⋯ menu — only shown when at least one action is provided */}
      {(onEdit || onDelete) && (
        <div className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity self-start pt-[5px]">
          <Dropdown
            align="right"
            menuClassName="w-36"
            trigger={
              <button
                type="button"
                aria-label={`${addonTypeName} options`}
                className="p-1 flex items-center justify-center text-gray-300 hover:text-white"
              >
                <MenuDots className="size-4" />
              </button>
            }
          >
            {onEdit && (
              <DropdownItem icon={<Pen2 className="size-4" />} onClick={onEdit}>
                Edit {addonTypeName}
              </DropdownItem>
            )}
            {onDelete && (
              <DropdownItem
                icon={<TrashBinMinimalistic className="size-4" />}
                onClick={onDelete}
                className="!text-red-400 hover:!text-red-300 dark:!text-red-400 dark:hover:!text-red-300"
              >
                Delete {addonTypeName}
              </DropdownItem>
            )}
          </Dropdown>
        </div>
      )}
    </div>
  );
};

export default AddonListItem;
