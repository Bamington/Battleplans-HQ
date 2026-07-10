import { Dropdown, DropdownItem, DropdownHeader, AltArrowDown } from '@battleplans/ui';
import type { Location } from '../hooks/useBookingData';

export function StoreIcon({ location }: { location: Location }) {
  const isUrl = location.icon?.startsWith('http');
  return (
    <span className="size-6 rounded overflow-hidden bg-neutral-700 flex items-center justify-center shrink-0">
      {isUrl
        ? <img src={location.icon} alt="" className="w-full h-full object-cover" />
        : location.icon
          ? <span className="text-base leading-none">{location.icon}</span>
          : <span className="font-body text-xs font-bold text-primary-300 uppercase">{location.name[0]}</span>}
    </span>
  );
}

/**
 * StoreSelector — venue picker for the navbar (left of the user avatar).
 *
 * - With `emptyOption`, adds a leading entry whose value is `''` — the home
 *   screen uses it for "Your Profile", meaning "not viewing any store".
 * - Without it, a single-venue admin sees a static label (nothing to choose).
 */
export function StoreSelector({
  locations, selectedId, onSelect,
  emptyOption = false,
  emptyLabel  = 'All Venues',
  headerLabel = 'Your stores',
}: {
  locations: Location[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Render a leading entry that selects `''`. */
  emptyOption?: boolean;
  /** Label for that leading entry. */
  emptyLabel?: string;
  /** Small caps heading above the list. */
  headerLabel?: string;
}) {
  const selected = locations.find(l => l.id === selectedId);

  // No empty entry and nothing selected → nothing to show.
  if (!emptyOption && !selected) return null;

  // Single venue with no empty entry → static label, no dropdown.
  if (!emptyOption && locations.length <= 1 && selected) {
    return (
      <div className="flex items-center gap-1.5 px-1.5 py-0.5">
        <StoreIcon location={selected} />
        <span className="font-body text-sm text-gray-200 max-w-[140px] truncate">{selected.name}</span>
      </div>
    );
  }

  return (
    <Dropdown
      align="right"
      menuClassName="w-56"
      trigger={
        <button
          type="button"
          className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-xl border border-transparent
                     hover:bg-primary-950 hover:border-primary-900 transition-colors cursor-pointer"
        >
          {selected && <StoreIcon location={selected} />}
          <span className="font-body text-sm text-gray-200 max-w-[140px] truncate">
            {selected ? selected.name : emptyLabel}
          </span>
          <AltArrowDown className="w-4 h-4 text-gray-500" />
        </button>
      }
    >
      <DropdownHeader>
        <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wider">{headerLabel}</p>
      </DropdownHeader>
      {emptyOption && (
        <DropdownItem onClick={() => onSelect('')}>
          <span className={!selected ? 'text-blue-400' : 'text-gray-200'}>{emptyLabel}</span>
        </DropdownItem>
      )}
      {locations.map(l => (
        <DropdownItem key={l.id} icon={<StoreIcon location={l} />} onClick={() => onSelect(l.id)}>
          <span className={l.id === selectedId ? 'text-blue-400' : 'text-gray-200'}>{l.name}</span>
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
