/**
 * DeckCardList.tsx — shared deck card-list body
 *
 * The scrollable list of cards inside `CardListPanel`, shared by every game so
 * units and rules render and group identically. Kill Team is the reference:
 *
 *   • Edit / non-play  — a single flat list in deck order. Rules are just
 *     entries with `kind: 'rule'`; there is no separate "rules block".
 *   • Play mode        — three groups: non-activated units, an "Activated"
 *     sub-section (only when populated), then a "Rules" sub-section pinned to
 *     the bottom (only when there are rules).
 *
 * Each game maps its own data into a flat, ordered `DeckListEntry[]` and passes
 * the callbacks it supports. Rows are drawn with the shared `UnitListEntry`.
 * Edit-mode affordances are opt-in per game via the callbacks:
 *   • a drag handle appears when an entry has a `dragIndex` (drag callbacks wired),
 *   • an external duplicate button appears when `onDuplicate` is given,
 *   • an external delete button appears when `onDelete` is given.
 */

import React from 'react';
import { HamburgerMenu, TrashBinMinimalistic, Copy } from '@battleplans/ui';
import UnitListEntry, { type UnitStatus } from './UnitListEntry';

export interface DeckListEntry {
  /** Stable card/rule id — also the selection key. */
  id: string;
  /** 'unit' cards group/activate; 'rule' cards pin to the bottom in play mode. */
  kind: 'unit' | 'rule';
  status: UnitStatus;
  /** Primary label. */
  name?: string;
  /** Secondary label (role / faction / "Faction Rule"). */
  type?: string;
  /** Optional leading number badge (e.g. a jersey number). */
  number?: string;
  /** Tertiary label — comma-separated addon/weapon preview. */
  addonSummary?: string;
  /** Portrait / game-icon URL. */
  avatarSrc?: string;
  /** Play-mode: this unit has all its activation tokens on. */
  activated?: boolean;
  /** Index into the parent's draggable collection. When set (and in edit
   *  mode) the row shows a drag handle and wires the drag callbacks. */
  dragIndex?: number;
  /** Disables this row's delete button (e.g. the last remaining card). */
  deleteDisabled?: boolean;
}

export interface DeckCardListProps {
  /** All entries, already in deck order. */
  entries: DeckListEntry[];
  /** Currently-selected entry id. */
  activeId: string;
  /** Edit mode — shows drag handles + duplicate/delete buttons. */
  editMode: boolean;
  /** Play mode — switches from the flat list to the grouped layout. */
  playMode: boolean;
  /** Called when a row is clicked. */
  onSelect: (id: string) => void;
  /** Called when a row's delete button is clicked (edit mode). */
  onDelete?: (id: string) => void;
  /** Called when a row's duplicate button is clicked (edit mode). */
  onDuplicate?: (id: string) => void;
  /** Drag reorder plumbing (edit mode; entries with a `dragIndex`). */
  dragOverIndex?: number | null;
  onDragStart?: (index: number) => void;
  onDragOver?: (e: React.DragEvent, index: number) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  /** Section labels (defaults match Kill Team). */
  activatedLabel?: string;
  rulesLabel?: string;
}

const SectionHeader = ({ label }: { label: string }) => (
  <h3 className="flex items-center gap-2 px-1 pt-3 pb-1 text-xs font-body font-bold text-gray-500 uppercase tracking-[1.2px]">
    <span>{label}</span>
    <span className="flex-1 h-px bg-gray-700" />
  </h3>
);

const DeckCardList = ({
  entries,
  activeId,
  editMode,
  playMode,
  onSelect,
  onDelete,
  onDuplicate,
  dragOverIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  activatedLabel = 'Activated',
  rulesLabel = 'Rules',
}: DeckCardListProps) => {
  const renderRow = (entry: DeckListEntry) => {
    const canDrag = editMode && entry.dragIndex != null;
    return (
      <div
        key={entry.id}
        className={`flex items-center gap-1 ${
          canDrag && dragOverIndex === entry.dragIndex
            ? 'border-t-2 border-blue-500'
            : 'border-t-2 border-transparent'
        }`}
        onDragOver={canDrag ? (e) => onDragOver?.(e, entry.dragIndex!) : undefined}
        onDrop={canDrag ? onDrop : undefined}
      >
        {canDrag && (
          <div
            draggable
            onDragStart={() => onDragStart?.(entry.dragIndex!)}
            onDragEnd={onDragEnd}
            className="shrink-0 cursor-grab active:cursor-grabbing p-0.5 text-gray-500 hover:text-gray-300"
          >
            <HamburgerMenu className="w-4 h-4" />
          </div>
        )}

        <div className={editMode ? 'flex-1 min-w-0' : 'w-full'}>
          <UnitListEntry
            status={entry.status}
            unitName={entry.name}
            unitType={entry.type}
            number={entry.number}
            addonSummary={entry.addonSummary}
            avatarSrc={entry.avatarSrc}
            active={entry.id === activeId}
            activated={playMode && !!entry.activated}
            onClick={() => onSelect(entry.id)}
          />
        </div>

        {editMode && onDuplicate && (
          <button
            type="button"
            aria-label={`Duplicate ${entry.name || 'card'}`}
            onClick={(e) => { e.stopPropagation(); onDuplicate(entry.id); }}
            className="shrink-0 p-1 rounded text-blue-400 hover:text-blue-300 transition-colors"
            title="Duplicate card"
          >
            <Copy className="w-4 h-4" />
          </button>
        )}

        {editMode && onDelete && (
          <button
            type="button"
            aria-label={`Delete ${entry.name || 'card'}`}
            onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
            disabled={entry.deleteDisabled}
            className="shrink-0 p-1 rounded text-gray-500 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={entry.deleteDisabled ? 'At least one card is required' : 'Delete card'}
          >
            <TrashBinMinimalistic className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  // Edit / non-play: a single flat list in deck order.
  if (!playMode) {
    return <>{entries.map(renderRow)}</>;
  }

  // Play mode: non-activated units, then Activated (when populated), then Rules.
  const nonActivated: DeckListEntry[] = [];
  const activated: DeckListEntry[] = [];
  const rules: DeckListEntry[] = [];
  for (const e of entries) {
    if (e.kind === 'rule') rules.push(e);
    else if (e.activated) activated.push(e);
    else nonActivated.push(e);
  }

  return (
    <>
      {nonActivated.map(renderRow)}

      {activated.length > 0 && (
        <>
          <SectionHeader label={activatedLabel} />
          {activated.map(renderRow)}
        </>
      )}

      {rules.length > 0 && (
        <>
          <SectionHeader label={rulesLabel} />
          {rules.map(renderRow)}
        </>
      )}
    </>
  );
};

export default DeckCardList;
