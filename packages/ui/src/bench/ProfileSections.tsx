/**
 * bench/ProfileSections.tsx — the optional parts of a profile page: Painting
 * Bench, Favourites and Painting Stats (BattleBench), and Battle Record, Recent
 * Battles and Favorite Venues (BattlePlan).
 *
 * What shows is decided in the database: get_profile_sections(user) returns
 * only the sections the viewer may see (each is Off / Friends only / Everyone,
 * set on the Public Profile tab of Edit Profile), so a hidden section simply
 * isn't here. Tapping a model or collection opens it read-only — the same view
 * a share link shows, never purchase dates.
 */

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import Sheet from '../components/Sheet';
import { ModelItem } from './ModelItem';
import { BoxItem } from './BoxItem';
import {
  SharedModelView, SharedBoxView, usePhotoViewer, sharedModelCard, sharedBoxCard,
  type SharedModel, type SharedBox,
} from './SharedViews';
import { TotalsCard, PaintingProgressCard, RankedListCard, StatCard, pct } from './StatCards';
import type { Group, Progress } from './collectionStats';
import type { ModelStatus } from './types';
import { BattleItem, type BattleResult } from '../battles/BattleItem';
import { GAME_ICONS } from '../lib/gameArt';
import MapPin from '../icons/MapPin';

export interface ProfileStats {
  total: number;
  by_status: Record<ModelStatus, number>;
  collections: number;
  games: number;
  most_collected: { key: string; name: string; slug: string | null; total: number; painted: number }[];
}

/** Battle Record — aggregates only, never opponents. */
export interface ProfileBattleRecord {
  played: number;
  won: number;
  lost: number;
  drew: number;
  this_year: number;
  games: number;
  current_streak: number;
  longest_streak: number;
  /** Top 10 official (supported) games by battles played. */
  most_played: { key: string; name: string; slug: string | null; played: number; won: number }[];
  /** The official game with the most wins / losses — `count` of `played`. */
  most_wins: ProfileGameTally | null;
  most_losses: ProfileGameTally | null;
}

export interface ProfileGameTally { name: string; slug: string | null; count: number; played: number }

/** A recent battle as a profile shows it: no opponents, no notes, and a venue
 *  only when it was one of our public venues. */
export interface ProfileRecentBattle {
  id: number;
  date_played: string;
  result: BattleResult;
  game: { name: string; slug: string | null } | null;
  venue: string | null;
  /** Storage path in the battle-images bucket. */
  photo_path: string | null;
}

export interface ProfileVenue {
  id: string;
  name: string;
  /** An image URL or an emoji. */
  icon: string | null;
  address: string | null;
  country: string | null;
  /** Distinct days there — past bookings plus battles logged at it. */
  visits: number;
}

export interface ProfileSectionsData {
  bench?: SharedModel[];
  favourites?: { models: SharedModel[]; boxes: SharedBox[] };
  stats?: ProfileStats;
  battles?: ProfileBattleRecord;
  /** The last 5 battles from the last 3 months. */
  recent_battles?: ProfileRecentBattle[];
  /** Favorite Venues: the top 3 public venues by visits. */
  venues?: ProfileVenue[];
}

const battlePhotoUrl = (path: string) => supabase.storage.from('battle-images').getPublicUrl(path).data.publicUrl;

/** A label on the left, its value on the right — the Record card's lines. */
function RecordLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex justify-between gap-3">
      <span className="shrink-0">{label}</span>
      <span className="text-white text-right tabular-nums min-w-0">{children}</span>
    </li>
  );
}

