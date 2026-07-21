/**
 * CollectionStatsPage.tsx — A breakdown of the user's collection (/app/stats).
 *
 * Three snap-scrolling columns, mirroring BattlePlan's stats page:
 *   1. Overall    — totals, painting progress, and most-collected games.
 *   2. By game    — a game picker (default: most collected) + that game's
 *                   painting progress and status breakdown.
 *   3. Highlights — most/least painted games, biggest collections, and a
 *                   per-year added/painted timeline.
 *
 * All maths lives in ../lib/collectionStats; this file is presentation only.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase, AppFooter, Select, Pagination, ColumnShell, ColumnHeader, Widget2 } from '@battleplans/ui';
import AppNavbar from '../components/AppNavbar';
import { GAME_ICONS } from '../components/gameIcons';
import { useCollectionStats } from '../hooks/useCollectionStats';
import {
  progressOf, gameGroups, collectionGroups, rankByTotal, rankByPainted, purchaseByYear, gameCount,
  STATUS_ORDER, STATUS_LABEL, STATUS_COLOR,
  type StatModel, type Progress, type Group, type YearRow,
} from '../lib/collectionStats';

declare const __APP_VERSION__: string;
declare const __APP_BUILD_DATE__: string;

/** A game needs this many miniatures before it can rank in most/least painted. */
const MIN_RANKED = 5;
const RANK_PAGE = 10;

const pct = (r: number) => Math.round(r * 100);

const BattleBenchLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattleBench</span>
);

// ── Column icons ──────────────────────────────────────────────────────────────

const ChartIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 40V8M8 40h32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    <rect x="15" y="24" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="2.5"/>
    <rect x="24" y="18" width="5" height="16" rx="1" stroke="currentColor" strokeWidth="2.5"/>
    <rect x="33" y="12" width="5" height="22" rx="1" stroke="currentColor" strokeWidth="2.5"/>
  </svg>
);

const GameIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 6 40 14v20L24 42 8 34V14L24 6Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="M8 14l16 8 16-8M24 22v20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const StarIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 6l5.3 11.1L41 18.6l-8.5 8 2 11.6L24 32.7 13.5 38.2l2-11.6-8.5-8 11.7-1.5L24 6Z"
      stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
  </svg>
);

// ── Card building blocks ──────────────────────────────────────────────────────

function StatCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] shadow-md flex flex-col gap-2">
      <h3 className="font-heading text-base text-white leading-6">{title}</h3>
      {children}
    </div>
  );
}

/** The painted → unpainted split as a stacked bar. */
function ProgressBar({ progress }: { progress: Progress }) {
  const { total, byStatus } = progress;
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-700">
      {STATUS_ORDER.map(s => {
        const w = total ? (byStatus[s] / total) * 100 : 0;
        return w > 0 ? <div key={s} className={STATUS_COLOR[s]} style={{ width: `${w}%` }} /> : null;
      })}
    </div>
  );
}

