/**
 * battleStats.ts — Pure aggregation over a user's battles for the stats page.
 *
 * Everything here is deterministic and side-effect free so it's easy to reason
 * about and reuse. Rankings use win rate with a minimum sample size so a lucky
 * one-off doesn't top the charts.
 */

export type BattleResult = 'won' | 'lost' | 'drew';

/** The slim battle shape the stats page needs (no photos/notes). */
export interface StatBattle {
  id:            number;
  result:        BattleResult;
  date_played:   string;
  location_name: string | null;
  game:          { id: string; name: string; slug: string; supported: boolean } | null;
  /** The battle's opponents, as objects (multiplayer-aware). */
  opponents:     { id: string; name: string }[];
}

/** A win/loss/draw tally with a derived win rate (0–1 over all games played). */
export interface WinRecord {
  played:  number;
  won:     number;
  lost:    number;
  drew:    number;
  winRate: number;
}

/** A named group (game / location / opponent) with its record. */
export interface GroupStat extends WinRecord {
  key:   string;
  name:  string;
  /** Game slug, for the icon — only set on game groups. */
  slug?: string;
}

/** A game/location/opponent needs at least this many battles to be ranked. */
export const MIN_RANKED_BATTLES = 3;

export function toRecord(battles: StatBattle[]): WinRecord {
  let won = 0, lost = 0, drew = 0;
  for (const b of battles) {
    if (b.result === 'won') won++;
    else if (b.result === 'lost') lost++;
    else drew++;
  }
  const played = battles.length;
  return { played, won, lost, drew, winRate: played ? won / played : 0 };
}

/**
 * Group battles by a key and compute each group's record. Battles with a null
 * key (e.g. no venue) are skipped.
 */
export function groupStats(
  battles: StatBattle[],
  keyFn:  (b: StatBattle) => string | null,
  nameFn: (b: StatBattle) => string,
  slugFn?: (b: StatBattle) => string | undefined,
): GroupStat[] {
  const groups = new Map<string, StatBattle[]>();
  for (const b of battles) {
    const k = keyFn(b);
    if (!k) continue;
    const arr = groups.get(k);
    if (arr) arr.push(b);
    else groups.set(k, [b]);
  }
  return [...groups.values()].map(bs => ({
    key:  keyFn(bs[0]) as string,
    name: nameFn(bs[0]),
    slug: slugFn?.(bs[0]),
    ...toRecord(bs),
  }));
}

// ── Standard groupings ────────────────────────────────────────────────────────

export const gameGroups = (battles: StatBattle[]) =>
  groupStats(battles, b => b.game?.id ?? null, b => b.game?.name ?? 'Unknown game', b => b.game?.slug);

export const locationGroups = (battles: StatBattle[]) =>
  groupStats(battles, b => b.location_name?.trim() || null, b => b.location_name!.trim());

/**
 * One GroupStat per opponent. Unlike games/locations a battle can have several
 * opponents, so each battle counts once toward every opponent it involved (with
 * the same win/loss from the owner's perspective).
 */
export function opponentGroups(battles: StatBattle[]): GroupStat[] {
  const map = new Map<string, { name: string; battles: StatBattle[] }>();
  for (const b of battles) {
    for (const opp of b.opponents) {
      const g = map.get(opp.id);
      if (g) g.battles.push(b);
      else map.set(opp.id, { name: opp.name, battles: [b] });
    }
  }
  return [...map.entries()].map(([key, { name, battles: bs }]) => ({ key, name, ...toRecord(bs) }));
}

// ── Ranking ───────────────────────────────────────────────────────────────────

const byWinRateDesc = (a: GroupStat, b: GroupStat) =>
  b.winRate - a.winRate || b.played - a.played || a.name.localeCompare(b.name);
const byWinRateAsc = (a: GroupStat, b: GroupStat) =>
  a.winRate - b.winRate || b.played - a.played || a.name.localeCompare(b.name);

/** Groups by win rate (best first), among those played at least `min` times. */
export function rankBest(groups: GroupStat[], n = Infinity, min = MIN_RANKED_BATTLES): GroupStat[] {
  return groups.filter(g => g.played >= min).sort(byWinRateDesc).slice(0, n);
}

/** Groups by win rate (worst first), among those played at least `min` times. */
export function rankWorst(groups: GroupStat[], n = Infinity, min = MIN_RANKED_BATTLES): GroupStat[] {
  return groups.filter(g => g.played >= min).sort(byWinRateAsc).slice(0, n);
}

/** Groups by battle count (most played first) — no minimum. */
export function rankMostPlayed(groups: GroupStat[], n = Infinity): GroupStat[] {
  return [...groups]
    .sort((a, b) => b.played - a.played || b.winRate - a.winRate || a.name.localeCompare(b.name))
    .slice(0, n);
}

/** Single best group by win rate (no minimum) — for per-game breakdowns. */
export function bestOf(groups: GroupStat[]): GroupStat | null {
  return groups.length ? [...groups].sort(byWinRateDesc)[0] : null;
}

/** Single worst group by win rate (no minimum) — for per-game breakdowns. */
export function worstOf(groups: GroupStat[]): GroupStat | null {
  return groups.length ? [...groups].sort(byWinRateAsc)[0] : null;
}

/** Games sorted by how often they've been played (drives the Col 2 dropdown). */
export function gamesByPlayed(battles: StatBattle[]): GroupStat[] {
  return gameGroups(battles).sort((a, b) => b.played - a.played || a.name.localeCompare(b.name));
}

// ── Streaks ───────────────────────────────────────────────────────────────────

/**
 * Win streaks over a set of battles. `current` is the run of consecutive wins
 * ending at the most recent battle (0 if the latest wasn't a win); `longest` is
 * the best such run ever. A loss or draw breaks a streak.
 */
export function winStreak(battles: StatBattle[]): { current: number; longest: number } {
  const chron = [...battles].sort((a, b) => a.date_played.localeCompare(b.date_played) || a.id - b.id);
  let longest = 0, run = 0;
  for (const b of chron) {
    if (b.result === 'won') { run++; longest = Math.max(longest, run); }
    else run = 0;
  }
  let current = 0;
  for (let i = chron.length - 1; i >= 0; i--) {
    if (chron[i].result === 'won') current++;
    else break;
  }
  return { current, longest };
}

// ── Time ranges ───────────────────────────────────────────────────────────────

export type TimeRange = 'all' | '3m' | '6m' | 'year';

/** yyyy-mm-dd for `n` months before today (lexically comparable with date_played). */
function monthsAgoIso(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

/** Filter battles to a time range. `year` is required only for range === 'year'. */
export function filterByRange(battles: StatBattle[], range: TimeRange, year?: number): StatBattle[] {
  if (range === 'all') return battles;
  if (range === 'year') return year == null ? battles : battles.filter(b => Number(b.date_played.slice(0, 4)) === year);
  const cutoff = monthsAgoIso(range === '3m' ? 3 : 6);
  return battles.filter(b => b.date_played >= cutoff);
}

/** Distinct years that have battles, most recent first. */
export function battleYears(battles: StatBattle[]): number[] {
  return [...new Set(battles.map(b => Number(b.date_played.slice(0, 4))))].sort((a, b) => b - a);
}
