/**
 * PlaySubnav.tsx — Units / Rules sub-navigation bar
 *
 * A full-width segmented toggle shown below the Navbar when the app is in
 * Play mode. Lets the player switch between viewing their unit cards and
 * their rules.
 *
 * USAGE:
 *   <PlaySubnav tab="units" onTabChange={setTab} />
 *
 * PROPS:
 *   tab          — Currently active tab: "units" or "rules".
 *   onTabChange  — Callback fired when the user clicks the other tab.
 */

import { useState } from 'react';
import { FileText } from '@battleplans/ui';
import { ListCheck } from '@battleplans/ui';

export type PlayTab = 'units' | 'rules';

interface PlaySubnavProps {
  /** Currently active tab */
  tab: PlayTab;
  /** Fires when the user selects a different tab */
  onTabChange: (tab: PlayTab) => void;
  /**
   * Turn number of the game in progress. Omit to hide the game row entirely —
   * which is what a builder without play-session persistence should do.
   */
  turn?: number;
  /** Ends the game in progress. Omit alongside `turn`. */
  onEndGame?: () => void;
}

const PlaySubnav = ({ tab, onTabChange, turn, onEndGame }: PlaySubnavProps) => {
  // Ending a game throws away the board, so the button asks first. Kept here
  // rather than in a modal: it's one destructive action on a bar that's
  // already visible, and a dialog mid-game is more interruption than it earns.
  const [confirmingEnd, setConfirmingEnd] = useState(false);

  const base =
    'flex flex-1 items-center justify-center gap-2 px-3 py-2 text-sm font-body font-medium text-white transition-colors cursor-pointer min-w-0';

  const activeClasses = 'bg-blue-600 hover:bg-blue-700';
  const inactiveClasses = 'border border-blue-500 hover:bg-blue-950';

  return (
    <div className="w-full bg-gray-900 border-b border-gray-700 px-3 pt-3 pb-[13px]">
      <div className="flex h-[34px]">
        {/* ── Units button (left) ───────────────────────────── */}
        <button
          type="button"
          onClick={() => onTabChange('units')}
          className={[
            base,
            'rounded-l-lg',
            tab === 'units' ? activeClasses : inactiveClasses,
          ].join(' ')}
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span>Units</span>
        </button>

        {/* ── Rules button (right) ──────────────────────────── */}
        <button
          type="button"
          onClick={() => onTabChange('rules')}
          className={[
            base,
            'rounded-r-lg',
            tab === 'rules' ? activeClasses : inactiveClasses,
          ].join(' ')}
        >
          <ListCheck className="w-4 h-4 shrink-0" />
          <span>Rules</span>
        </button>
      </div>

      {/* ── Game row — turn counter and the way to finish ──────────────────
          Only rendered when the builder is tracking a play session. */}
      {turn != null && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <span className="font-body text-xs text-gray-400">
            Turn {turn}
          </span>

          {onEndGame && (
            confirmingEnd ? (
              <span className="flex items-center gap-3">
                <span className="font-body text-xs text-gray-400">
                  End this game?
                </span>
                <button
                  type="button"
                  onClick={() => { setConfirmingEnd(false); onEndGame(); }}
                  className="font-body text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  End game
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingEnd(false)}
                  className="font-body text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Keep playing
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingEnd(true)}
                className="font-body text-xs text-gray-400 hover:text-white transition-colors"
              >
                End game
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default PlaySubnav;
