/**
 * CardListPanel.tsx — Left-aside chrome for the card-builder shell.
 *
 * Provides the parts of the unit/card list that are identical across every
 * builder:
 *   - Header row with the inline-editable deck name (double-click to rename,
 *     Enter to commit, Escape to cancel) and an optional right-side action
 *     slot for game-specific buttons (e.g. Halo's edit-mode toggle).
 *   - A scrollable body for the card list itself — the game owns the actual
 *     <UnitListEntry> elements and their drag-reorder behaviour.
 *   - A pinned footer for "Add Unit" / "Add Rule" / "Done" buttons.
 *
 * Designed to be rendered as the `leftPanel` slot of <BuilderShell> — that
 * component supplies the surrounding `<aside>` with its responsive show/hide
 * and order classes, so this component only renders the inner column.
 *
 * The deck-name editing state lives in `useCardBuilder`; pass the relevant
 * fields straight through.
 *
 * USAGE:
 *   <CardListPanel
 *     deckName={builder.deckName}
 *     editingDeckName={builder.editingDeckName}
 *     inputRef={builder.deckNameInputRef}
 *     onStartEdit={builder.startDeckNameEdit}
 *     onCommit={(n) => builder.commitDeckName(n, { persist: !editMode })}
 *     onCancelEdit={() => builder.setEditingDeckName(false)}
 *     headerAction={<button>...</button>}
 *     footer={<Button>Add Unit</Button>}
 *   >
 *     {cards.map(c => <UnitListEntry key={c.id} {...} />)}
 *   </CardListPanel>
 */

import type { ReactNode, RefObject } from 'react';

export interface CardListPanelProps {
  /** Current deck name, or null while loading. Rendered with an em-dash fallback. */
  deckName: string | null;
  /** Whether the deck name is currently in inline-edit mode. */
  editingDeckName: boolean;
  /** Ref forwarded to the rename <input> so callers can focus / select on edit start. */
  inputRef: RefObject<HTMLInputElement | null>;
  /** Fires on double-click of the deck name (or however the caller decides to trigger edit). */
  onStartEdit: () => void;
  /** Fires on Enter or blur with the new name. The caller decides whether to persist. */
  onCommit: (newName: string) => void | Promise<void>;
  /** Fires on Escape — caller should drop edit mode without saving. */
  onCancelEdit: () => void;

  /** Optional right-aligned button or icon group in the header (e.g. edit-mode toggle). */
  headerAction?: ReactNode;
  /** Optional second line below the deck name (e.g. points total, saving badge). */
  headerSubtitle?: ReactNode;
  /** Pinned-bottom region for "Add Unit" / "Done" / etc. buttons. */
  footer?: ReactNode;
  /** The card list itself — typically a <nav> of <UnitListEntry> rows. */
  children?: ReactNode;
}

const CardListPanel = ({
  deckName,
  editingDeckName,
  inputRef,
  onStartEdit,
  onCommit,
  onCancelEdit,
  headerAction,
  headerSubtitle,
  footer,
  children,
}: CardListPanelProps) => {
  return (
    <>
      {/* Header — deck name (+ optional subtitle row) on the left, action on the right. */}
      <div className="px-4 py-4 border-b border-gray-700 shrink-0 flex items-start gap-2">
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          {editingDeckName ? (
            <input
              ref={inputRef}
              type="text"
              defaultValue={deckName ?? ''}
              className="bg-gray-800 border border-gray-600 rounded px-2 py-0.5
                         font-heading text-sm font-bold text-white uppercase tracking-wide
                         outline-none focus:border-blue-500"
              onBlur={e => onCommit(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter')  onCommit(e.currentTarget.value);
                if (e.key === 'Escape') onCancelEdit();
              }}
            />
          ) : (
            <p
              className="font-heading text-sm font-bold text-white uppercase tracking-wide truncate cursor-pointer"
              onDoubleClick={onStartEdit}
              title="Double-click to rename"
            >
              {deckName ?? '—'}
            </p>
          )}
          {headerSubtitle != null && headerSubtitle}
        </div>
        {headerAction != null && (
          <div className="shrink-0">{headerAction}</div>
        )}
      </div>

      {/* Body — scrollable card list */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {children}
      </nav>

      {/* Footer */}
      {footer != null && (
        <div className="px-3 pb-3 shrink-0 flex flex-col gap-3">
          {footer}
        </div>
      )}
    </>
  );
};

export default CardListPanel;
