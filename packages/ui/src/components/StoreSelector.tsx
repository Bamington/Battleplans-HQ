/**
 * StoreSelector.tsx — the venue you are currently acting as, in the navbar.
 *
 * Sits left of the user avatar. With more than one venue it is a dropdown; with
 * exactly one it is a static label, because a picker with a single option is a
 * control that cannot do anything.
 *
 * `emptyOption` adds a leading entry whose value is `''`. BattlePlan uses it for
 * "Your Profile" — meaning "not acting as any store" — which BattlePack has no
 * use for, since every pack belongs to a store and there is no personal view to
 * go back to.
 *
 * NOTE ON DUPLICATION: BattlePlan has its own copy at
 * src/components/StoreSelector.tsx. This shared one was added when BattlePack
 * needed the same control. That copy is deliberately untouched — rewiring a
 * shipped app was not part of this change — but the two should become one.
 *
 * USAGE:
 *   <AppNavbar>
 *     <StoreSelector locations={mine} selectedId={venueId} onSelect={setVenueId} />
 *   </AppNavbar>
 */

import Dropdown, { DropdownItem, DropdownHeader } from './Dropdown';
import AltArrowDown from '../icons/AltArrowDown';

export interface StoreSelectorLocation {
  id: string;
  name: string;
  /** An emoji, a URL, or nothing. */
  icon?: string | null;
}

export interface StoreSelectorProps {
  locations: StoreSelectorLocation[];
  /** The selected venue's id, or '' for the empty entry. */
  selectedId: string;
  onSelect: (id: string) => void;
  /** Render a leading entry that selects `''`. */
  emptyOption?: boolean;
  /** Label for that leading entry. */
  emptyLabel?: string;
  /** Small-caps heading above the list. */
  headerLabel?: string;
}

/** Square venue chip — artwork, emoji, or the first letter as a last resort. */
export function StoreIcon({ location }: { location: StoreSelectorLocation }) {
  const isUrl = location.icon?.startsWith('http');
  return (
    <span className="size-6 rounded overflow-hidden bg-neutral-700 flex items-center justify-center shrink-0">
      {isUrl
        ? <img src={location.icon!} alt="" className="w-full h-full object-cover" />
        : location.icon
          ? <span className="text-base leading-none">{location.icon}</span>
          : <span className="font-body text-xs font-bold text-primary-300 uppercase">{location.name[0]}</span>}
    </span>
  );
}

const StoreSelector = ({
  locations,
  selectedId,
  onSelect,
  emptyOption = false,
  emptyLabel  = 'All Venues',
  headerLabel = 'Your stores',
}: StoreSelectorProps) => {
  const selected = locations.find(l => l.id === selectedId);

  // Nothing selected and no empty entry to fall back on — render nothing rather
  // than an empty control.
  if (!emptyOption && !selected) return null;

  const label = selected?.name ?? emptyLabel;

  // One venue and no way to leave it: a label, not a dropdown.
  if (locations.length <= 1 && !emptyOption) {
    return (
      <span className="flex items-center gap-2 font-body text-sm text-neutral-300 truncate">
        {selected && <StoreIcon location={selected} />}
        <span className="truncate">{label}</span>
      </span>
    );
  }

  return (
    <Dropdown
      trigger={
        <span className="flex items-center gap-2 font-body text-sm text-neutral-300 cursor-pointer hover:text-white transition-colors">
          {selected && <StoreIcon location={selected} />}
          <span className="truncate max-w-[10rem]">{label}</span>
          <AltArrowDown className="w-4 h-4 shrink-0" />
        </span>
      }
    >
      <DropdownHeader>{headerLabel}</DropdownHeader>

      {emptyOption && (
        <DropdownItem onClick={() => onSelect('')}>{emptyLabel}</DropdownItem>
      )}

      {locations.map(l => (
        <DropdownItem key={l.id} onClick={() => onSelect(l.id)}>
          <span className="flex items-center gap-2">
            <StoreIcon location={l} />
            <span className="truncate">{l.name}</span>
          </span>
        </DropdownItem>
      ))}
    </Dropdown>
  );
};

export default StoreSelector;
