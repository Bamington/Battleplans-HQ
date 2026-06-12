/**
 * DeckListItem.tsx — Deck list row card
 *
 * A compact card representing a single deck. Shows a 64×64 game thumbnail
 * on the left, the deck name + card count in the centre, and a ⋯ menu
 * button on the right. Highlights on hover with a brighter border and text.
 *
 * Clicking ⋯ opens a small dropdown with "Duplicate Deck" and "Delete Deck"
 * actions. Each is shown only when its corresponding handler is provided.
 *
 * Matches the Figma "Card / Deck List Item" component (node 270:2269).
 * Delete tooltip matches Figma node 293:3895.
 *
 * USAGE EXAMPLES:
 *   <DeckListItem
 *     name="Imperial Nobility 11's Team"
 *     cardCount={3}
 *     thumbnailBg="bg-[#15417e]"
 *     thumbnail={<img src={icon} alt="" className="size-full object-cover" />}
 *     onDelete={() => handleDelete(deck.id)}
 *   />
 *
 *   <DeckListItem
 *     name="Space Marines 500pt Crusade List"
 *     cardCount={10}
 *     thumbnailBg="bg-gradient-to-b from-[#141c22] to-[#34566b]"
 *   />
 *
 * PROPS:
 *   name         — Deck name displayed in Tanker (heading) font.
 *   cardCount    — Number of cards in the deck.
 *   thumbnail    — Content for the 64×64 thumbnail slot (img, svg, etc.).
 *                  Omit to show a plain coloured background only.
 *   thumbnailBg  — Tailwind bg class(es) for the thumbnail container.
 *                  Defaults to bg-gray-700.
 *   onDelete     — Called when "Delete Deck" is confirmed from the ⋯ menu.
 *                  Omit to hide the menu button entirely.
 *   className    — Extra Tailwind classes on the outer element.
 */

import React from 'react';
import Dropdown, { DropdownItem } from './Dropdown';
import MenuDots from '../icons/MenuDots';
import Copy from '../icons/Copy';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';

// ── Type definitions ──────────────────────────────────────────────────────────

export interface DeckListItemProps {
  /** Deck name */
  name: string;
  /** Number of cards in the deck */
  cardCount: number;
  /**
   * Content rendered inside the 64×64 thumbnail container.
   * Typically <img src={icon} alt="" className="size-full object-cover" />.
   * Omit to show only the thumbnailBg colour.
   */
  thumbnail?: React.ReactNode;
  /** Tailwind class(es) for the thumbnail background */
  thumbnailBg?: string;
  /** Called when the user clicks the main card area (thumbnail + name) */
  onClick?: () => void;
  /** Called when the user picks "Duplicate Deck" from the ⋯ menu */
  onDuplicate?: () => void;
  /** Called when the user confirms "Delete Deck" from the ⋯ menu */
  onDelete?: () => void;
  /** Extra Tailwind classes on the outer element */
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const DeckListItem = ({
  name,
  cardCount,
  thumbnail,
  thumbnailBg = 'bg-gray-700',
  onClick,
  onDuplicate,
  onDelete,
  className = '',
}: DeckListItemProps) => {
  return (
    <div
      className={[
        // Layout — no overflow-hidden so the Dropdown panel can escape
        'group flex gap-1.5 items-start w-full p-px',
        // Appearance
        'bg-gray-800 border border-gray-700 rounded-lg shadow-sm',
        // Hover: brighter border
        'transition-colors hover:border-gray-500',
        className,
      ].filter(Boolean).join(' ')}
    >
      {/* ── Clickable area: thumbnail + text ──────────────────────────────── */}
      <button
        type="button"
        onClick={onClick}
        className="flex-1 flex gap-1.5 items-start min-w-0 text-left disabled:cursor-default"
        disabled={!onClick}
      >
        {/* Thumbnail */}
        <div
          className={[
            'shrink-0 size-16 overflow-hidden rounded-lg',
            // Slightly muted at rest, full opacity on hover
            'opacity-70 group-hover:opacity-100 transition-opacity',
            thumbnailBg,
          ].join(' ')}
        >
          {thumbnail}
        </div>

        {/* Text content — self-stretch so it matches the thumbnail height */}
        <div className="flex-1 min-w-0 self-stretch flex flex-col justify-center leading-none">
          <p className="font-heading text-[18px] leading-6 text-gray-300 group-hover:text-white transition-colors">
            {name}
          </p>
          <p className="font-body text-base leading-6 text-gray-300 group-hover:text-white transition-colors">
            {cardCount} {cardCount === 1 ? 'Card' : 'Cards'}
          </p>
        </div>
      </button>

      {/* ── Menu dots ─────────────────────────────────────────────────────── */}
      {(onDuplicate || onDelete) && (
        <div className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity self-start">
          <Dropdown
            align="right"
            menuClassName="w-40"
            trigger={
              <button
                type="button"
                aria-label="Deck options"
                className="p-1 flex items-center justify-center text-gray-300 group-hover:text-white"
              >
                <MenuDots className="size-4" />
              </button>
            }
          >
            {onDuplicate && (
              <DropdownItem
                icon={<Copy className="size-4" />}
                onClick={onDuplicate}
              >
                Duplicate Deck
              </DropdownItem>
            )}
            {onDelete && (
              <DropdownItem
                icon={<TrashBinMinimalistic className="size-4" />}
                onClick={onDelete}
                className="!text-red-400 hover:!text-red-300 dark:!text-red-400 dark:hover:!text-red-300"
              >
                Delete Deck
              </DropdownItem>
            )}
          </Dropdown>
        </div>
      )}
    </div>
  );
};

export default DeckListItem;
