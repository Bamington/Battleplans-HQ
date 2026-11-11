/**
 * bench/ProfileSections.tsx — the optional parts of a profile page: Painting
 * Bench, Favourites and Painting Stats.
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
import { TotalsCard, PaintingProgressCard, RankedListCard } from './StatCards';
import type { Group, Progress } from './collectionStats';
import type { ModelStatus } from './types';

export interface ProfileStats {
  total: number;
  by_status: Record<ModelStatus, number>;
  collections: number;
  games: number;
  most_collected: { key: string; name: string; slug: string | null; total: number; painted: number }[];
}

export interface ProfileSectionsData {
  bench?: SharedModel[];
  favourites?: { models: SharedModel[]; boxes: SharedBox[] };
  stats?: ProfileStats;
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

  if (!data.bench && !data.favourites && !data.stats) return null;
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
