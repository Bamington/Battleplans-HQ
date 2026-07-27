/**
 * BattlepackListItem.tsx — one event in the "My Battlepacks" home column.
 *
 * Game icon, event name, game name, the dates it runs, and a kebab menu.
 * Matches the Figma "Card / Bookings" instance on the home screen
 * (node 1052:18322).
 *
 * Named BattlepackListItem rather than PackListItem because BattleCards already
 * has a PackListItem and it means something else entirely there — a pack of
 * cards, not an event. Two components with one name across the workspace would
 * be a trap for whoever greps for it next.
 *
 * USAGE:
 *   <BattlepackListItem
 *     name="Warhammer 40,000 League at Gaming Arena - Season 6"
 *     gameName="Warhammer 40,000"
 *     gameIcon="/icons/w40k.png"
 *     startsOn="2026-07-14"
 *     endsOn="2026-09-26"
 *     status="draft"
 *     onOpen={() => navigate(`/app/${pack.id}/edit`)}
 *     menu={<KebabMenu … />}
 *   />
 */

import type { ReactNode } from 'react';
import { Badge, Notebook } from '@battleplans/ui';

export interface BattlepackListItemProps {
  name: string;
  gameName?: string | null;
  /** URL of the game's icon. Falls back to a neutral glyph when absent. */
  gameIcon?: string | null;
  /** ISO dates (yyyy-mm-dd) straight from the row. */
  startsOn?: string | null;
  endsOn?: string | null;
  /** Draft packs read differently from live ones, so the row says which. */
  status?: 'draft' | 'published' | 'unpublished';
  /** Optional right-aligned menu (⋯). */
  menu?: ReactNode;
  onOpen?: () => void;
}

/** dd/mm/yyyy, matching the rest of the platform. */
const formatDate = (iso?: string | null): string | null => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : null;
};

const STATUS_LABEL = {
  draft:       { label: 'Draft',       color: 'gray'    as const },
  published:   { label: 'Published',   color: 'success' as const },
  unpublished: { label: 'Unpublished', color: 'warning' as const },
};

const BattlepackListItem = ({
  name,
  gameName,
  gameIcon,
  startsOn,
  endsOn,
  status = 'draft',
  menu,
  onOpen,
}: BattlepackListItemProps) => {
  const starts = formatDate(startsOn);
  const ends   = formatDate(endsOn);
  const badge  = STATUS_LABEL[status];

  return (
    <div className="w-full bg-gray-800 border border-gray-700 rounded-lg shadow-md overflow-hidden">
      <div className="flex items-start gap-3 p-[13px]">

        {/* Game icon — 64px square, rounded. */}
        <button
          type="button"
          onClick={onOpen}
          tabIndex={-1}
          aria-hidden="true"
          className="shrink-0 w-16 h-16 rounded overflow-hidden bg-gray-900 flex items-center justify-center cursor-pointer"
        >
          {gameIcon
            ? <img src={gameIcon} alt="" className="w-full h-full object-cover" />
            : <Notebook className="w-6 h-6 text-gray-600" />}
        </button>

        <button
          type="button"
          onClick={onOpen}
          className="flex-1 min-w-0 flex flex-col justify-center text-left cursor-pointer"
        >
          <p className="font-heading text-lg leading-[18px] text-white">{name}</p>

          {gameName && (
            <p className="font-body font-bold text-sm leading-5 text-gray-300 opacity-50 truncate">
              {gameName}
            </p>
          )}

          {/* Dates are omitted rather than shown blank — a pack is created with
              only a name and a game, so early on there is nothing to say. */}
          {starts && <p className="font-body text-sm leading-5 text-gray-50">Starts {starts}</p>}
          {ends   && <p className="font-body text-sm leading-5 text-gray-50">Ends {ends}</p>}

          <span className="mt-1">
            <Badge color={badge.color}>{badge.label}</Badge>
          </span>
        </button>

        {menu && <div className="shrink-0 p-1 opacity-50 hover:opacity-100 transition-opacity">{menu}</div>}
      </div>
    </div>
  );
};

export default BattlepackListItem;
