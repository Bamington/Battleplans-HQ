/**
 * BattleItem.tsx — A single recorded battle (Figma "Card / Battle", 1005:24539,
 * redesigned in 1014:22738).
 *
 *   [64px game logo]  GAME NAME              VICTORY
 *                     Against Nathan Haig
 *                     Saturday, 13/06/26 at Guf Werribee
 *
 * This is the LIST-view row: when the battle has a photo it fills the card
 * background, faded left→right into the card colour by a gradient plus an inset
 * vignette so the text stays legible. Without a photo the card is just its flat
 * neutral-800 fill. The GRID-view card (BattleGridItem) reuses `BattleCardBody`
 * below with a photo hero instead of a background.
 *
 * Every line truncates so the row stays a fixed 92px, which the home screen's
 * auto page-size calculation depends on (24 + 20 + 20 = 64 = the logo, plus 26px
 * padding and 2px border).
 */

import type React from 'react';
import type { BattleResult } from '../hooks/useBattles';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "2026-06-13" -> "Saturday, 13/06/26" */
export function formatBattleDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${DAY_NAMES[dt.getDay()]}, ${dd}/${mm}/${String(y).slice(2)}`;
}

// The Figma only specifies the win state (green). Loss and draw follow from it.
export const RESULT_LABEL: Record<BattleResult, string> = {
  won:  'victory',
  lost: 'defeat',
  drew: 'draw',
};

export const RESULT_COLOR: Record<BattleResult, string> = {
  won:  'text-green-500',
  lost: 'text-red-500',
  drew: 'text-neutral-400',
};

export interface BattleCardFields {
  gameIcon?:     string;
  gameName:      string;
  oppName:       string;
  datePlayed:    string;
  locationName?: string | null;
  result:        BattleResult;
}

/**
 * The logo + text block shared by the list row and the grid card: game logo,
 * game name + result, opponent, date/venue. `relative` so it layers above the
 * list row's background photo.
 */
export function BattleCardBody({ gameIcon, gameName, oppName, datePlayed, locationName, result }: BattleCardFields) {
  const when  = formatBattleDate(datePlayed);
  const where = locationName ? `${when} at ${locationName}` : when;

  return (
    <>
      {/* Game logo */}
      <div className="relative w-16 h-16 rounded overflow-hidden shrink-0 bg-neutral-700 flex items-center justify-center">
        {gameIcon
          ? <img src={gameIcon} alt="" className="w-full h-full object-cover" />
          : <span className="font-heading text-white text-xs text-center px-1 leading-tight">{gameName}</span>}
      </div>

      {/* Text block */}
      <div className="relative flex flex-col flex-1 min-w-0 self-stretch justify-center">
        <div className="flex items-center justify-between gap-2">
          <span className="font-heading text-lg text-white leading-6 truncate flex-1 min-w-0">
            {gameName}
          </span>
          <span className={`font-heading text-lg leading-6 text-right whitespace-nowrap shrink-0 ${RESULT_COLOR[result]}`}>
            {RESULT_LABEL[result]}
          </span>
        </div>

        <span className="font-body text-sm text-neutral-50 leading-5 truncate">
          Against {oppName}
        </span>
        <span className="font-body text-sm text-neutral-50 leading-5 truncate">
          {where}
        </span>
      </div>
    </>
  );
}

/** Props applied to a clickable card wrapper (list row or grid card). */
export function clickableProps(onClick?: () => void) {
  if (!onClick) return {};
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
    },
  };
}

export function BattleItem({ photoUrl, onClick, ...fields }: BattleCardFields & {
  /** Optional photo taken against this battle, shown faded behind the card. */
  photoUrl?: string | null;
  /** When set, the card becomes a button that opens the battle's details. */
  onClick?:  () => void;
}) {
  return (
    <div
      {...clickableProps(onClick)}
      className={`relative bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] flex gap-1.5 items-start shadow-md overflow-hidden${onClick ? ' cursor-pointer hover:border-neutral-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500' : ''}`}
    >
      {/* Photographic fill — the battle's photo, faded into the card colour so
          the text stays readable. Only rendered when a photo exists. */}
      {photoUrl && (
        <div className="absolute inset-[-1px] pointer-events-none" aria-hidden="true">
          <img src={photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-800/75 to-neutral-800 to-[74.519%]" />
          <div className="absolute inset-0 shadow-[inset_0px_0px_12px_6px_#1f2937]" />
        </div>
      )}

      <BattleCardBody {...fields} />
    </div>
  );
}
