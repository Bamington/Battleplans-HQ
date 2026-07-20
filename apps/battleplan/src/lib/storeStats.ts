/**
 * storeStats.ts — Aggregations behind the Store Stats page (/app/store-stats).
 *
 * Built entirely from a venue's own BOOKINGS, not battles: battles are
 * owner-scoped by RLS (a store can't read them, and shouldn't), and only a
 * fraction of players log them. Bookings are the store's complete record.
 *
 * That means these numbers describe tables BOOKED, not games confirmed played —
 * cancellations delete their row so they self-exclude, but a no-show still
 * counts. The UI should say "booked" rather than "played".
 *
 * Pure functions only, so they're easy to reason about and test.
 */

import type { TimeRange } from './battleStats';

export interface StoreBooking {
  id:         string;
  date:       string;                    // YYYY-MM-DD
  user_id:    string | null;
  user_name:  string | null;             // free text, typed per booking
  user_email: string | null;             // the booking account's email
  game:       { id: string; name: string; slug: string } | null;
  timeslot:   { id: string; name: string; start_time: string } | null;
}

/** One row of a ranked list: a label and how many bookings it accounts for. */
export interface CountStat {
  key:   string;
  label: string;
  count: number;
  /** Secondary line under the label (an account's email). */
  sublabel?: string;
  /** Game slug, when the row represents a game (so the UI can show artwork). */
  slug?: string;
}

export const NO_GAME_KEY = '__no_game__';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Parse YYYY-MM-DD as local time (avoids the UTC shift new Date(iso) applies). */
function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function byCountDesc(a: CountStat, b: CountStat): number {
  return b.count - a.count || a.label.localeCompare(b.label);
}

// ── Time range ────────────────────────────────────────────────────────────────

/** Years present in the data, newest first — drives the "By year" picker. */
export function bookingYears(bookings: StoreBooking[]): number[] {
  const years = new Set(bookings.map(b => Number(b.date.slice(0, 4))));
  return [...years].filter(Boolean).sort((a, b) => b - a);
}

/** Same range semantics as the player stats page, applied to a booking's date. */
export function filterBookingsByRange(
  bookings: StoreBooking[],
  range: TimeRange,
  year?: number,
): StoreBooking[] {
  if (range === 'all') return bookings;

  if (range === 'year') {
    if (year == null) return bookings;
    return bookings.filter(b => Number(b.date.slice(0, 4)) === year);
  }

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setMonth(cutoff.getMonth() - (range === '3m' ? 3 : 6));
  return bookings.filter(b => parseLocal(b.date) >= cutoff);
}

// ── Headline totals ───────────────────────────────────────────────────────────

export interface StoreTotals {
  bookings:  number;
  /** Distinct booking accounts. Staff booking for walk-ins counts once. */
  customers: number;
  /** Bookings with no game recorded — the games list only covers the rest. */
  missingGame: number;
}

export function storeTotals(bookings: StoreBooking[]): StoreTotals {
  return {
    bookings:    bookings.length,
    customers:   new Set(bookings.map(b => b.user_id).filter(Boolean)).size,
    missingGame: bookings.filter(b => !b.game).length,
  };
}

// ── Rankings ──────────────────────────────────────────────────────────────────

/**
 * Games ranked by bookings. Bookings with no game are kept as their own row so
 * the list still reconciles with the venue's total booking count.
 */
export function gameCounts(bookings: StoreBooking[]): CountStat[] {
  const m = new Map<string, CountStat>();
  for (const b of bookings) {
    const key = b.game?.id ?? NO_GAME_KEY;
    const row = m.get(key) ?? {
      key,
      label: b.game?.name ?? 'No game recorded',
      count: 0,
      slug:  b.game?.slug,
    };
    row.count++;
    m.set(key, row);
  }
  return [...m.values()].sort(byCountDesc);
}

/** Busiest weekdays. Always returns all seven, so quiet days are visible too. */
export function weekdayCounts(bookings: StoreBooking[]): CountStat[] {
  const counts = new Map<string, number>(DAY_NAMES.map(d => [d, 0]));
  for (const b of bookings) {
    const day = DAY_NAMES[parseLocal(b.date).getDay()];
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ key: label, label, count }))
    .sort(byCountDesc);
}

/** Busiest timeslots, labelled "Evening (18:00)". */
export function timeslotCounts(bookings: StoreBooking[]): CountStat[] {
  const m = new Map<string, CountStat>();
  for (const b of bookings) {
    if (!b.timeslot) continue;
    const key   = b.timeslot.id;
    const start = b.timeslot.start_time?.slice(0, 5);
    const row   = m.get(key) ?? {
      key,
      label: start ? `${b.timeslot.name} (${start})` : b.timeslot.name,
      count: 0,
    };
    row.count++;
    m.set(key, row);
  }
  return [...m.values()].sort(byCountDesc);
}

/**
 * Most frequent bookers, grouped by ACCOUNT.
 *
 * `user_name` is free text typed per booking ("who's this table for"), so it
 * can't identify anyone: one account here used 36 different names, and a name
 * like "Jack" spans three accounts. Grouping by `user_id` is the only stable
 * key — and since a store admin can't read other users' profiles, we label each
 * account with the name it used MOST often. For regulars that's near-unanimous
 * (31/31 "Ryan"); for the venue's own staff account it surfaces as "staff",
 * which is honest about what that row really is.
 */
export function customerCounts(bookings: StoreBooking[]): CountStat[] {
  const acc = new Map<string, { count: number; names: Tally; emails: Tally }>();
  for (const b of bookings) {
    if (!b.user_id) continue;
    const e = acc.get(b.user_id) ?? { count: 0, names: new Map(), emails: new Map() };
    e.count++;
    bump(e.names,  b.user_name);
    bump(e.emails, b.user_email);
    acc.set(b.user_id, e);
  }

  return [...acc.entries()]
    .map(([key, e]) => ({
      key,
      label:    mostUsed(e.names) ?? 'Unknown',
      // Unlike the name, an account's email is stable — it's the account's own,
      // not per-booking free text — so it's the reliable way to tell two
      // similarly-named regulars apart.
      sublabel: mostUsed(e.emails) ?? undefined,
      count:    e.count,
    }))
    .sort(byCountDesc);
}

type Tally = Map<string, number>;

function bump(tally: Tally, value: string | null | undefined): void {
  const v = value?.trim();
  if (v) tally.set(v, (tally.get(v) ?? 0) + 1);
}

/** The value a tally saw most often; ties broken alphabetically for stability. */
function mostUsed(tally: Tally): string | undefined {
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

// ── Trend ─────────────────────────────────────────────────────────────────────

export interface MonthPoint { month: string; label: string; count: number }

/** Bookings per calendar month, oldest first, with empty months filled in. */
export function monthlyTrend(bookings: StoreBooking[]): MonthPoint[] {
  if (bookings.length === 0) return [];

  const counts = new Map<string, number>();
  for (const b of bookings) {
    const month = b.date.slice(0, 7);            // YYYY-MM
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }

  const months = [...counts.keys()].sort();
  const [startY, startM] = months[0].split('-').map(Number);
  const [endY,   endM]   = months[months.length - 1].split('-').map(Number);

  const out: MonthPoint[] = [];
  for (let y = startY, m = startM; y < endY || (y === endY && m <= endM); m === 12 ? (m = 1, y++) : m++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    out.push({
      month: key,
      label: `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]} ${String(y).slice(2)}`,
      count: counts.get(key) ?? 0,
    });
  }
  return out;
}
