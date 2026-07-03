/**
 * ModeToggle.tsx — Edit / Play mode segmented toggle
 *
 * A two-button group that lets users switch between Edit mode (card builder)
 * and Play mode (gameplay tracking). The active side is filled blue-600;
 * the inactive side is outlined with blue-500.
 *
 * USAGE:
 *   <ModeToggle mode="edit" onModeChange={setMode} />
 *
 * PROPS:
 *   mode          — Currently active mode: "edit" or "play".
 *   onModeChange  — Callback fired when the user clicks the other mode.
 */

import Pen2 from '../icons/Pen2';
import Play from '../icons/Play';

export type Mode = 'edit' | 'play';

interface ModeToggleProps {
  /** Currently active mode */
  mode: Mode;
  /** Fires when the user selects a different mode */
  onModeChange: (mode: Mode) => void;
  /** Modes that are visually greyed-out and non-interactive */
  disabledModes?: Mode[];
}

const ModeToggle = ({ mode, onModeChange, disabledModes = [] }: ModeToggleProps) => {
  const base =
    'flex items-center justify-center gap-2 px-3 py-2 text-sm font-body font-medium transition-colors w-[132px]';

  const activeClasses   = 'bg-blue-600 hover:bg-blue-700 cursor-pointer text-white';
  const inactiveClasses = 'border border-blue-500 hover:bg-blue-950 cursor-pointer text-white';
  const disabledClasses = 'border border-gray-700 text-gray-600 cursor-not-allowed';

  const btnClass = (m: Mode) => {
    if (disabledModes.includes(m)) return [base, m === 'edit' ? 'rounded-l-lg' : 'rounded-r-lg', disabledClasses].join(' ');
    return [base, m === 'edit' ? 'rounded-l-lg' : 'rounded-r-lg', mode === m ? activeClasses : inactiveClasses].join(' ');
  };

  return (
    <div className="flex h-8 shrink-0">
      {/* ── Edit button (left) ──────────────────────────────── */}
      <button
        type="button"
        onClick={() => !disabledModes.includes('edit') && onModeChange('edit')}
        className={btnClass('edit')}
        disabled={disabledModes.includes('edit')}
      >
        <Pen2 className="w-4 h-4" />
        <span>Edit</span>
      </button>

      {/* ── Play button (right) ─────────────────────────────── */}
      <button
        type="button"
        onClick={() => !disabledModes.includes('play') && onModeChange('play')}
        className={btnClass('play')}
        disabled={disabledModes.includes('play')}
      >
        <Play className="w-4 h-4" />
        <span>Play</span>
      </button>
    </div>
  );
};

export default ModeToggle;
