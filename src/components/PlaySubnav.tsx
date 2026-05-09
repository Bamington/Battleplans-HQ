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

import FileText from '../icons/FileText';
import ListCheck from '../icons/ListCheck';

export type PlayTab = 'units' | 'rules';

interface PlaySubnavProps {
  /** Currently active tab */
  tab: PlayTab;
  /** Fires when the user selects a different tab */
  onTabChange: (tab: PlayTab) => void;
}

const PlaySubnav = ({ tab, onTabChange }: PlaySubnavProps) => {
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
    </div>
  );
};

export default PlaySubnav;
