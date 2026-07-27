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
  AddCircle, Magnifer, Shield,
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
    <div className="flex flex-col min-h-dvh bg-gray-950">
      <AppNavbar />

      <div className="flex-1 flex flex-col px-9 pt-9 min-h-0">
        <div className="flex-1 flex justify-center min-h-0">
          <div className="w-full max-w-sm min-w-[312px] h-full">
            <ScrollColumn
              className="h-full"
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
                <div className="flex flex-col gap-1.5">
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
                  gameIcon={p.game_icon}
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
        </div>

        <AppFooter className="shrink-0" appName="BattlePack" version={__APP_VERSION__} buildDate={__APP_BUILD_DATE__} />
      </div>

      <NewPackModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={id => navigate(`/app/${id}/edit`)}
      />
    </div>
  );
}
