/**
 * pickerOptions.tsx — game and venue options for <SearchSelect>.
 *
 * Both pickers follow the pattern BattlePlan's booking form established: the
 * handful you actually use first, a divider, then everything else A–Z, each row
 * carrying its artwork. Building the lists here rather than in each caller means
 * the New Event card and the Event Basics panel cannot drift apart.
 *
 * Artwork comes from the shared GAME_ICONS map (keyed by slug, auto-discovered
 * from packages/ui/src/assets/games) rather than `games.icon`, which is empty
 * for most of the catalogue. The database column is the fallback, not the
 * source.
 */

import { GAME_ICONS, MapPin, Widget2 } from '@battleplans/ui';
import type { SearchSelectOption } from '@battleplans/ui';
import type { GameOption, LocationOption } from './packs';

/** Square artwork chip, so rows line up whether or not a game has an icon. */
const IconChip = ({ src, fallback }: { src?: string | null; fallback: React.ReactNode }) => (
  <span className="size-6 rounded overflow-hidden bg-neutral-700 flex items-center justify-center shrink-0">
    {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : fallback}
  </span>
);

/**
 * Order a list so recently-used entries lead, then everything else by name,
 * and mark the first non-recent row so SearchSelect draws the divider there.
 */
function recentFirst<T extends { id: string; name: string }>(
  all: T[],
  recentIds: string[],
  toOption: (item: T) => Omit<SearchSelectOption, 'separatorBefore'>,
): SearchSelectOption[] {
  const recent = recentIds
    .map(id => all.find(item => item.id === id))
    .filter((item): item is T => Boolean(item));

  const recentIdSet = new Set(recent.map(item => item.id));
  const rest = all
    .filter(item => !recentIdSet.has(item.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...recent, ...rest].map((item, i) => ({
    ...toOption(item),
    // The divider sits on the first row after the recent block, and only when
    // there is a recent block to separate.
    separatorBefore: recent.length > 0 && i === recent.length,
  }));
}

export function gameOptions(games: GameOption[], recentIds: string[] = []): SearchSelectOption[] {
  return recentFirst(games, recentIds, g => ({
    value: g.id,
    label: g.name,
    icon: (
      <IconChip
        src={GAME_ICONS[g.slug] ?? g.icon}
        fallback={<Widget2 className="w-3.5 h-3.5 text-neutral-400" />}
      />
    ),
  }));
}

export function venueOptions(venues: LocationOption[], recentIds: string[] = []): SearchSelectOption[] {
  return recentFirst(venues, recentIds, v => ({
    value: v.id,
    label: v.name,
    icon: <IconChip fallback={<MapPin className="w-3.5 h-3.5 text-neutral-400" />} />,
  }));
}
