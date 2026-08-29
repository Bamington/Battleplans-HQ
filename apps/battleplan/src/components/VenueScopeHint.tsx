/**
 * VenueScopeHint.tsx — "Showing venues in Victoria. Show all venues"
 *
 * The line that sits under every venue picker, saying which venues are being
 * offered and letting the reader see past it. Three pickers use it — booking a
 * table, logging a battle, and editing a logged battle — and they must agree,
 * or the same toggle would mean different things in different places.
 *
 * WHEN IT SAYS NOTHING. Rendering nothing is the normal case, and deliberately
 * so. The hint appears only when the filter is actually holding a venue back
 * (or has been switched off, so there is a way back). While every venue on the
 * platform is Victorian there is nothing to explain to a Victorian player, and
 * a line reading "Showing venues in Victoria" over a complete list would be
 * noise that teaches people to ignore the next one.
 *
 * It also says nothing when `region` is null — a user who has not given us a
 * postcode is being shown everything, and telling them their list is filtered
 * would be untrue.
 *
 * This lives in the app rather than packages/ui because only BattlePlan has
 * venues to pick between. See packages/ui/src/lib/regions.ts for what a region
 * is and how one is derived.
 */

import { TextLink, regionLabel } from '@battleplans/ui';

export interface VenueScopeHintProps {
  /** The viewer's region, or null if they have no postcode on file. */
  region: string | null;
  /** How many venues the filter is currently hiding. */
  hiddenCount: number;
  /** Whether the filter is currently switched off. */
  showingAll: boolean;
  onToggle: () => void;
}

export function VenueScopeHint({ region, hiddenCount, showingAll, onToggle }: VenueScopeHintProps) {
  // Nothing hidden and nothing switched off — there is no scope to explain.
  if (!region || (hiddenCount === 0 && !showingAll)) return null;

  return (
    <p className="font-body text-xs text-gray-500">
      {showingAll
        ? 'Showing venues everywhere. '
        : `Showing venues in ${regionLabel(region)}. `}
      <TextLink variant="paragraph" className="text-xs" onClick={onToggle}>
        {showingAll ? 'Show only nearby venues' : 'Show all venues'}
      </TextLink>
    </p>
  );
}

export default VenueScopeHint;
