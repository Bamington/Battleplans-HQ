/**
 * EditSubnav.tsx — Edit-mode sub-navigation bar (tablet / mobile only)
 *
 * Shown below the main Navbar when the Card Builder is in Edit mode, on
 * viewports smaller than `lg`. Contains two toggles:
 *   - Left:  show / hide the Card List panel (unit list)
 *   - Right: show / hide the Editor panel
 *
 * The label and colour of each button reflect the panel's current state:
 *   - Panel OPEN  → "Close <panel>", outline / danger  (red)
 *   - Panel CLOSED → "Open  <panel>", outline / primary (blue)
 *
 * USAGE:
 *   <EditSubnav
 *     cardListOpen={cardListOpen}
 *     onToggleCardList={() => setCardListOpen(o => !o)}
 *     editorOpen={editorOpen}
 *     onToggleEditor={() => setEditorOpen(o => !o)}
 *   />
 */

import Button from './Button';
import Layers from '../icons/Layers';
import Settings from '../icons/Settings';

export interface EditSubnavProps {
  /** Whether the card-list panel is currently open */
  cardListOpen: boolean;
  /** Fires when the user clicks the card-list toggle */
  onToggleCardList: () => void;
  /** Whether the editor panel is currently open */
  editorOpen: boolean;
  /** Fires when the user clicks the editor toggle */
  onToggleEditor: () => void;
  /** Extra Tailwind classes on the outer container */
  className?: string;
}

const EditSubnav = ({
  cardListOpen,
  onToggleCardList,
  editorOpen,
  onToggleEditor,
  className = '',
}: EditSubnavProps) => {
  return (
    <div
      className={[
        'w-full bg-gray-900 border-b border-gray-700 px-3 pt-3 pb-[13px]',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          color={cardListOpen ? 'danger' : 'primary'}
          size="sm"
          leftIcon={<Layers className="w-4 h-4" />}
          onClick={onToggleCardList}
        >
          {cardListOpen ? 'Close' : 'Open'} Card List
        </Button>

        <Button
          variant="outline"
          color={editorOpen ? 'danger' : 'primary'}
          size="sm"
          rightIcon={<Settings className="w-4 h-4" />}
          onClick={onToggleEditor}
        >
          {editorOpen ? 'Close' : 'Open'} Editor
        </Button>
      </div>
    </div>
  );
};

export default EditSubnav;
