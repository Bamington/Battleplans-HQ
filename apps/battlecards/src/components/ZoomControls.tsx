/**
 * ZoomControls.tsx — Zoom in / out controls for the card viewer.
 *
 * Responsive on its own so every game's deck view stays consistent without
 * per-caller flags:
 *   • Tablet / desktop (md+): outline buttons with "Zoom Out" / "Zoom In" labels.
 *   • Mobile (< md): secondary (filled) icon-only buttons — no labels — to save
 *     the scarce horizontal space.
 *
 * Shared by <CardCarousel> and the Blood Bowl inline carousel. Wire it to the
 * relevant zoom state and drop it into any future game's card viewer.
 *
 * USAGE:
 *   <ZoomControls
 *     zoomLevel={zoomLevel}
 *     onZoomOut={zoomOut}
 *     onZoomIn={zoomIn}
 *   />
 */

import { Button } from '@battleplans/ui';
import { MinusCircle } from '@battleplans/ui';
import { AddCircle } from '@battleplans/ui';

export interface ZoomControlsProps {
  /** Current zoom level. Drives the disabled state at the min/max bounds. */
  zoomLevel: number;
  /** Fires when the user zooms out. */
  onZoomOut: () => void;
  /** Fires when the user zooms in. */
  onZoomIn: () => void;
  /** Lower zoom bound — the Zoom Out button disables at/below it. Default 0.5. */
  min?: number;
  /** Upper zoom bound — the Zoom In button disables at/above it. Default 1.0. */
  max?: number;
  /** Extra classes on the button row (e.g. positioning). */
  className?: string;
}

const ZoomControls = ({
  zoomLevel,
  onZoomOut,
  onZoomIn,
  min = 0.5,
  max = 1.0,
  className = '',
}: ZoomControlsProps) => {
  const atMin = zoomLevel <= min;
  const atMax = zoomLevel >= max;

  // Visibility is toggled on these wrapper <div>s rather than on the Buttons
  // themselves: a Button's base `inline-flex` display would otherwise win over
  // a `hidden` utility placed on it. The icon-only buttons carry an sr-only
  // label because Button doesn't forward `aria-label`.
  return (
    <div className={`flex items-center ${className}`.trim()}>
      {/* Mobile (< md): secondary, icon-only */}
      <div className="flex items-center gap-2 md:hidden">
        <Button color="secondary" size="sm" disabled={atMin} onClick={onZoomOut}>
          <MinusCircle className="w-4 h-4" />
          <span className="sr-only">Zoom out</span>
        </Button>
        <Button color="secondary" size="sm" disabled={atMax} onClick={onZoomIn}>
          <AddCircle className="w-4 h-4" />
          <span className="sr-only">Zoom in</span>
        </Button>
      </div>

      {/* Tablet / desktop (md+): outline, labelled */}
      <div className="hidden items-center gap-2 md:flex">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<MinusCircle className="w-4 h-4" />}
          disabled={atMin}
          onClick={onZoomOut}
        >
          Zoom Out
        </Button>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<AddCircle className="w-4 h-4" />}
          disabled={atMax}
          onClick={onZoomIn}
        >
          Zoom In
        </Button>
      </div>
    </div>
  );
};

export default ZoomControls;
