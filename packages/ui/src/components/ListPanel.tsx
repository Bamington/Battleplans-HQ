/**
 * ListPanel.tsx — Left-aside chrome for the builder shell.
 *
 * Provides the parts of the left-hand list that are identical across every
 * builder:
 *   - Header row with an inline-editable title (double-click to rename, Enter
 *     to commit, Escape to cancel) and an optional right-side action slot for
 *     page-specific buttons (e.g. Halo's edit-mode toggle).
 *   - A scrollable body for the list itself — the page owns the actual rows and
 *     their drag-reorder behaviour.
 *   - A pinned footer for "Add Unit" / "Add Category" / "Done" buttons.
 *
 * Designed to be rendered as the `leftPanel` slot of <BuilderShell> — that
 * component supplies the surrounding `<aside>` with its responsive show/hide
 * and order classes, so this component only renders the inner column.
 *
 * The title is deliberately generic: it's a deck in BattleCards and a pack in
 * BattlePack, and the panel never needs to know which. In BattleCards the
 * editing state lives in `useCardBuilder` — pass the relevant fields straight
 * through.
 *
 * USAGE:
 *   <ListPanel
 *     title={builder.deckName}
 *     editingTitle={builder.editingDeckName}
 *     inputRef={builder.deckNameInputRef}
 *     onStartEdit={builder.startDeckNameEdit}
 *     onCommit={(n) => builder.commitDeckName(n, { persist: !editMode })}
 *     onCancelEdit={() => builder.setEditingDeckName(false)}
 *     headerAction={<button>...</button>}
 *     footer={<Button>Add Unit</Button>}
 *   >
 *     {cards.map(c => <UnitListEntry key={c.id} {...} />)}
 *   </ListPanel>
 */

import type { ReactNode, RefObject } from 'react';

export interface ListPanelProps {
  /** Current title — the deck or pack name. Null while loading; rendered with an em-dash fallback. */
  title: string | null;
  /** Whether the title is currently in inline-edit mode. */
  editingTitle: boolean;
  /** Ref forwarded to the rename <input> so callers can focus / select on edit start. */
  inputRef: RefObject<HTMLInputElement | null>;
  /** Fires on double-click of the title (or however the caller decides to trigger edit). */
  onStartEdit: () => void;
  /** Fires on Enter or blur with the new title. The caller decides whether to persist. */
  onCommit: (newTitle: string) => void | Promise<void>;
  /** Fires on Escape — caller should drop edit mode without saving. */
  onCancelEdit: () => void;

  /** Optional right-aligned button or icon group in the header (e.g. edit-mode toggle). */
  headerAction?: ReactNode;
  /** Optional second line below the title (e.g. points total, saving badge). */
  headerSubtitle?: ReactNode;
  /** Pinned-bottom region for "Add Unit" / "Done" / etc. buttons. */
  footer?: ReactNode;
  /** The list itself — typically a <nav> of row components. */
  children?: ReactNode;
}

const ListPanel = ({
  title,
  editingTitle,
  inputRef,
  onStartEdit,
  onCommit,
  onCancelEdit,
  headerAction,
  headerSubtitle,
  footer,
  children,
}: ListPanelProps) => {
  return (
    <>
      {/* Header — title (+ optional subtitle row) on the left, action on the right. */}
      <div className="px-4 py-4 border-b border-gray-700 shrink-0 flex items-start gap-2">
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          {editingTitle ? (
            <input
              ref={inputRef}
              type="text"
              defaultValue={title ?? ''}
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
              {title ?? '—'}
            </p>
          )}
          {headerSubtitle != null && headerSubtitle}
        </div>
        {headerAction != null && (
          <div className="shrink-0">{headerAction}</div>
        )}
      </div>

      {/* Body — scrollable list */}
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

export default ListPanel;
