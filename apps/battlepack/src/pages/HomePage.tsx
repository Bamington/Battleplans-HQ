/**
 * HomePage.tsx — "My Battlepacks".
 *
 * One column: the organiser's events, a filter and a search, and the button
 * that starts a new pack. Matches the Figma home screen (node 1052:18322),
 * built on the shared <ScrollColumn>, which already provides the header, the
 * before-list slot and the pinned footer that layout needs.
 *
 * The list is not filtered by user here — row level security already restricts
 * battlepacks to the owner, platform admins and the venue's admins. Filtering in
 * both places would let the two disagree, and only one of them cannot be
 * bypassed.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppFooter, Button, Input, ScrollColumn, Select,
  AddCircle, GAME_ICONS, Magnifer, Shield,
} from '@battleplans/ui';
import AppNavbar from '../components/AppNavbar';
import BattlepackListItem from '../components/BattlepackListItem';
import NewPackModal from '../components/NewPackModal';
import { listPacks } from '../lib/packs';
import type { PackSummary } from '../lib/packs';

declare const __APP_VERSION__: string;
declare const __APP_BUILD_DATE__: string;

type Filter = 'upcoming' | 'past' | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'upcoming', label: 'Current & Upcoming' },
  { value: 'past',     label: 'Past' },
  { value: 'all',      label: 'All' },
];

/** Today as yyyy-mm-dd, to compare against the date columns without parsing. */
const today = () => new Date().toISOString().slice(0, 10);

export default function HomePage() {
  const navigate = useNavigate();

  const [packs,   setPacks]   = useState<PackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState<Filter>('upcoming');
  const [search,  setSearch]  = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listPacks()
      .then(setPacks)
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load your packs.'))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const now = today();
    const q   = search.trim().toLowerCase();

    return packs
      .filter(p => {
        if (filter === 'all') return true;
        // A pack with no dates yet is still being written, so it belongs with
        // the upcoming ones rather than falling off the list entirely.
        const end = p.ends_on ?? p.starts_on;
        if (!end) return filter === 'upcoming';
        return filter === 'upcoming' ? end >= now : end < now;
      })
      .filter(p => !q || p.name.toLowerCase().includes(q) || (p.game_name ?? '').toLowerCase().includes(q));
  }, [packs, filter, search]);

  return (
    // Same frame as the other apps' home screens: a fixed-height page that owns
    // its own scrolling, with the footer pinned outside <main>. The navbar must
    // be fixed={false} — it defaults to fixed, which pins it over the content
    // instead of sitting in the flow above it.
    // neutral-950, not gray-950: ColumnShell's panel is neutral-900 on
    // neutral-700, and the sibling home screens are neutral-950 around it. The
    // Figma says gray/950 here, but that is inherited from the BattleCards file
    // this frame was duplicated from, and following it would leave a blue-tinted
    // page behind an untinted column.
    <div className="h-dvh overflow-hidden flex flex-col bg-neutral-950">
      <AppNavbar fixed={false} />

      <main className="flex flex-1 min-h-0 items-stretch pt-3 md:pt-9 lg:px-9 w-full">
        {/* Below lg the columns scroll horizontally and snap, so a second column
            can be added later without revisiting this. items-stretch is what
            makes the column full height — ColumnShell sizes itself from it. */}
        <div className="flex flex-1 min-h-0 items-stretch gap-2.5 overflow-x-auto snap-x snap-mandatory lg:overflow-x-visible lg:snap-none lg:justify-center px-3 md:px-9 py-2 scroll-px-3 md:scroll-px-9 lg:p-0">
          <ScrollColumn
            icon={<Shield className="w-12 h-12 text-primary-500" />}
            title="My Battlepacks"
            description="Events you've created, and their BattlePacks."
            loading={loading}
            items={visible}
            getKey={p => p.id}
            empty={
              error ??
              (packs.length === 0
                ? 'No packs yet. Start one with the button below.'
                : 'Nothing matches that filter.')
            }
            beforeList={
              <div className="w-full flex flex-col gap-1.5">
                <Select
                  value={filter}
                  onChange={e => setFilter(e.target.value as Filter)}
                  options={FILTERS}
                />
                <Input
                  placeholder="Search"
                  leftIcon={<Magnifer className="w-4 h-4" />}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            }
            renderItem={p => (
              <BattlepackListItem
                name={p.name}
                gameName={p.game_name}
                /* Shared artwork map first — games.icon is empty for most of
                   the catalogue, so reading it alone left every row blank. */
                gameIcon={(p.game_slug && GAME_ICONS[p.game_slug]) || p.game_icon}
                startsOn={p.starts_on}
                endsOn={p.ends_on}
                status={p.status}
                onOpen={() => navigate(`/app/${p.id}/edit`)}
              />
            )}
            footer={
              <Button
                variant="outline"
                leftIcon={<AddCircle className="w-4 h-4" />}
                className="w-full"
                onClick={() => setCreating(true)}
              >
                New Battlepack
              </Button>
            }
          />
        </div>
      </main>

      <AppFooter className="shrink-0" appName="BattlePack" version={__APP_VERSION__} buildDate={__APP_BUILD_DATE__} />

      <NewPackModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={id => navigate(`/app/${id}/edit`)}
      />
    </div>
  );
}
