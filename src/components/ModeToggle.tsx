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
}

const ModeToggle = ({ mode, onModeChange }: ModeToggleProps) => {
  const base =
    'flex items-center justify-center gap-2 px-3 py-2 text-sm font-body font-medium text-white transition-colors cursor-pointer w-[132px]';

  const activeClasses = 'bg-blue-600 hover:bg-blue-700';
  const inactiveClasses = 'border border-blue-500 hover:bg-blue-950';

  return (
    <div className="flex h-8 shrink-0">
      {/* ── Edit button (left) ──────────────────────────────── */}
      <button
        type="button"
        onClick={() => onModeChange('edit')}
        className={[
          base,
          'rounded-l-lg',
          mode === 'edit' ? activeClasses : inactiveClasses,
        ].join(' ')}
      >
        <Pen2 className="w-4 h-4" />
        <span>Edit</span>
      </button>

      {/* ── Play button (right) ─────────────────────────────── */}
      <button
        type="button"
        onClick={() => onModeChange('play')}
        className={[
          base,
          'rounded-r-lg',
          mode === 'play' ? activeClasses : inactiveClasses,
        ].join(' ')}
      >
        <Play className="w-4 h-4" />
        <span>Play</span>
      </button>
    </div>
  );
};

export default ModeToggle;