/** Big number over a small label, as on the Collection card. */
function Figure({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-heading text-2xl text-white leading-none tabular-nums">{value}</span>
      <span className="font-body text-xs text-neutral-400 mt-1">{label}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-heading text-lg text-white">{title}</h2>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="font-body text-sm text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3">{children}</p>
);

/** The sections as given — split out so the gallery can show them without a database. */
export function ProfileSectionsView({ data }: { data: ProfileSectionsData }) {
  const [openModel, setOpenModel] = useState<SharedModel | null>(null);
  const [openBox, setOpenBox] = useState<SharedBox | null>(null);
  const photos = usePhotoViewer();

  const stats = data.stats;
  const progress = useMemo<Progress | null>(() => stats
    ? { total: stats.total, byStatus: stats.by_status, paintedRate: stats.total ? stats.by_status.Painted / stats.total : 0 }
    : null, [stats]);
  const games = useMemo<Group[]>(() => (stats?.most_collected ?? []).map(g => ({
    key: g.key, name: g.name, slug: g.slug ?? undefined, total: g.total, painted: g.painted,
    paintedRate: g.total ? g.painted / g.total : 0,
  })), [stats]);

  const record = data.battles;
  const mostPlayed = useMemo<Group[]>(() => (record?.most_played ?? []).map(g => ({
    key: g.key, name: g.name, slug: g.slug ?? undefined, total: g.played, painted: g.won,
    paintedRate: g.played ? g.won / g.played : 0,
  })), [record]);

  if (!data.bench && !data.favourites && !data.stats && !data.battles && !data.recent_battles && !data.venues) return null;
  const favCount = (data.favourites?.models.length ?? 0) + (data.favourites?.boxes.length ?? 0);

  return (
    <div className="flex flex-col gap-6">
      {data.bench && (
        <Section title="Painting Bench">
          {data.bench.length === 0 ? <Empty>Nothing on the bench right now.</Empty> : (
            <div className="flex flex-col gap-1.5">
              {data.bench.map(m => <ModelItem key={m.id} model={sharedModelCard(m)} onClick={() => setOpenModel(m)} />)}
            </div>
          )}
        </Section>
      )}

      {data.favourites && (
        <Section title="Favourites">
          {favCount === 0 ? <Empty>No favourites yet.</Empty> : (
            <div className="flex flex-col gap-1.5">
              {data.favourites.boxes.map(b => <BoxItem key={b.id} box={sharedBoxCard(b)} onClick={() => setOpenBox(b)} />)}
              {data.favourites.models.map(m => <ModelItem key={m.id} model={sharedModelCard(m)} onClick={() => setOpenModel(m)} />)}
            </div>
          )}
        </Section>
      )}

      {stats && progress && (
        <Section title="Painting Stats">
          <div className="flex flex-col gap-1.5">
            <TotalsCard models={stats.total} collections={stats.collections} games={stats.games} />
            <PaintingProgressCard title="Painting Progress" progress={progress} />
            <RankedListCard title="Most Collected" groups={games} icon emptyLabel="No games yet." />
          </div>
        </Section>
      )}

      {record && (
        <Section title="Battle Record">
          <div className="flex flex-col gap-1.5">
            <StatCard title="Record">
              {record.played === 0 ? (
                <p className="font-body text-sm text-neutral-500">No battles yet.</p>
              ) : (
                <>
                  {/* Five even columns, so Win rate stays on the same row as
                      the counts even at phone width. */}
                  <div className="grid grid-cols-5 gap-2">
                    <Figure value={record.played} label="Played" />
                    <Figure value={record.won} label="Won" />
                    <Figure value={record.lost} label="Lost" />
                    <Figure value={record.drew} label="Drawn" />
                    <Figure value={`${pct(record.won / record.played)}%`} label="Win rate" />
                  </div>
                  <ul className="flex flex-col gap-1 mt-1 font-body text-sm text-neutral-300">
                    <RecordLine label="Current win streak">{record.current_streak}</RecordLine>
                    <RecordLine label="Longest win streak">{record.longest_streak}</RecordLine>
                    <RecordLine label="Battles this year">{record.this_year}</RecordLine>
                    {record.most_wins && (
                      <RecordLine label="Most wins">{record.most_wins.name} ({record.most_wins.count}/{record.most_wins.played})</RecordLine>
                    )}
                    {record.most_losses && (
                      <RecordLine label="Most losses">{record.most_losses.name} ({record.most_losses.count}/{record.most_losses.played})</RecordLine>
                    )}
                  </ul>
                </>
              )}
            </StatCard>
            <RankedListCard title="Most Played" groups={mostPlayed} icon rateLabel="won" expandable={false} emptyLabel="No official games yet." />
          </div>
        </Section>
      )}

      {data.recent_battles && (
        <Section title="Recent Battles">
          {data.recent_battles.length === 0 ? <Empty>No battles in the last 3 months.</Empty> : (
            <div className="flex flex-col gap-1.5">
              {data.recent_battles.map(b => (
                <BattleItem
                  key={b.id}
                  gameIcon={b.game?.slug ? GAME_ICONS[b.game.slug] : undefined}
                  gameName={b.game?.name ?? 'Unknown game'}
                  datePlayed={b.date_played}
                  locationName={b.venue}
                  result={b.result}
                  photoUrl={b.photo_path ? battlePhotoUrl(b.photo_path) : null}
                />
              ))}
            </div>
          )}
        </Section>
      )}

      {data.venues && (
        <Section title="Favorite Venues">
          {data.venues.length === 0 ? <Empty>No venues visited yet.</Empty> : (
            <div className="flex flex-col gap-1.5">
              {data.venues.map(v => (
                <div key={v.id} className="bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] shadow-md flex gap-3 items-center">
                  <div className="size-16 rounded overflow-hidden shrink-0 bg-neutral-700 flex items-center justify-center">
                    {v.icon?.startsWith('http')
                      ? <img src={v.icon} alt="" className="w-full h-full object-cover" />
                      : v.icon
                        ? <span className="text-3xl leading-none">{v.icon}</span>
                        : <MapPin className="w-6 h-6 text-neutral-400" />}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-heading text-lg text-white leading-6 truncate">{v.name}</span>
                    {v.address && (
                      <span className="font-body text-sm text-neutral-300 leading-5">{v.address}</span>
                    )}
                  </div>
                  <span className="font-body text-xs text-neutral-400 shrink-0">
                    {v.visits} {v.visits === 1 ? 'visit' : 'visits'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* One read-only viewer: a collection's models open over it, and back. */}
      <Sheet open={openModel !== null || openBox !== null} onClose={() => { setOpenModel(null); setOpenBox(null); }} className="max-w-2xl">
        <div className="flex flex-col overflow-y-auto max-h-[90vh]">
        {openModel ? (
          <div className="flex flex-col">
            {openBox && (
              <button type="button" onClick={() => setOpenModel(null)}
                className="self-start px-5 pt-3 font-body text-sm text-primary-400 hover:text-primary-300">
                ← Back to {openBox.name}
              </button>
            )}
            <SharedModelView key={openModel.id} model={openModel} openPhotos={photos.open} />
          </div>
        ) : openBox ? (
          <SharedBoxView box={openBox} onOpenModel={setOpenModel} openPhotos={photos.open} />
        ) : null}
        </div>
      </Sheet>
      {photos.viewer}
    </div>
  );
}

/** The sections of `userId`'s profile this viewer may see, loaded. */
export default function ProfileSections({ userId }: { userId: string }) {
  const [data, setData] = useState<ProfileSectionsData | null>(null);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    supabase.rpc('get_profile_sections', { p_user: userId })
      .then(({ data: d }) => { if (!cancelled) setData((d as ProfileSectionsData | null) ?? {}); });
    return () => { cancelled = true; };
  }, [userId]);
  if (!data) return null;
  return <ProfileSectionsView data={data} />;
}
