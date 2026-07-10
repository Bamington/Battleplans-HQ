/**
 * BattleItem.tsx — A single recorded battle (Figma "Card / Battle", 1005:24539).
 *
 *   [64px game icon]  GAME NAME              VICTORY
 *                     Against Nathan Haig
 *                     Saturday, 13/06/26 at Guf Werribee
 *
 * Every line truncates so the row stays a fixed 92px, which the home screen's
 * auto page-size calculation depends on (24 + 20 + 20 = 64 = the thumbnail,
 * plus 26px padding and 2px border).
 */

import type { BattleResult } from '../hooks/useBattles';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "2026-06-13" -> "Saturday, 13/06/26" */
function formatBattleDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${DAY_NAMES[dt.getDay()]}, ${dd}/${mm}/${String(y).slice(2)}`;
}

// The Figma only specifies the win state (green). Loss and draw follow from it.
const RESULT_LABEL: Record<BattleResult, string> = {
  won:  'victory',
  lost: 'defeat',
  drew: 'draw',
};

const RESULT_COLOR: Record<BattleResult, string> = {
  won:  'text-green-500',
  lost: 'text-red-500',
  drew: 'text-neutral-400',
};

export function BattleItem({ gameIcon, gameName, oppName, datePlayed, locationName, result }: {
  gameIcon?:     string;
  gameName:      string;
  oppName:       string;
  datePlayed:    string;
  locationName?: string | null;
  result:        BattleResult;
}) {
  const when = formatBattleDate(datePlayed);
  const where = locationName ? `${when} at ${locationName}` : when;

  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] flex gap-1.5 items-start shadow-md overflow-hidden">

      {/* Game thumbnail */}
      <div className="w-16 h-16 rounded-sm overflow-hidden shrink-0 bg-neutral-700 flex items-center justify-center">
        {gameIcon
          ? <img src={gameIcon} alt="" className="w-full h-full object-cover" />
          : <span className="font-heading text-white text-xs text-center px-1 leading-tight">{gameName}</span>
        }
      </div>

      {/* Text block */}
      <div className="flex flex-col flex-1 min-w-0 self-stretch justify-center">

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
    </div>
  );
}