function PaintingProgressCard({ title, progress }: { title: string; progress: Progress }) {
  return (
    <StatCard title={title}>
      {progress.total === 0 ? (
        <p className="font-body text-sm text-neutral-500">No models here yet.</p>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-heading text-2xl text-white leading-none">{pct(progress.paintedRate)}%</span>
            <span className="font-body text-sm text-neutral-400">
              {progress.byStatus.Painted} / {progress.total} painted
            </span>
          </div>
          <ProgressBar progress={progress} />
          <ul className="flex flex-col gap-1 mt-1">
            {STATUS_ORDER.filter(s => progress.byStatus[s] > 0).map(s => (
              <li key={s} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${STATUS_COLOR[s]}`} aria-hidden="true" />
                <span className="flex-1 font-body text-sm text-neutral-200">{STATUS_LABEL[s]}</span>
                <span className="font-body text-sm text-neutral-400 tabular-nums">{progress.byStatus[s]}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </StatCard>
  );
}

function TotalsCard({ models, collections, games }: { models: number; collections: number; games: number }) {
  const Item = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col">
      <span className="font-heading text-2xl text-white leading-none tabular-nums">{value}</span>
      <span className="font-body text-xs text-neutral-400 mt-1">{label}</span>
    </div>
  );
  return (
    <StatCard title="Collection">
      <div className="flex gap-8">
        <Item value={models} label={models === 1 ? 'Model' : 'Models'} />
        <Item value={collections} label={collections === 1 ? 'Collection' : 'Collections'} />
        <Item value={games} label={games === 1 ? 'Game' : 'Games'} />
      </div>
    </StatCard>
  );
}

/** One ranked row: rank, optional game icon, name, total minis, painted %. */
function RankRow({ index, group, icon }: { index: number; group: Group; icon?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span className="w-4 shrink-0 text-right font-body text-sm text-neutral-500">{index + 1}</span>
      {icon && (
        <span className="size-6 shrink-0 rounded overflow-hidden bg-neutral-700 flex items-center justify-center">
          {group.slug && GAME_ICONS[group.slug]
            ? <img src={GAME_ICONS[group.slug]} alt="" className="w-full h-full object-cover" />
            : <Widget2 className="w-3.5 h-3.5 text-neutral-400" />}
        </span>
      )}
      <span className="flex-1 min-w-0 truncate font-body text-sm text-neutral-50">{group.name}</span>
      <span className="font-heading text-sm text-white tabular-nums">{group.total}</span>
      <span className="w-16 shrink-0 text-right font-body text-xs text-neutral-400">{pct(group.paintedRate)}% painted</span>
    </li>
  );
}

/** A numbered ranking: top 3 collapsed, "Show all" expands (paginated past 10). */
function RankedListCard({ title, groups, icon, emptyLabel }: {
  title: string; groups: Group[]; icon?: boolean; emptyLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);

  const paginated  = expanded && groups.length > RANK_PAGE;
  const totalPages = Math.max(1, Math.ceil(groups.length / RANK_PAGE));
  const safePage   = Math.min(page, totalPages - 1);
  const start      = paginated ? safePage * RANK_PAGE : 0;
  const visible    = !expanded ? groups.slice(0, 3) : paginated ? groups.slice(start, start + RANK_PAGE) : groups;

  return (
    <StatCard title={title}>
      {groups.length === 0 ? (
        <p className="font-body text-sm text-neutral-500">{emptyLabel}</p>
      ) : (
        <>
          <ol className="flex flex-col gap-1.5">
            {visible.map((g, i) => <RankRow key={g.key} index={start + i} group={g} icon={icon} />)}
          </ol>
          {paginated && <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />}
          {groups.length > 3 && (
            <button
              type="button"
              onClick={() => (expanded ? (setExpanded(false), setPage(0)) : setExpanded(true))}
              className="self-start font-body text-sm font-medium text-primary-500 hover:text-primary-400 transition-colors"
            >
              {expanded ? 'Show less' : 'Show all'}
            </button>
          )}
        </>
      )}
    </StatCard>
  );
}

/** Best + worst painted game (among games with enough minis to rank). */
function MostLeastPaintedCard({ groups }: { groups: Group[] }) {
  const ranked = rankByPainted(groups, MIN_RANKED);
  const best = ranked[0] ?? null;
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;

  const Row = ({ label, group, good }: { label: string; group: Group | null; good: boolean }) => (
    <div className="flex items-center gap-2">
      <span className="w-11 shrink-0 font-body text-xs uppercase tracking-wide text-neutral-500">{label}</span>
      {group ? (
        <>
          <span className="flex-1 min-w-0 truncate font-body text-sm text-neutral-50">{group.name}</span>
          <span className={`font-heading text-sm ${good ? 'text-green-500' : 'text-red-500'}`}>{pct(group.paintedRate)}%</span>
          <span className="w-16 shrink-0 text-right font-body text-xs text-neutral-400">{group.painted}/{group.total}</span>
        </>
      ) : (
        <span className="flex-1 font-body text-sm text-neutral-500">—</span>
      )}
    </div>
  );

  return (
    <StatCard title="Most & Least Painted">
      {ranked.length === 0 ? (
        <p className="font-body text-sm text-neutral-500">Own {MIN_RANKED}+ of a game to rank here.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Row label="Most" group={best} good />
          {worst && <Row label="Least" group={worst} good={false} />}
        </div>
      )}
    </StatCard>
  );
}

function YearCard({ rows }: { rows: YearRow[] }) {
  const max = Math.max(1, ...rows.map(r => Math.max(r.added, r.painted)));
  return (
    <StatCard title="Added & Painted by Year">
      {rows.length === 0 ? (
        <p className="font-body text-sm text-neutral-500">Add purchase or painted dates to see this.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 text-xs font-body text-neutral-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-primary-500" />Added</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" />Painted</span>
          </div>
          {rows.map(r => (
            <div key={r.year} className="flex items-center gap-2">
              <span className="w-10 shrink-0 font-body text-sm text-neutral-300 tabular-nums">{r.year}</span>
              <div className="flex-1 flex flex-col gap-0.5">
                <div className="h-2 rounded-full bg-primary-500" style={{ width: `${(r.added / max) * 100}%`, minWidth: r.added ? '0.5rem' : 0 }} />
                <div className="h-2 rounded-full bg-green-500" style={{ width: `${(r.painted / max) * 100}%`, minWidth: r.painted ? '0.5rem' : 0 }} />
              </div>
              <span className="w-16 shrink-0 text-right font-body text-xs text-neutral-400 tabular-nums">{r.added} / {r.painted}</span>
            </div>
          ))}
        </div>
      )}
    </StatCard>
  );
}

/** Shared scroll body for a stats column. */
function ColumnBody({ loading, empty, children }: { loading: boolean; empty: boolean; children: ReactNode }) {
  return (
    <div className="w-full flex-1 min-h-0 overflow-y-auto flex flex-col gap-2.5">
      {loading
        ? <p className="font-body text-sm text-neutral-500 text-center py-4">Loading…</p>
        : empty
          ? <p className="font-body text-sm text-neutral-500 text-center py-4">No models yet — add some to see your stats.</p>
          : children}
    </div>
  );
}

// ── Columns ───────────────────────────────────────────────────────────────────

function OverallColumn({ models, collectionCount, loading }: { models: StatModel[]; collectionCount: number; loading: boolean }) {
  const overall = useMemo(() => progressOf(models), [models]);
  const games = useMemo(() => rankByTotal(gameGroups(models)), [models]);
  return (
    <ColumnShell>
      <ColumnHeader icon={<ChartIcon />} title="Overall" description="Your whole collection at a glance." />
      <ColumnBody loading={loading} empty={models.length === 0}>
        <TotalsCard models={overall.total} collections={collectionCount} games={gameCount(models)} />
        <PaintingProgressCard title="Painting Progress" progress={overall} />
        <RankedListCard title="Most Collected" groups={games} icon emptyLabel="No games yet." />
      </ColumnBody>
    </ColumnShell>
  );
}

function ByGameColumn({ models, loading }: { models: StatModel[]; loading: boolean }) {
  const games = useMemo(() => rankByTotal(gameGroups(models)), [models]);
  const [gameId, setGameId] = useState<string | null>(null);
  const selected = games.find(g => g.key === gameId) ?? games[0] ?? null;

  const forGame = useMemo(
    () => (selected ? models.filter(m => (m.game?.id ?? 'none') === selected.key) : []),
    [models, selected],
  );
  const progress = useMemo(() => progressOf(forGame), [forGame]);
  const collectionsSpanned = useMemo(
    () => new Set(forGame.flatMap(m => m.boxes.map(b => b.id))).size,
    [forGame],
  );

  return (
    <ColumnShell>
      <ColumnHeader icon={<GameIcon />} title="By Game" description="Painting progress for one game." />
      <ColumnBody loading={loading} empty={models.length === 0}>
        <Select
          aria-label="Game"
          value={selected?.key ?? ''}
          onChange={e => setGameId(e.target.value)}
          options={games.map(g => ({ value: g.key, label: `${g.name} (${g.total})` }))}
        />
        {selected && (
          <>
            <TotalsCard models={progress.total} collections={collectionsSpanned} games={1} />
            <PaintingProgressCard title="Painting Progress" progress={progress} />
          </>
        )}
      </ColumnBody>
    </ColumnShell>
  );
}

function HighlightsColumn({ models, loading }: { models: StatModel[]; loading: boolean }) {
  const games = useMemo(() => gameGroups(models), [models]);
  const collections = useMemo(() => rankByTotal(collectionGroups(models)), [models]);
  const years = useMemo(() => purchaseByYear(models), [models]);
  return (
    <ColumnShell>
      <ColumnHeader icon={<StarIcon />} title="Highlights" description="Standouts across your collection." />
      <ColumnBody loading={loading} empty={models.length === 0}>
        <MostLeastPaintedCard groups={games} />
        <RankedListCard title="Biggest Collections" groups={collections} emptyLabel="No collections yet." />
        <YearCard rows={years} />
      </ColumnBody>
    </ColumnShell>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CollectionStatsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null));
  }, []);

  const { models, collectionCount, loading } = useCollectionStats(userId);

  return (
    <div className="h-dvh overflow-hidden flex flex-col bg-neutral-950">
      <AppNavbar fixed={false} logo={<BattleBenchLogo />} breadcrumbs={[{ label: 'Home', href: '/app' }, { label: 'Stats' }]} />

      <main className="flex flex-1 min-h-0 items-stretch pt-3 md:pt-9 lg:px-9 w-full">
        <div className="flex flex-1 min-h-0 items-stretch gap-2.5 overflow-x-auto snap-x snap-mandatory lg:overflow-x-visible lg:snap-none lg:justify-center px-3 md:px-9 py-2 scroll-px-3 md:scroll-px-9 lg:p-0">
          <OverallColumn    models={models} collectionCount={collectionCount} loading={loading} />
          <ByGameColumn     models={models} loading={loading} />
          <HighlightsColumn models={models} loading={loading} />
        </div>
      </main>

      <AppFooter className="shrink-0" appName="BattleBench" version={__APP_VERSION__} buildDate={__APP_BUILD_DATE__} />
    </div>
  );
}
