/**
 * ShoppingListItem.tsx — One row of the Shopping List column: a tick box to
 * mark it bought, the item's photo (if it has one), its title and the start of
 * its notes. Tapping the row (not the box) opens it for editing.
 *
 * Bought items stay on the list, dimmed and struck through.
 */

import { Checkbox } from '@battleplans/ui';
import { clickableProps } from './ModelItem';
import type { ShoppingItem } from '../hooks/useShoppingList';

const cardHover = ' cursor-pointer hover:border-neutral-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500';

export function ShoppingListItem({ item, onToggle, onClick }: {
  item: ShoppingItem;
  /** Tick on / off. */
  onToggle?: (bought: boolean) => void;
  /** Open the item. */
  onClick?: () => void;
}) {
  return (
    <div
      {...clickableProps(onClick)}
      className={`bg-neutral-800 border border-neutral-700 rounded-lg shadow-md overflow-hidden flex items-center gap-3 px-3 py-2.5${onClick ? cardHover : ''}${item.bought ? ' opacity-60' : ''}`}
    >
      {/* The tick box toggles; it must not also open the item. */}
      <div className="shrink-0 flex items-center" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
        <Checkbox
          color="primary"
          checked={item.bought}
          onChange={e => onToggle?.(e.target.checked)}
          aria-label={item.bought ? `Mark ${item.title} as not bought` : `Mark ${item.title} as bought`}
        />
      </div>

      {item.imageUrl && (
        <img src={item.imageUrl} alt="" className="shrink-0 w-11 h-11 rounded-md object-cover bg-neutral-950 border border-neutral-700" />
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <span className={`font-body text-sm font-medium text-white truncate${item.bought ? ' line-through' : ''}`}>{item.title}</span>
        {item.notes && <span className="font-body text-xs text-neutral-400 line-clamp-1">{item.notes}</span>}
      </div>
    </div>
  );
}
