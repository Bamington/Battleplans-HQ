/**
 * BattleStatsPage.tsx — Full breakdown of the user's battle record (/app/stats).
 *
 * Three columns, reusing the shared ColumnShell frame (each body scrolls):
 *   1. Overall     — a time-range filter (All / 3m / 6m / by year) over the
 *                    win/loss record + most-played games / venues / opponents.
 *   2. By game     — a game picker (default: most played) + that game's record,
 *                    best/worst opponent & location, and win streak.
 *   3. Best & Worst — best & worst games / opponents / locations (win rate,
 *                    ranked among things played MIN_RANKED_BATTLES+ times).
 *
 * Numbered-list cards show the top 3 with a "Show all" toggle (up to 10). All
 * maths lives in ../lib/battleStats; this file is presentation only.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase, AppFooter, Select, Pagination, ColumnShell, ColumnHeader, Widget2 } from '@battleplans/ui';
import AppNavbar from '../components/AppNavbar';
import { GAME_ICONS } from '../components/gameIcons';
import { useBattleStats } from '../hooks/useBattleStats';
import {
  toRecord, gameGroups, locationGroups, opponentGroups,
  rankBest, rankWorst, rankMostPlayed, bestOf, worstOf,
  gamesByPlayed, winStreak, filterByRange, battleYears,
  type StatBattle, type WinRecord, type GroupStat, type TimeRange,
} from '../lib/battleStats';

declare const __APP_VERSION__: string;
declare const __APP_BUILD_DATE__: string;

const pct = (r: number) => Math.round(r * 100);

const BattlePlanLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattlePlan</span>
);

// ── Column icons ──────────────────────────────────────────────────────────────

const TrophyIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 8h20v9a10 10 0 01-20 0V8Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="M14 12H8v3a6 6 0 006 6M34 12h6v3a6 6 0 01-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M24 27v6M18 40l1.5-7h9L30 40H18Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
  </svg>
);

const DiceIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="8" width="32" height="32" rx="5" stroke="currentColor" strokeWidth="2.5"/>
    <circle cx="17" cy="17" r="2.4" fill="currentColor"/><circle cx="31" cy="17" r="2.4" fill="currentColor"/>
    <circle cx="24" cy="24" r="2.4" fill="currentColor"/>
    <circle cx="17" cy="31" r="2.4" fill="currentColor"/><circle cx="31" cy="31" r="2.4" fill="currentColor"/>
  </svg>
);

const BestWorstIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 34V14M16 14l-6 6M16 14l6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M32 14v20M32 34l-6-6M32 34l6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
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

/** A green/grey/red bar showing the win / draw / loss split. */
function RecordBar({ record }: { record: WinRecord }) {
  const { won, drew, lost, played } = record;
  const w = played ? (won / played) * 100 : 0;
  const d = played ? (drew / played) * 100 : 0;
  const l = played ? (lost / played) * 100 : 0;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-neutral-700">
      <div className="bg-green-500"   style={{ width: `${w}%` }} />
      <div className="bg-neutral-500" style={{ width: `${d}%` }} />
      <div className="bg-red-500"     style={{ width: `${l}%` }} />
    </div>
  );
}

function WinLossCard({ title, record }: { title: string; record: WinRecord }) {
  return (
    <StatCard title={title}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-heading text-2xl text-white leading-none">{pct(record.winRate)}%</span>
        <span className="font-body text-sm text-neutral-400">
          {record.won}–{record.lost}–{record.drew} · {record.played} {record.played === 1 ? 'battle' : 'battles'}
        </span>
      </div>
      <RecordBar record={record} />
    </StatCard>
  );
}

type RankMetric = 'winRate' | 'played';

/** One ranked row: rank, optional game icon, name, primary metric, record. */
function RankRow({ index, group, icon, metric }: { index: number; group: GroupStat; icon?: boolean; metric: RankMetric }) {
  const primary = metric === 'played' ? `${group.played}` : `${pct(group.winRate)}%`;
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
      <span className="font-heading text-sm text-white">{primary}</span>
      <span className="w-14 shrink-0 text-right font-body text-xs text-neutral-400">{group.won}–{group.lost}–{group.drew}</span>
    </li>
  );
}

/** How many ranked rows per page once a list is expanded. */
const RANK_PAGE = 10;

/**
 * A numbered ranking. Collapsed it shows the top 3; "Show all" expands the full
 * list, and once expanded a list longer than {@link RANK_PAGE} paginates.
 */
