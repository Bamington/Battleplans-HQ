/**
 * CategoryListItem.tsx — one row in the editor's left-hand category nav.
 *
 * Icon, label, a status line, and a completion badge. Selecting a row is what
 * drives the whole editor: the centre tab switches if it needs to, the document
 * scrolls to that section, and the right panel swaps to that category's form.
 *
 * Matches the Figma "Event Item" component (node 1069:22367). The selected
 * state there is primary/950 on primary/800, which resolves green in this app
 * and blue in the BattleCards file the artboard was duplicated from — so the
 * tokens are used rather than the hexes the export produced.
 *
 * BattleCards' <UnitListEntry> is the nearest existing thing and was considered
 * for reuse, but it carries unit-specific machinery (portrait avatar, copy and
 * delete actions, a three-state blank/pending/complete build status) that a
 * category row has no use for. Sharing it would have meant bending both.
 *
 * USAGE:
 *   <CategoryListItem
 *     icon={<FileText className="w-6 h-6" />}
 *     label="Event Basics"
 *     complete
 *     active
 *     onSelect={() => setActive('event-basics')}
 *     onRemove={() => hide('event-basics')}
 *   />
 */

import type { ReactNode } from 'react';
import { CheckCircle, DangerCircle, CloseCircle } from '@battleplans/ui';

export interface CategoryListItemProps {
  /** 24px category icon from the registry. */
  icon: ReactNode;
  /** Category label, e.g. "Event Basics". */
  label: string;
  /** Whether every required field in this category is filled in. */
  complete?: boolean;
  /** Whether this is the category currently being edited. */
  active?: boolean;
  /**
   * Mandatory categories cannot be removed from a pack — that is the whole
   * point of the tier, and it is what stops a half-filled category being hidden
   * out of the publish check. Omit `onRemove` for those and no × is rendered.
   */
  onRemove?: () => void;
  onSelect?: () => void;
}

const CategoryListItem = ({
  icon,
  label,
  complete = false,
  active = false,
  onRemove,
  onSelect,
}: CategoryListItemProps) => {
  return (
    <div
      className={[
        'group w-full flex items-center gap-[9px] px-1.5 py-1 rounded border transition-colors',
        active
          ? 'bg-primary-950 border-primary-800'
          : 'bg-transparent border-transparent hover:bg-gray-800',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        className="flex-1 min-w-0 flex items-center gap-[9px] text-left cursor-pointer"
      >
        <span className={`shrink-0 ${active ? 'text-primary-400' : 'text-gray-400'}`}>
          {icon}
        </span>

        <span className="flex-1 min-w-0 flex flex-col justify-center">
          <span className="font-body font-medium text-base leading-6 text-gray-50 truncate">
            {label}
          </span>
          <span
            className={[
              'font-body font-bold text-xs leading-4 tracking-[1.2px] uppercase truncate',
              complete ? 'text-gray-200' : 'text-gray-500',
            ].join(' ')}
          >
            {complete ? 'Complete' : 'Incomplete'}
          </span>
        </span>

        <span className={`shrink-0 ${complete ? 'text-primary-500' : 'text-gray-600'}`}>
          {complete
            ? <CheckCircle className="w-4 h-4" />
            : <DangerCircle className="w-4 h-4" />}
        </span>
      </button>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title={`Remove ${label}`}
          aria-label={`Remove ${label}`}
          /* Only revealed on hover/focus: removing is rare next to selecting,
             and a permanent × on every row reads as the primary action. */
          className="shrink-0 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
        >
          <CloseCircle className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default CategoryListItem;
