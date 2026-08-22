/**
 * DeckPanelMenu.tsx — ⋯ menu for a builder's left panel header
 *
 * Sits where the edit pencil used to, in the header of the deck's card list.
 * The pencil only ever did one thing; now that a deck can also be shared,
 * the header needs a menu rather than a second icon competing for the space.
 *
 * WHILE EDITING, THIS IS STILL A BUTTON
 * Once the user is in edit mode the affordance's job changes — it's the way
 * out ("Done"). A menu there would bury the exit behind a click, so edit mode
 * keeps the plain tick button the pencil used to turn into.
 *
 * Shared by every card builder, whose edit modes differ slightly (some toggle,
 * some only enter; Ryg calls it reordering), hence editLabel and the caller
 * supplying the handler.
 *
 * USAGE:
 *   <DeckPanelMenu
 *     editMode={editMode}
 *     onToggleEdit={() => editMode ? handleDoneEditing() : setEditMode(true)}
 *     onShare={() => setShareOpen(true)}
 *     editLabel="Edit deck"
 *   />
 */

import { Dropdown, DropdownItem } from '@battleplans/ui';
import { MenuDots, Pen2, CheckCircle, Share } from '@battleplans/ui';

// ── Type definitions ──────────────────────────────────────────────────────────

export interface DeckPanelMenuProps {
  /** True while the deck's card list is in edit/reorder mode. */
  editMode: boolean;
  /** Enters edit mode from the menu, and leaves it from the tick button. */
  onToggleEdit: () => void;
  /** Opens the share sheet. */
  onShare: () => void;
  /** Label for the edit entry — "Edit deck" for most games, "Reorder warriors"
   *  for Ryg. Also used as the tick button's title while editing. */
  editLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const DeckPanelMenu = ({
  editMode,
  onToggleEdit,
  onShare,
  editLabel = 'Edit deck',
}: DeckPanelMenuProps) => {
  if (editMode) {
    return (
      <button
        type="button"
        onClick={onToggleEdit}
        title="Done editing"
        aria-label="Done editing"
        className="p-1 rounded hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
      >
        <CheckCircle className="w-4 h-4 text-green-400" />
      </button>
    );
  }

  return (
    <Dropdown
      align="right"
      menuClassName="w-44"
      trigger={
        <button
          type="button"
          aria-label="Deck options"
          className="p-1 rounded hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
        >
          <MenuDots className="w-4 h-4" />
        </button>
      }
    >
      <DropdownItem icon={<Pen2 className="size-4" />} onClick={onToggleEdit}>
        {editLabel}
      </DropdownItem>
      <DropdownItem icon={<Share className="size-4" />} onClick={onShare}>
        Share
      </DropdownItem>
    </Dropdown>
  );
};

export default DeckPanelMenu;
