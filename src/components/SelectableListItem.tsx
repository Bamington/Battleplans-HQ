/**
 * SelectableListItem.tsx — Compact list row with a leading checkbox
 *
 * A leaner alternative to AddonListItem for picker lists: one fixed-height
 * row showing [checkbox] [name] [optional ⋯ menu]. Used in the
 * AddToPackModal picker; could be reused anywhere a checkbox-driven
 * multi-select list is needed.
 *
 * Matches the Figma "Card / Addon List Item" variant inside the
 * "Add Card to Pack" modal (node 921:13951 et al.) — single-line height,
 * checkbox in the icon slot.
 *
 * USAGE EXAMPLES:
 *   <SelectableListItem
 *     name="BR55 Battle Rifle"
 *     checked={selected.has(id)}
 *     onCheckedChange={c => toggle(id, c)}
 *   />
 *
 *   // With a menu slot
 *   <SelectableListItem
 *     name="Tackle"
 *     checked={false}
 *     onCheckedChange={...}
 *     menu={<Dropdown trigger={<MenuDots />}>...</Dropdown>}
 *   />
 *
 * PROPS:
 *   name             — Row label, rendered in Tanker (heading) font.
 *   checked          — Whether the row is selected.
 *   onCheckedChange  — Called with the new checked value when toggled
 *                      via either the checkbox or the row body.
 *   disabled         — Disables both the checkbox and the row click.
 *   menu             — Optional right-aligned slot (typically a Dropdown
 *                      wrapped MenuDots button). Omit to hide the slot.
 *   className        — Extra Tailwind classes on the outer element.
 */

import React from 'react';
import Checkbox from './Checkbox';

// ── Type definitions ─────────────────────────────────────────────────────────

export interface SelectableListItemProps {
  /** Row label */
  name: string;
  /** Optional second line below the name */
  subtitle?: string;
  /** Source label shown top-right next to the name, e.g. the pack name */
  packLabel?: string;
  /** Whether the row is currently selected */
  checked: boolean;
  /** Called with the new checked value on toggle */
  onCheckedChange: (checked: boolean) => void;
  /** Disables the checkbox and the row click */
  disabled?: boolean;
  /** Optional right-aligned menu slot (e.g. ⋯ dropdown). Omit to hide. */
  menu?: React.ReactNode;
  /** Extra Tailwind classes on the outer element */
  className?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

const SelectableListItem = ({
  name,
  subtitle,
  packLabel,
  checked,
  onCheckedChange,
  disabled = false,
  menu,
  className = '',
}: SelectableListItemProps) => {
  // Row height grows when a subtitle is present so both lines breathe.
  const hasSubtitle = Boolean(subtitle);
  return (
    <div
      className={[
        'group flex items-center gap-2 w-full px-2.5',
        hasSubtitle ? 'min-h-[66px] py-1' : 'h-[50px]',
        'bg-gray-800 rounded-lg shadow-sm transition-colors',
        checked
          ? 'border border-blue-500'
          : 'border border-gray-700 hover:border-gray-500',
        disabled ? 'opacity-50' : '',
        className,
      ].filter(Boolean).join(' ')}
    >

      {/* Checkbox — pointer-events controlled so clicks bubble cleanly. */}
      <Checkbox
        color="primary"
        checked={checked}
        disabled={disabled}
        onChange={e => onCheckedChange(e.target.checked)}
        // Stop the change event from also triggering the row button onClick
        onClick={e => e.stopPropagation()}
      />

      {/* Row body — clicking anywhere here toggles the row. */}
      <button
        type="button"
        onClick={() => !disabled && onCheckedChange(!checked)}
        disabled={disabled}
        className="flex-1 min-w-0 text-left disabled:cursor-not-allowed flex flex-col justify-center"
      >
        <div className="flex items-center gap-2 min-w-0 w-full">
          <p className="flex-1 min-w-0 font-heading text-base leading-6 text-gray-300 group-hover:text-white transition-colors truncate">
            {name}
          </p>
          {packLabel && (
            <span className="shrink-0 font-body text-xs text-gray-500">{packLabel}</span>
          )}
        </div>
        {subtitle && (
          <p className="font-body text-xs leading-4 text-gray-400 truncate">
            {subtitle}
          </p>
        )}
      </button>

      {/* Optional menu slot — render whatever the caller provides. */}
      {menu && (
        <div className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
          {menu}
        </div>
      )}

    </div>
  );
};

export default SelectableListItem;