function RankedListCard({ title, groups, icon, metric = 'winRate', emptyLabel = 'Play 3+ times to rank here.' }: {
  title: string; groups: GroupStat[]; icon?: boolean; metric?: RankMetric; emptyLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);

  const paginated  = expanded && groups.length > RANK_PAGE;
  const totalPages = Math.max(1, Math.ceil(groups.length / RANK_PAGE));
  const safePage   = Math.min(page, totalPages - 1);
  const start      = paginated ? safePage * RANK_PAGE : 0;
  const visible    = !expanded ? groups.slice(0, 3)
    : paginated ? groups.slice(start, start + RANK_PAGE)
    : groups;

  const collapse = () => { setExpanded(false); setPage(0); };

  return (
    <StatCard title={title}>
      {groups.length === 0 ? (
        <p className="font-body text-sm text-neutral-500">{emptyLabel}</p>
      ) : (
        <>
          <ol className="flex flex-col gap-1.5">
            {visible.map((g, i) => <RankRow key={g.key} index={start + i} group={g} icon={icon} metric={metric} />)}
          </ol>
          {paginated && <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />}
          {groups.length > 3 && (
            <button
              type="button"
              onClick={() => (expanded ? collapse() : setExpanded(true))}
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

/** A best + worst pair (per-game opponent / location breakdown). */
function BestWorstCard({ title, groups }: { title: string; groups: GroupStat[] }) {
  const best  = bestOf(groups);
  const worst = worstOf(groups);
  const onlyOne = best && worst && best.key === worst.key;

  const Row = ({ label, group, good }: { label: string; group: GroupStat | null; good: boolean }) => (
    <div className="flex items-center gap-2">
      <span className="w-11 shrink-0 font-body text-xs uppercase tracking-wide text-neutral-500">{label}</span>
      {group ? (
        <>
          <span className="flex-1 min-w-0 truncate font-body text-sm text-neutral-50">{group.name}</span>
          <span className={`font-heading text-sm ${good ? 'text-green-500' : 'text-red-500'}`}>{pct(group.winRate)}%</span>
          <span className="w-14 shrink-0 text-right font-body text-xs text-neutral-400">{group.won}–{group.lost}–{group.drew}</span>
        </>
      ) : (
        <span className="flex-1 font-body text-sm text-neutral-500">—</span>
      )}
    </div>
  );

  return (
    <StatCard title={title}>
      {groups.length === 0 ? (
        <p className="font-body text-sm text-neutral-500">None recorded for this game yet.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Row label="Best" group={best} good />
          {!onlyOne && <Row label="Worst" group={worst} good={false} />}
        </div>
      )}
    </StatCard>
  );
}

function StreakCard({ streak }: { streak: { current: number; longest: number } }) {
  return (
    <StatCard title="Win Streak">
      <div className="flex gap-8">
        <div className="flex flex-col">
          <span className="font-heading text-2xl text-white leading-none">{streak.current}</span>
          <span className="font-body text-xs text-neutral-400 mt-1">Current</span>
        </div>
        <div className="flex flex-col">
          <span className="font-heading text-2xl text-white leading-none">{streak.longest}</span>
          <span className="font-body text-xs text-neutral-400 mt-1">Longest</span>
        </div>
      </div>
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
          ? <p className="font-body text-sm text-neutral-500 text-center py-4">No battles recorded yet.</p>
          : children}
    </div>
  );
}

// ── Columns ───────────────────────────────────────────────────────────────────

function OverallColumn({ battles, loading }: { battles: StatBattle[]; loading: boolean }) {
  const [range, setRange] = useState<TimeRange>('all');
  const years = useMemo(() => battleYears(battles), [battles]);
  const [year, setYear] = useState<number | null>(null);

  // Default / keep the year valid whenever "By Year" is active.
  useEffect(() => {
    if (range === 'year' && years.length && (year == null || !years.includes(year))) setYear(years[0]);
  }, [range, years, year]);

  const filtered = useMemo(() => filterByRange(battles, range, year ?? undefined), [battles, range, year]);

  return (
    <ColumnShell>
      <ColumnHeader icon={<TrophyIcon />} title="Overall" description="Your record across every battle." />

      {!loading && battles.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          <Select
            label="Time range"
            value={range}
            onChange={e => setRange(e.target.value as TimeRange)}
            options={[
              { value: 'all',  label: 'All Time' },
              { value: '3m',   label: 'Last 3 Months' },
              { value: '6m',   label: 'Last 6 Months' },
              { value: 'year', label: 'By Year' },
            ]}
          />
          {range === 'year' && years.length > 0 && (
            <Select
              label="Year"
              value={year != null ? String(year) : ''}
              onChange={e => setYear(Number(e.target.value))}
              options={years.map(y => ({ value: String(y), label: String(y) }))}
            />
          )}
        </div>
      )}

      <ColumnBody loading={loading} empty={battles.length === 0}>
        <WinLossCard title="Win / Loss" record={toRecord(filtered)} />
        <RankedListCard title="Most Played Games"     groups={rankMostPlayed(gameGroups(filtered))}     icon metric="played" emptyLabel="No games in this range." />
        <RankedListCard title="Most Played Venues"    groups={rankMostPlayed(locationGroups(filtered))}      metric="played" emptyLabel="No venues in this range." />
        <RankedListCard title="Most Played Opponents" groups={rankMostPlayed(opponentGroups(filtered))}      metric="played" emptyLabel="No opponents in this range." />
      </ColumnBody>
    </ColumnShell>
  );
}

function PerGameColumn({ battles, loading }: { battles: StatBattle[]; loading: boolean }) {
  const games = useMemo(() => gamesByPlayed(battles), [battles]);
  const [gameKey, setGameKey] = useState('');

  // Default to (and stay valid against) the most-played game.
  useEffect(() => {
    if (games.length && !games.some(g => g.key === gameKey)) setGameKey(games[0].key);
  }, [games, gameKey]);

  const gameBattles = useMemo(() => battles.filter(b => b.game?.id === gameKey), [battles, gameKey]);
  const selected = games.find(g => g.key === gameKey);

  return (
    <ColumnShell>
      <ColumnHeader icon={<DiceIcon />} title="By Game" description="Pick a game to break down your record." />
      {!loading && games.length > 0 && (
        <Select
          label="Game"
          value={gameKey}
          onChange={e => setGameKey(e.target.value)}
          options={games.map(g => ({ value: g.key, label: `${g.name} (${g.played})` }))}
        />
      )}
      <ColumnBody loading={loading} empty={games.length === 0}>
        <WinLossCard title={`${selected?.name ?? 'Game'} Record`} record={toRecord(gameBattles)} />
        <BestWorstCard title="Opponents" groups={opponentGroups(gameBattles)} />
        <BestWorstCard title="Locations" groups={locationGroups(gameBattles)} />
        <StreakCard streak={winStreak(gameBattles)} />
      </ColumnBody>
    </ColumnShell>
  );
}

function BestWorstColumn({ battles, loading }: { battles: StatBattle[]; loading: boolean }) {
  const [scope, setScope] = useState<'all' | 'supported'>('all');
  const scoped = useMemo(
    () => (scope === 'supported' ? battles.filter(b => b.game?.supported) : battles),
    [battles, scope],
  );
  const games = gameGroups(scoped);
  const opps  = opponentGroups(scoped);
  const locs  = locationGroups(scoped);
  return (
    <ColumnShell>
      <ColumnHeader icon={<BestWorstIcon />} title="Best & Worst" description="Where you shine and where you struggle." />
      {!loading && battles.length > 0 && (
        <Select
          label="Games"
          value={scope}
          onChange={e => setScope(e.target.value as 'all' | 'supported')}
          options={[
            { value: 'all',       label: 'All Games' },
            { value: 'supported', label: 'Supported Games' },
          ]}
        />
      )}
      <ColumnBody loading={loading} empty={battles.length === 0}>
        <RankedListCard title="Best Games"      groups={rankBest(games)}  icon />
        <RankedListCard title="Worst Games"     groups={rankWorst(games)} icon />
        <RankedListCard title="Best Opponents"  groups={rankBest(opps)} />
        <RankedListCard title="Worst Opponents" groups={rankWorst(opps)} />
        <RankedListCard title="Best Locations"  groups={rankBest(locs)} />
        <RankedListCard title="Worst Locations" groups={rankWorst(locs)} />
      </ColumnBody>
    </ColumnShell>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BattleStatsPage() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  const { battles, loading } = useBattleStats(userId);

  return (
    <div className="h-dvh overflow-hidden flex flex-col bg-neutral-950">

      <AppNavbar fixed={false} logo={<BattlePlanLogo />} />

      <main className="flex flex-1 min-h-0 items-stretch pt-3 md:pt-9 lg:px-9 w-full">
        <div className="flex flex-1 min-h-0 items-stretch gap-2.5 overflow-x-auto snap-x snap-mandatory lg:overflow-x-visible lg:snap-none lg:justify-center px-3 md:px-9 py-2 scroll-px-3 md:scroll-px-9 lg:p-0">
          <OverallColumn  battles={battles} loading={loading} />
          <PerGameColumn  battles={battles} loading={loading} />
          <BestWorstColumn battles={battles} loading={loading} />
        </div>
      </main>

      <AppFooter className="shrink-0" appName="BattlePlan" version={__APP_VERSION__} buildDate={__APP_BUILD_DATE__} />

    </div>
  );
}
