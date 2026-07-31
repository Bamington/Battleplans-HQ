/**
 * EditableListItem.tsx — one row of an editable list, in an editor panel.
 *
 * A box with a header row of controls and whatever fields the list needs
 * inside it. Every editable list in a builder panel is the same shape — a
 * schedule item, a checklist line, an FAQ pair, a prize, a resource — and each
 * had grown its own copy of the border, the padding, the two reorder arrows and
 * the bin. This is the one of them.
 *
 * `header` is a SLOT rather than a numbering scheme, because the lists disagree
 * about what belongs there: the schedule wants an ordinal and a kind picker,
 * the FAQ wants "QUESTION 2", a checklist wants nothing at all. Baking in any
 * one of those would force the other two to fight it.
 *
 * Reorder is two arrow buttons rather than dragging. It is what these editors
 * already used, it works on touch without a gesture library, and it is operable
 * from a keyboard — which a drag handle is not, without a great deal more code.
 *
 * The arrows disable themselves at the ends of the list, so `index` and `count`
 * are both required: an item cannot know it is last without being told how many
 * there are.
 *
 * USAGE:
 *   {items.map((item, i) => (
 *     <EditableListItem
 *       key={item.id}
 *       index={i}
 *       count={items.length}
 *       header={<span>Question {i + 1}</span>}
 *       removeLabel={`Remove question ${i + 1}`}
 *       onMove={delta => move(i, delta)}
 *       onRemove={() => remove(i)}
 *     >
 *       <Input … />
 *     </EditableListItem>
 *   ))}
 */

import type { ReactNode } from 'react';
import AltArrowUp from '../icons/AltArrowUp';
import AltArrowDown from '../icons/AltArrowDown';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';

export interface EditableListItemProps {
  /** Position in the list — decides which reorder arrows are available. */
  index: number;
  /** How many items there are, so the last one knows it is last. */
  count: number;
  /**
   * Left-hand side of the header row. A label, an ordinal, a small picker —
   * whatever this particular list needs to identify the row.
   */
  header?: ReactNode;
  /**
   * Fires with -1 or +1. Omit to hide the reorder arrows entirely, for a list
   * whose order is not the organiser's to set.
   */
  onMove?: (delta: -1 | 1) => void;
  /** Omit to hide the bin, for a row that cannot be removed. */
  onRemove?: () => void;
  /**
   * What the bin announces to a screen reader. Rows look alike, so "Remove"
   * alone leaves a listener with no idea which one they are on.
   */
  removeLabel?: string;
  /** Greys out every control, e.g. while a write is in flight. */
  disabled?: boolean;
  /** The row's fields. */
  children?: ReactNode;
}

const CONTROL =
  'p-1 rounded text-gray-400 hover:text-white disabled:opacity-30 ' +
  'disabled:cursor-not-allowed cursor-pointer transition-colors';

const EditableListItem = ({
  index,
  count,
  header,
  onMove,
  onRemove,
  removeLabel = 'Remove item',
  disabled = false,
  children,
}: EditableListItemProps) => (
  <div className="flex flex-col gap-2 p-2 bg-gray-800/60 border border-gray-700 rounded-lg">
    {/* The header row is always rendered when there is anything to put in it,
        so the controls sit in the same place on every row of every list. */}
    {(header != null || onMove || onRemove) && (
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">{header}</div>

        <div className="flex shrink-0">
          {onMove && (
            <>
              <button
                type="button"
                onClick={() => onMove(-1)}
                disabled={disabled || index === 0}
                aria-label="Move up"
                className={CONTROL}
              >
                <AltArrowUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onMove(1)}
                disabled={disabled || index === count - 1}
                aria-label="Move down"
                className={CONTROL}
              >
                <AltArrowDown className="w-4 h-4" />
              </button>
            </>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              aria-label={removeLabel}
              className={`${CONTROL} hover:text-red-400`}
            >
              <TrashBinMinimalistic className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    )}

    {children}
  </div>
);

export default EditableListItem;
