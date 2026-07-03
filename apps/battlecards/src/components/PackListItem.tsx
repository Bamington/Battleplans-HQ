/**
 * PackListItem.tsx — Pack list row card
 *
 * A compact card representing a single content pack as seen in the home
 * screen's Packs column. Shows a 64×64 game thumbnail on the left, the
 * pack name + game name centred, and an optional ⋯ menu on the right
 * (with a Delete item when the caller owns or has imported the pack).
 * Below: an HR, a wrap of badges summarising the pack contents
 * (Units / Rules / per-addon-type), a brief description, and an
 * optional CTA button in the bottom-right (caller-supplied label +
 * action — e.g. "Download Pack" for public rows, "Edit Pack" for
 * owned rows).
 *
 * Matches the Figma "Card / Rules Pack" component (node 897:14732).
 *
 * USAGE EXAMPLES:
 *   // Public pack — Download CTA, no menu
 *   <PackListItem
 *     name="Black Orc Player Cards"
 *     gameName="Blood Bowl"
 *     thumbnailBg="bg-[#15417e]"
 *     thumbnail={<img src={iconBloodBowl} alt="" className="size-full object-cover" />}
 *     badges={[...]}
 *     description="..."
 *     cta={{ label: 'Download Pack', icon: <AddCircle className="size-4" />, onClick: () => importPack(pack.id) }}
 *   />
 *
 *   // Owned pack — menu with Delete + Edit CTA
 *   <PackListItem
 *     name="My Custom Pack"
 *     gameName="Halo: Flashpoint"
 *     onDelete={() => confirmDelete(pack)}
 *     deleteLabel="Delete Pack"
 *     cta={{ label: 'Edit Pack', icon: <Pen2 className="size-4" />, onClick: () => navigate(`/app/packs/${pack.id}/edit`) }}
 *   />
 *
 * PROPS:
 *   name         — Pack title displayed in Tanker (heading) font.
 *   gameName     — Game name displayed small under the title.
 *   thumbnail    — Content for the 64×64 thumbnail (typically an <img>).
 *   thumbnailBg  — Tailwind bg class for the thumbnail container.
 *   badges       — Content summary badges (Units / Rules / per type).
 *   description  — Author-written blurb.
 *   cta          — Bottom-right action button. Omit to hide entirely.
 *                  { label, icon?, onClick }
 *   onDelete     — When provided, renders the ⋯ menu in the header
 *                  top-right with a Delete item. Use on rows the user
 *                  owns or has imported.
 *   deleteLabel  — Label for the Delete menu item, e.g. "Delete Pack"
 *                  or "Uninstall Pack". Defaults to "Delete Pack".
 *   className    — Extra Tailwind classes on the outer element.
 */

import React from 'react';
import Badge from './Badge';
import Button from './Button';
import Dropdown, { DropdownItem } from './Dropdown';
import MenuDots from '@battleplans/ui';
import TrashBinMinimalistic from '@battleplans/ui';

// ── Type definitions ──────────────────────────────────────────────────────────

export interface PackBadge {
  /** Label text, e.g. "8 Units", "14 Skills". */
  label: string;
  /** Optional icon node. Size the icon to size-3.5 (14×14) so it fits
   *  the Badge component's icon slot without overflow. */
  icon?: React.ReactNode;
}

export interface PackListItemProps {
  /** Pack title */
  name: string;
  /** Game name displayed under the title */
  gameName: string;
  /**
   * Content rendered inside the 64×64 thumbnail container.
   * Typically <img src={icon} alt="" className="size-full object-cover" />.
   * Omit to show only the thumbnailBg colour.
   */
  thumbnail?: React.ReactNode;
  /** Tailwind class(es) for the thumbnail background */
  thumbnailBg?: string;
  /** Content summary badges (Units, Rules, per-addon-type) */
  badges?: PackBadge[];
  /** Author-written description */
  description?: string;
  /** Bottom-right CTA button. Omit to hide the CTA entirely. */
  cta?: {
    label:    string;
    icon?:    React.ReactNode;
    onClick:  () => void;
  };
  /** When provided, renders the ⋯ menu in the header with a Delete item. */
  onDelete?: () => void;
  /** Override the Delete menu item's label. Defaults to "Delete Pack". */
  deleteLabel?: string;
  /** When true, renders a green "Official" pill above the pack title */
  official?: boolean;
  /** Extra Tailwind classes on the outer element */
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const PackListItem = ({
  name,
  gameName,
  thumbnail,
  thumbnailBg = 'bg-gray-700',
  badges      = [],
  description,
  cta,
  onDelete,
  deleteLabel = 'Delete Pack',
  official    = false,
  className   = '',
}: PackListItemProps) => {
  return (
    <div
      className={[
        // Layout
        'flex flex-col gap-1.5 w-full p-[13px]',
        // Appearance — matches Figma Card / Rules Pack
        'bg-gray-800 border border-gray-700 rounded-lg shadow-sm',
        className,
      ].filter(Boolean).join(' ')}
    >

      {/* ── Top row: thumbnail + title + optional ⋯ menu ───────────────── */}
      <div className="flex gap-1.5 items-start w-full">

        {/* Thumbnail */}
        <div
          className={[
            'shrink-0 size-16 overflow-hidden rounded',
            thumbnailBg,
          ].join(' ')}
        >
          {thumbnail}
        </div>

        {/* Title + game name */}
        <div className="flex-1 min-w-0 flex flex-col self-stretch justify-center">
          {official && (
            <span className="inline-flex self-start items-center px-2 py-0.5 mb-1 rounded-full text-[11px] font-semibold font-body bg-green-600 text-white leading-none">
              Official
            </span>
          )}
          <p className="font-heading text-[18px] leading-6 text-white truncate">
            {name}
          </p>
          <p className="font-body font-bold text-sm leading-5 text-gray-300 opacity-50 truncate">
            {gameName}
          </p>
        </div>

        {/* ⋯ menu — only when the caller has a delete action to expose
            (i.e. own + imported packs). Public browse rows omit this and
            rely on the Download CTA at the bottom instead.
            Wrapper stops clicks bubbling up so a parent <Link> (used on
            Your Packs rows for navigate-to-editor) doesn't fire when the
            user opens or interacts with the menu. */}
        {onDelete && (
          <div
            className="shrink-0"
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          >
            <Dropdown
              align="right"
              menuClassName="w-44"
              trigger={
                <button
                  type="button"
                  aria-label={`${name} options`}
                  className="p-1 opacity-50 hover:opacity-100 transition-opacity text-gray-300 hover:text-white"
                >
                  <MenuDots className="size-4" />
                </button>
              }
            >
              <DropdownItem
                icon={<TrashBinMinimalistic className="size-4" />}
                onClick={onDelete}
                className="!text-red-400 hover:!text-red-300 dark:!text-red-400 dark:hover:!text-red-300"
              >
                {deleteLabel}
              </DropdownItem>
            </Dropdown>
          </div>
        )}

      </div>

      {/* ── Divider ───────────────────────────────────────────────────── */}
      {/* Plain <hr> rather than the HR component — the latter ships with
          my-8, which is way too much spacing for this card. Outer card's
          gap-1.5 controls the breathing room here. */}
      {(badges.length > 0 || description) && (
        <hr className="border-0 h-px bg-gray-700 m-0 w-full" />
      )}

      {/* ── Badge row ─────────────────────────────────────────────────── */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {badges.map((b, i) => (
            <Badge
              key={`${b.label}-${i}`}
              variant="solid"
              color="primary"
              size="lg"
              icon={b.icon}
            >
              {b.label}
            </Badge>
          ))}
        </div>
      )}

      {/* ── Description ───────────────────────────────────────────────── */}
      {description && (
        <p className="font-body text-base leading-6 text-white">
          {description}
        </p>
      )}

      {/* ── CTA button ─────────────────────────────────────────────────
          Bottom-right, caller decides the label + action. Examples:
            - Public browse row    → "Download Pack"
            - Owned pack row       → "Edit Pack"
            - Imported pack row    → cta omitted (menu only) */}
      {cta && (
        <div className="flex justify-end w-full pt-1">
          <Button
            variant="outline"
            color="primary"
            size="sm"
            leftIcon={cta.icon}
            onClick={cta.onClick}
          >
            {cta.label}
          </Button>
        </div>
      )}

    </div>
  );
};

export default PackListItem;
