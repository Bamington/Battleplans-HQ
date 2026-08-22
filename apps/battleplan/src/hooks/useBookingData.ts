import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@battleplans/ui';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Game {
  id:   string;
  name: string;
  slug: string;
}

/**
 * What a location row is — see 20260814020000.
 *
 * 'venue' is a shop: listed publicly, has an address. 'club' is a group of
 * people with no address of its own. 'space' is a borrowed room, never public
 * and never offered in a picker.
 */
export type LocationKind = 'venue' | 'club' | 'space';

export interface Location {
  id:   string;
  name: string;
  icon: string;
  /** Absent on older reads that predate the column being selected. */
  kind?: LocationKind;
}

/**
 * The word for this kind of organisation, in the reader's terms.
 *
 * The store view serves both a shop and a club, and calling a club's page
 * "Manage Store" is the sort of thing that makes software feel like it was not
 * built for you. Copy that interpolates the location's own NAME needs none of
 * this — "bookings at Warhammer Club" already reads correctly — so this is only
 * for the places where the word stands on its own.
 *
 * Spaces fall through to 'venue' and never reach any of that copy: they have no
 * store view, no staff and no stats.
 */
export function orgNoun(kind: LocationKind | undefined): 'club' | 'venue' {
  return kind === 'club' ? 'club' : 'venue';
}

/** Same word, capitalised — for a button or the start of a sentence. */
export function orgNounTitle(kind: LocationKind | undefined): 'Club' | 'Venue' {
  return kind === 'club' ? 'Club' : 'Venue';
}

export interface Timeslot {
  id:         string;
  name:       string;
  start_time: string;
  end_time:   string;
}

export interface Booking {
  id:        string;
  date:      string;
  user_name: string | null;
  /** Whose booking it is. Null for a guest the venue booked in. */
  user_id:            string | null;
  /** Who took the booking. Differs from user_id when a venue booked for someone. */
  created_by_user_id: string | null;
  game:      { id: string; name: string; slug: string } | null;
  location:  { id: string; name: string; address: string | null };
  timeslot:  { id: string; name: string; start_time: string; end_time: string };
}

// Raw booking row as selected from Supabase: the per-booking snapshot columns
// plus the live joins (kept as a fallback).
interface RawBookingRow {
  id:                   string;
  date:                 string;
  user_name:            string | null;
  user_id:              string | null;
  created_by_user_id:   string | null;
  location_id:          string | null;
  timeslot_id:          string | null;
  location_name:        string | null;
  timeslot_name:        string | null;
  timeslot_start_time:  string | null;
  timeslot_end_time:    string | null;
  game:      { id: string; name: string; slug: string } | null;
  location:  { id: string; name: string; address: string | null } | null;
  timeslot:  { id: string; name: string; start_time: string; end_time: string } | null;
}

// Columns to select for a displayable booking: the snapshot columns first, then
// the live joins as a fallback for rows that predate the snapshot.
const BOOKING_SELECT = `
  id, date, user_name, user_id, created_by_user_id, location_id, timeslot_id,
  location_name, timeslot_name, timeslot_start_time, timeslot_end_time,
  game:game_catalogue(id, name, slug),
  location:locations(id, name, address),
  timeslot:timeslots(id, name, start_time, end_time)
`;

// Build a Booking, preferring the point-in-time snapshot captured on the booking
// over the live joined location/timeslot — so later edits to a location or
// timeslot don't rewrite what a historical booking shows.
function mapBookingRow(r: RawBookingRow): Booking {
  return {
    id:        r.id,
    date:      r.date,
    user_name: r.user_name,
    user_id:            r.user_id ?? null,
    created_by_user_id: r.created_by_user_id ?? null,
    game:      r.game ?? null,
    location: {
      id:      r.location?.id ?? r.location_id ?? '',
      name:    r.location_name ?? r.location?.name ?? '',
      address: r.location?.address ?? null,
    },
    timeslot: {
      id:         r.timeslot?.id ?? r.timeslot_id ?? '',
      name:       r.timeslot_name       ?? r.timeslot?.name       ?? '',
      start_time: r.timeslot_start_time ?? r.timeslot?.start_time ?? '',
      end_time:   r.timeslot_end_time   ?? r.timeslot?.end_time   ?? '',
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseDateLocal(iso: string): Date {
  // Avoid UTC shift by treating the date string as local time
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateLabel(iso: string): string {
  const d = parseDateLocal(iso);
  const day  = DAY_NAMES[d.getDay()];
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yy   = String(d.getFullYear()).slice(2);
  return `${day} ${dd}/${mm}/${yy}`;
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatTimeslotLabel(ts: Timeslot): string {
  return `${formatTime(ts.start_time)} – ${formatTime(ts.end_time)}`;
}

export function formatBookingTime(ts: { start_time: string; end_time: string }): string {
  return `${formatTime(ts.start_time)} – ${formatTime(ts.end_time)}`;
}

// ── useGames ──────────────────────────────────────────────────────────────────

export function useGames() {
  const [games,   setGames]   = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // game_catalogue, not `games`: the base table is gated by BattleCards'
    // draft/beta/published content flag, which left non-admins picking from 4
    // games instead of 99. Booking a table doesn't care whether anyone has
    // authored cards for the game. See 20260725010000_game_catalogue.
    supabase
      .from('game_catalogue')
      .select('id, name, slug')
      .eq('enabled_battleplan', true)
      .order('name')
      .then(({ data }) => {
        setGames(data ?? []);
        setLoading(false);
      });
  }, []);

  return { games, loading };
}

// ── useAllGames ───────────────────────────────────────────────────────────────
// Games available in the battle-logging picker: every supported game, plus any
// unsupported ones the current user created themselves (e.g. board games they
// imported from a personal tracker). This is broader than `useGames`'
// enabled_battleplan filter (bookings) but narrower than the whole catalogue, so
// unsupported games other users created don't clutter everyone's picker.

export function useAllGames(userId?: string | null) {
  const [games,   setGames]   = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Same reason as useGames: read the catalogue, not the content-gated table.
    const base = supabase.from('game_catalogue').select('id, name, slug');
    const query = userId
      ? base.or(`supported.eq.true,created_by.eq.${userId}`)
      : base.eq('supported', true);
    query.order('name').then(({ data }) => {
      setGames(data ?? []);
      setLoading(false);
    });
  }, [userId]);

  return { games, loading };
}

// ── useRecentBookedGames ──────────────────────────────────────────────────────
// The games this user has booked most recently, newest first and de-duplicated.
// Drives two things in the New Booking modal: pre-selecting the game they last
// booked, and floating their recent games to the top of the picker.

/** How much booking history to scan to find `limit` distinct games. */
const RECENT_SCAN_ROWS = 50;

export function useRecentBookedGames(userId: string | null, limit = 5) {
  const [gameIds, setGameIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setGameIds([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    supabase
      .from('bookings')
      .select('game_id, date')
      .eq('user_id', userId)
      .not('game_id', 'is', null)
      .order('date', { ascending: false })
      .limit(RECENT_SCAN_ROWS)
      .then(({ data }) => {
        if (cancelled) return;
        const seen: string[] = [];
        for (const row of (data as { game_id: string }[] | null) ?? []) {
          if (!seen.includes(row.game_id)) seen.push(row.game_id);
          if (seen.length >= limit) break;
        }
        setGameIds(seen);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId, limit]);

  return { gameIds, loading };
}

// ── useLocations ──────────────────────────────────────────────────────────────

export function useLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    supabase
      .from('locations')
      .select('id, name, icon, kind')
      // Spaces are never offered: a room a club borrows is where a booking
      // happens, not something a player picks from a list. RLS won't do that
      // for us, because whoever created the space CAN read it.
      //
      // Clubs ARE offered, and RLS decides which ones. A club is readable by
      // the people attached to it — its admins, organisers and members — and by
      // nobody else, so a member finds their club here and a stranger does not
      // see it exists. Browsing clubs to ask to join is a separate thing.
      .neq('kind', 'space')
      .order('name')
      .then(({ data }) => {
        setLocations(data ?? []);
        setLoading(false);
      });
  }, []);

  return { locations, loading };
}

// ── useUserProfile ────────────────────────────────────────────────────────────
// Returns the user's onboarding profile — chosen username and preferred booking
// location — captured during onboarding. Used to pre-fill a new booking.

export interface UserProfile {
  username: string | null;
  preferredLocationId: string | null;
}

export function useUserProfile(userId: string | null) {
  const [profile, setProfile] = useState<UserProfile>({ username: null, preferredLocationId: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setProfile({ username: null, preferredLocationId: null }); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    supabase
      .from('user_profiles')
      .select('username, preferred_location_id')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        setProfile({
          username:            (data?.username as string | null) ?? null,
          preferredLocationId: (data?.preferred_location_id as string | null) ?? null,
        });
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  return { ...profile, loading };
}

// ── Day-level capacity ────────────────────────────────────────────────────────

/** The enabled tables serving each timeslot, keyed by timeslot id. */
export type TablesBySlot = Map<string, string[]>;

export interface DaySlot {
  id: string;
  availability: string[];
  /** Weeks between occurrences. 1 (or absent) means every matching weekday. */
  interval_weeks?: number;
  /** A date this slot really runs, to count the cycle from. */
  anchor_date?: string | null;
}

/**
 * Does this slot run on this date, given its repeat rule?
 *
 * WEEKLY IS THE DEFAULT AND THE SAFE ANSWER. Anything missing, absent or
 * unparseable falls through to true, so a venue that has never touched
 * recurrence resolves exactly as it did before the column existed. The failure
 * mode of a wrong answer here is a shop that looks closed, so the uncertain
 * case has to be "open".
 *
 * Whole weeks, not days: two dates on the same weekday are always a multiple of
 * seven days apart, so dividing by seven gives the week number. The weekday
 * itself is already settled by `availability`, and this never second-guesses it
 * — an anchor on a different weekday would still count whole weeks, and the
 * caller has already established the day matches.
 *
 * Dates are split and rebuilt rather than parsed, for the same reason
 * `weekdayOf` does it: `new Date('2026-08-21')` is UTC midnight, which is the
 * previous day in any negative offset.
 */
export function slotRunsOn(slot: DaySlot, iso: string): boolean {
  const every = slot.interval_weeks ?? 1;
  if (every <= 1) return true;
  if (!slot.anchor_date) return true;   // a cycle with no start is no cycle

  const toUtcDays = (s: string): number | null => {
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  };

  const target = toUtcDays(iso);
  const anchor = toUtcDays(slot.anchor_date);
  if (target === null || anchor === null) return true;

  // Before the first night, it does not run. Modulo on a negative number would
  // otherwise make some earlier weeks look on-cycle.
  if (target < anchor) return false;

  return Math.round((target - anchor) / 7) % every === 0;
}

/**
 * Is there anything left to book at this venue on this day?
 *
 * THE ONE DEFINITION. The date picker, the date list and the timeslot check all
 * have to agree, and they did not: a day used to count as closed only when a
 * block said `table_scope: 'all'`, which missed one block naming every table,
 * or two blocks that between them cover the lot. The customer picked the date
 * and was told afterwards there was nothing free.
 *
 * Asked per SLOT rather than per venue, because a table that does not serve
 * Saturday's only timeslot was never Saturday's capacity to lose.
 *
 * Bookings are deliberately not counted. A fully BOOKED day is a different
 * thing from a closed one; treating them alike would hide a date that still has
 * an honest story to tell about who got there first.
 */
export function dayHasCapacity(
  slots:        DaySlot[],
  tablesBySlot: TablesBySlot,
  blocks:       BlockCoverage[],
  iso:          string,
  dayName:      string,
): boolean {
  const { venueClosed, blockedTableIds } = blockedTablesOn(blocks, iso);
  if (venueClosed) return false;
  return slots.some(s =>
    s.availability.includes(dayName) &&
    // The weekday says which day; the repeat rule says which weeks.
    slotRunsOn(s, iso) &&
    (tablesBySlot.get(s.id) ?? []).some(id => !blockedTableIds.has(id)),
  );
}

/** timeslot → its enabled tables, from a store_table_timeslots select. */
export function groupTablesBySlot(rows: { table_id: string; timeslot_id: string }[]): TablesBySlot {
  const map: TablesBySlot = new Map();
  for (const row of rows) {
    const list = map.get(row.timeslot_id) ?? [];
    list.push(row.table_id);
    map.set(row.timeslot_id, list);
  }
  return map;
}

/**
 * Weekday name for an ISO date.
 *
 * Split and rebuilt rather than `new Date(iso)`, which parses a bare date as
 * UTC midnight — in any negative offset that is the day before, and the whole
 * check would run against the wrong weekday.
 */
export function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return DAY_NAMES[new Date(y, (m ?? 1) - 1, d ?? 1).getDay()];
}

// ── useDayHasCapacity ─────────────────────────────────────────────────────────
//
// Answers the question as soon as a DATE is picked, before a timeslot is
// chosen. The booking form uses a free date picker, so a customer can land on a
// day the venue has closed entirely — and used to have to pick a time before
// anything said so.

export function useDayHasCapacity(locationId: string | null, date: string | null) {
  const [hasCapacity, setHasCapacity] = useState<boolean | null>(null);
  const [loading,     setLoading]     = useState(false);

  useEffect(() => {
    if (!locationId || !date) { setHasCapacity(null); return; }

    let stale = false;
    setLoading(true);
    setHasCapacity(null);

    Promise.all([
      supabase.from('timeslots').select('id, availability, interval_weeks, anchor_date').eq('location_id', locationId),
      supabase.from('store_table_timeslots')
        .select('table_id, timeslot_id, store_tables!inner(enabled, location_id)')
        .eq('store_tables.enabled', true)
        .eq('store_tables.location_id', locationId),
      // A recurring rule cannot be matched with .eq('date', …) — whether it
      // covers this day is a computation, so fetch the rules and evaluate.
      supabase.from('blocked_dates').select(BLOCK_RULE_COLUMNS)
        .eq('location_id', locationId)
        .or(`recurrence.neq.none,date.eq.${date}`),
    ]).then(([tsRes, capRes, bdRes]) => {
      if (stale) return;
      const slots = (tsRes.data ?? []) as DaySlot[];
      const tables = groupTablesBySlot(
        (capRes.data ?? []) as { table_id: string; timeslot_id: string }[],
      );
      const blocks = (bdRes.data ?? []).map(mapBlockCoverage);
      setHasCapacity(dayHasCapacity(slots, tables, blocks, date, weekdayOf(date)));
      setLoading(false);
    });

    return () => { stale = true; };
  }, [locationId, date]);

  return { hasCapacity, loading };
}

// ── useAvailableDates ─────────────────────────────────────────────────────────
// The next 60 dates worth offering at a location: a timeslot runs that weekday,
// and the day's blocks have not taken every table that serves it.
//
// It asks the same question useAvailability asks per timeslot, on purpose. When
// the two disagreed, the customer picked a date and was then told there was
// nothing free on it.

export function useAvailableDates(locationId: string | null) {
  const [dates,   setDates]   = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) { setDates([]); return; }

    setLoading(true);

    Promise.all([
      supabase
        .from('timeslots')
        .select('id, availability, interval_weeks, anchor_date')
        .eq('location_id', locationId),
      // A recurring rule can have started long ago and still apply, so it can't
      // be filtered out by date — only one-offs can.
      supabase
        .from('blocked_dates')
        .select(BLOCK_RULE_COLUMNS)
        .eq('location_id', locationId)
        .or(`recurrence.neq.none,date.gte.${isoDaysFromToday(0)}`),
      // Which enabled tables serve which timeslot. Needed because a day is only
      // bookable if some timeslot on it still has a table left — see below.
      supabase
        .from('store_table_timeslots')
        .select('table_id, timeslot_id, store_tables!inner(enabled, location_id)')
        .eq('store_tables.enabled', true)
        .eq('store_tables.location_id', locationId),
    ]).then(([tsRes, bdRes, capRes]) => {
      const slots = (tsRes.data ?? []) as DaySlot[];
      const blocks = (bdRes.data ?? []).map(mapBlockCoverage);
      const tablesBySlot = groupTablesBySlot(
        (capRes.data ?? []) as { table_id: string; timeslot_id: string }[],
      );

      // Generate next 60 calendar days, keep those still worth offering.
      const result: { value: string; label: string }[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 1; i <= 60 && result.length < 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayName = DAY_NAMES[d.getDay()];
        if (dayHasCapacity(slots, tablesBySlot, blocks, iso, dayName)) {
          result.push({ value: iso, label: formatDateLabel(iso) });
        }
      }

      setDates(result);
      setLoading(false);
    });
  }, [locationId]);

  return { dates, loading };
}

// ── useDayBookable ────────────────────────────────────────────────────────────
//
// A predicate the calendar can ask about ANY date: could this place ever be
// booked that day?
//
// Same three reads and the same `dayHasCapacity` as useAvailableDates, but
// returned as a function rather than a precomputed list, because a calendar
// can be paged to any month and a list would have to guess how far ahead to
// look. Fetched once per location, then answered synchronously.
//
// "Ever" is the important word. This is about whether the place OPENS — a
// weekday it doesn't run, an off week for a fortnightly night, a closure — and
// deliberately not about whether it is full. A date where every table is
// already booked stays selectable, because greying it out would read as "this
// shop is closed" rather than "you're too late for that one".

export function useDayBookable(locationId: string | null) {
  const [rules, setRules] = useState<{
    slots: DaySlot[];
    tablesBySlot: TablesBySlot;
    blocks: BlockCoverage[];
  } | null>(null);

  useEffect(() => {
    if (!locationId) { setRules(null); return; }
    let cancelled = false;

    Promise.all([
      supabase.from('timeslots')
        .select('id, availability, interval_weeks, anchor_date')
        .eq('location_id', locationId),
      // A recurring rule can have started long ago and still apply, so it can't
      // be filtered out by date — only one-offs can.
      supabase.from('blocked_dates')
        .select(BLOCK_RULE_COLUMNS)
        .eq('location_id', locationId)
        .or(`recurrence.neq.none,date.gte.${isoDaysFromToday(0)}`),
      supabase.from('store_table_timeslots')
        .select('table_id, timeslot_id, store_tables!inner(enabled, location_id)')
        .eq('store_tables.enabled', true)
        .eq('store_tables.location_id', locationId),
    ]).then(([tsRes, bdRes, capRes]) => {
      if (cancelled) return;
      setRules({
        slots: (tsRes.data ?? []) as DaySlot[],
        blocks: (bdRes.data ?? []).map(mapBlockCoverage),
        tablesBySlot: groupTablesBySlot((capRes.data ?? []) as { table_id: string; timeslot_id: string }[]),
      });
    });

    return () => { cancelled = true; };
  }, [locationId]);

  return useCallback((iso: string): boolean => {
    // Until the rules land, every date is offered. Answering "no" while loading
    // would grey out the whole calendar for a moment, which looks broken.
    if (!rules) return true;
    return dayHasCapacity(rules.slots, rules.tablesBySlot, rules.blocks, iso, weekdayOf(iso));
  }, [rules]);
}

// ── useTimeslots ──────────────────────────────────────────────────────────────
// Returns timeslots for a location that are available on the given date's weekday.

export function useTimeslots(locationId: string | null, date: string | null) {
  const [timeslots, setTimeslots] = useState<Timeslot[]>([]);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    if (!locationId || !date) { setTimeslots([]); return; }

    const dayName = DAY_NAMES[parseDateLocal(date).getDay()];
    setLoading(true);

    supabase
      .from('timeslots')
      .select('id, name, start_time, end_time, availability, interval_weeks, anchor_date, audience')
      .eq('location_id', locationId)
      .contains('availability', [dayName])
      .order('start_time')
      .then(async ({ data }) => {
        // The weekday is filtered in the query; the repeat rule has to be
        // applied here, because "every second Friday" is not a column Postgrest
        // can compare. Without this a member would be offered a slot on an
        // off week and told it was unavailable only after picking it.
        const running = (data ?? []).filter(s => slotRunsOn(s as DaySlot, date));

        // Members-only nights are only offered to whoever may actually book
        // them. The database is the real gate — a restrictive policy refuses
        // the insert either way — but being shown a night and then refused is
        // the experience this avoids.
        //
        // Asked of the server rather than reimplemented here, because the rule
        // is more than "are you a member": a club's admins, staff and
        // organisers may book one too, and a second copy of that would drift.
        // There are rarely more than one or two such slots on a given day.
        const restricted = running.filter(s => (s as { audience?: string }).audience === 'members');
        if (restricted.length === 0) {
          setTimeslots(running);
          setLoading(false);
          return;
        }

        const verdicts = await Promise.all(restricted.map(s =>
          supabase.rpc('may_book_timeslot', { slot: s.id, loc: locationId })
            .then(({ data: ok, error }) => ({ id: s.id, ok: !error && ok === true })),
        ));
        const refused = new Set(verdicts.filter(v => !v.ok).map(v => v.id));

        setTimeslots(running.filter(s => !refused.has(s.id)));
        setLoading(false);
      });
  }, [locationId, date]);

  return { timeslots, loading };
}

// ── useAdminLocations ─────────────────────────────────────────────────────────
// Returns locations where the current user is listed as an admin.

export function useAdminLocations(userId: string | null) {
  const [adminLocations, setAdminLocations] = useState<Location[]>([]);
  // Which user the current adminLocations belong to. `loading` is derived from
  // this rather than set asynchronously, so it's never stale within a render:
  // the moment userId changes, loading flips true until its fetch resolves.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) { setAdminLocations([]); setLoadedFor(null); return; }

    supabase
      .from('locations')
      .select('id, name, icon, kind')
      .contains('admins', [userId])
      .neq('kind', 'space')   // a room is not something you administer as a venue
      .order('name')
      .then(({ data }) => {
        if (cancelled) return;
        setAdminLocations(data ?? []);
        setLoadedFor(userId);
      });

    return () => { cancelled = true; };
  }, [userId]);

  const loading = !!userId && loadedFor !== userId;

  return { adminLocations, loading };
}

// ── Venue membership ──────────────────────────────────────────────────────────
// Two ways to be attached to a venue. An `admin` (locations.admins) runs the
// place and can change anything about it. `staff` work there: they can see who
// is booked in, and nothing else. See 20260811020000.

export type VenueRole = 'admin' | 'staff';

/**
 * Every venue this user can open Manage Store for, and what they may do at
 * each. Admin beats staff where someone is both, so a venue owner who also
 * added themselves as staff never loses their own controls.
 */
export function useManagedLocations(userId: string | null) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [roles,     setRoles]     = useState<Record<string, VenueRole>>({});
  // Same trick as useAdminLocations: derive `loading` from which user the
  // current data belongs to, so it's never stale within a render.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) { setLocations([]); setRoles({}); setLoadedFor(null); return; }

    Promise.all([
      // Spaces excluded, clubs kept: the store view is for an organisation, and
      // a club is one. A borrowed room is not — it has no bookings of its own,
      // no staff and no stats.
      supabase.from('locations').select('id, name, icon, kind').contains('admins', [userId]).neq('kind', 'space'),
      // COUNTER STAFF ONLY. An organiser is in this table too, but the store
      // view is bookings-shaped and RLS gives an organiser none of them — they
      // would land on a venue whose every column was empty and reasonably
      // conclude it was broken. Their events live in the personal view instead.
      supabase.from('location_staff').select('location_id').eq('user_id', userId).eq('role', 'staff'),
    ]).then(async ([adminRes, staffRes]) => {
      if (cancelled) return;

      const adminLocs = (adminRes.data ?? []) as Location[];
      const adminIds  = new Set(adminLocs.map(l => l.id));
      const staffIds  = ((staffRes.data as { location_id: string }[] | null) ?? [])
        .map(r => r.location_id)
        .filter(id => !adminIds.has(id));   // admin already covers these

      let staffLocs: Location[] = [];
      if (staffIds.length > 0) {
        const { data } = await supabase
          .from('locations').select('id, name, icon, kind').in('id', staffIds).neq('kind', 'space');
        if (cancelled) return;
        staffLocs = (data ?? []) as Location[];
      }

      const nextRoles: Record<string, VenueRole> = {};
      for (const l of adminLocs) nextRoles[l.id] = 'admin';
      for (const l of staffLocs) nextRoles[l.id] = 'staff';

      setLocations([...adminLocs, ...staffLocs].sort((a, b) => a.name.localeCompare(b.name)));
      setRoles(nextRoles);
      setLoadedFor(userId);
    });

    return () => { cancelled = true; };
  }, [userId]);

  const loading = !!userId && loadedFor !== userId;

  return { locations, roles, loading };
}

/** The admin user ids on one venue — so the staff picker can spot an admin. */
export function useLocationAdminIds(locationId: string | null) {
  const [adminIds, setAdminIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!locationId) { setAdminIds([]); return; }
    supabase
      .from('locations').select('admins').eq('id', locationId).single()
      .then(({ data }) => {
        if (cancelled) return;
        setAdminIds(((data?.admins as string[] | null) ?? []));
      });
    return () => { cancelled = true; };
  }, [locationId]);

  return adminIds;
}

// ── useLocationStaff ──────────────────────────────────────────────────────────
// The roster at one venue, with each person's public profile attached.

/**
 * What this person does at the venue.
 *
 * 'staff' works the counter and sees the bookings. 'organiser' runs events —
 * holds tables and publishes BattlePacks — and deliberately does NOT see who
 * booked what. See 20260814060000.
 */
export type VenueStaffRole = 'staff' | 'organiser';

export interface StaffMember {
  userId:     string;
  handle:     string | null;
  /** Their real name. Only venue admins can see this — see 20260812050000. */
  username:   string | null;
  avatarPath: string | null;
  createdAt:  string | null;
  role:       VenueStaffRole;
}

export function useLocationStaff(locationId: string | null) {
  const [staff,   setStaff]   = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    if (!locationId) { setStaff([]); setLoading(false); return; }
    setLoading(true);

    // One RPC rather than a roster query plus a profile join: real names live
    // in user_profiles, which is select-own under RLS, so reading a colleague's
    // needs the security-definer fence. It returns the roster already resolved.
    supabase
      .rpc('venue_staff_profiles', { loc: locationId })
      .then(({ data, error }) => {
        // A staff member calling this is refused by design; they have no screen
        // that shows the roster, so an empty list is the right thing to render.
        if (error) { setStaff([]); setLoading(false); return; }
        setStaff(((data as {
          user_id: string; handle: string | null;
          username: string | null; avatar_path: string | null;
          role: VenueStaffRole | null;
        }[] | null) ?? []).map(p => ({
          userId:     p.user_id,
          handle:     p.handle,
          username:   p.username,
          avatarPath: p.avatar_path,
          createdAt:  null,
          // Everyone who existed before roles did works the counter.
          role:       p.role ?? 'staff',
        })));
        setLoading(false);
      });
  }, [locationId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { staff, loading, refetch };
}

// ── useClubMembers ────────────────────────────────────────────────────────────
//
// A club's roll, with real names.
//
// Same shape and same fence as the staff roster: names live in user_profiles,
// which is select-own under RLS, so reading somebody else's needs the
// security-definer RPC rather than a join the caller could not make.

/** What someone is to a club. Ordered strongest first by the RPC. */
export type ClubRole = 'admin' | 'organiser' | 'staff' | 'member';

export interface ClubPerson {
  userId:     string;
  handle:     string | null;
  username:   string | null;
  avatarPath: string | null;
  role:       ClubRole;
}

/**
 * Everyone attached to a club — one row each, strongest role first.
 *
 * One list rather than the two it replaced: a club admin looking for somebody
 * had to know which of organisers or members they were in order to find them,
 * and anyone who was both appeared twice. Admins are included too, which
 * neither of the old functions could do — they live in `locations.admins`.
 */
export function useClubPeople(locationId: string | null) {
  const [people,  setPeople]  = useState<ClubPerson[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    if (!locationId) { setPeople([]); setLoading(false); return; }
    setLoading(true);

    supabase
      .rpc('club_people', { loc: locationId })
      .then(({ data, error }) => {
        // The RPC refuses anyone who is not an admin here. No screen shows this
        // to anyone else, so an empty list is the right render, not an error.
        if (error) { setPeople([]); setLoading(false); return; }
        setPeople(((data as {
          user_id: string; handle: string | null;
          username: string | null; avatar_path: string | null; role: ClubRole;
        }[] | null) ?? []).map(p => ({
          userId:     p.user_id,
          handle:     p.handle,
          username:   p.username,
          avatarPath: p.avatar_path,
          role:       p.role,
        })));
        setLoading(false);
      });
  }, [locationId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { people, loading, refetch };
}

// ── useUpcomingBookings ───────────────────────────────────────────────────────
// Returns all bookings on or after today across the given location IDs,
// ordered by date then timeslot.

export interface UpcomingBooking {
  id:        string;
  date:      string;
  user_name: string | null;
  user_id:            string | null;
  created_by_user_id: string | null;
  game:      { id: string; name: string; slug: string } | null;
  location:  { id: string; name: string; address: string | null };
  timeslot:  { id: string; name: string; start_time: string; end_time: string };
}

// ── useProfileLabel ───────────────────────────────────────────────────────────
// One user's display name, for attributing a booking to whoever took it.
// Reads public_profiles, the sanctioned window past user_profiles' select-own
// RLS — so a venue admin can name a staff member without needing to be them.

export function useProfileLabel(userId: string | null) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) { setLabel(null); return; }

    // Handle, not username: `username` is the private "Your Name" and was
    // deliberately dropped from this view (20260722030000). The handle is the
    // public, unique identifier — the right thing to attribute a booking to.
    supabase
      .from('public_profiles')
      .select('handle')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const handle = (data as { handle: string | null } | null)?.handle;
        setLabel(handle ? `@${handle}` : null);
      });

    return () => { cancelled = true; };
  }, [userId]);

  return label;
}

export function useUpcomingBookings(locationIds: string[]) {
  const [bookings, setBookings] = useState<UpcomingBooking[]>([]);
  const [loading,  setLoading]  = useState(true);

  // Stable key so the effect only re-runs when the set of venues changes.
  const key = locationIds.join(',');

  const refetch = () => {
    if (locationIds.length === 0) { setBookings([]); setLoading(false); return; }
    setLoading(true);
    const d     = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    supabase
      .from('bookings')
      .select(BOOKING_SELECT)
      .in('location_id', locationIds)
      .gte('date', today)
      .order('date')
      .order('timeslot_id')
      .then(({ data }) => {
        setBookings(((data as unknown as RawBookingRow[]) ?? []).map(mapBookingRow));
        setLoading(false);
      });
  };

  useEffect(() => {
    if (locationIds.length === 0) { setBookings([]); setLoading(false); return; }

    refetch();

    // Live updates: refetch whenever any booking at a relevant venue changes.
    // A DELETE's payload only carries the primary key (not location_id), so we
    // can't filter deletes by venue here — refetch on any booking change and let
    // the query re-scope to this admin's venues.
    const relevant = new Set(locationIds);
    const channel = supabase
      .channel(`upcoming-bookings-${key}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        payload => {
          const rec    = (payload.new ?? payload.old) as { location_id?: string } | null;
          const locId  = rec?.location_id;
          // INSERT/UPDATE carry location_id — skip if it's not one of our venues.
          // DELETE has no location_id, so always refetch to stay consistent.
          if (locId == null || relevant.has(locId)) refetch();
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { bookings, loading, refetch };
}

// ── useLocationHasApp ─────────────────────────────────────────────────────────
//
// Whether a venue has one of the platform's apps switched on for it.
//
// Reads `location_apps` (20260814010000), the same table my_platform_apps()
// consults to decide whether a venue admin gets the app in their switcher. Both
// sides asking the same table is the point: a shop cannot end up with the
// Upcoming Events column but no BattlePack, or the reverse.
//
// Starts null rather than false, and callers must wait for it. Defaulting to
// false would flash the column away on every load for the venues that DO have
// it, which reads as the feature breaking.

export function useLocationHasApp(locationId: string | null, appSlug: string) {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!locationId) { setEnabled(false); return; }
    let cancelled = false;
    setEnabled(null);

    supabase
      .from('location_apps')
      .select('app_slug', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('app_slug', appSlug)
      .then(({ count, error }) => {
        if (cancelled) return;
        // Fail closed. A venue that has not been given the app is the normal
        // case, so an unreadable answer should look like that rather than
        // switching a feature on by accident.
        setEnabled(!error && (count ?? 0) > 0);
      });

    return () => { cancelled = true; };
  }, [locationId, appSlug]);

  return enabled;
}

// ── useVenueEvents ────────────────────────────────────────────────────────────
//
// The BattlePacks running at a venue — the BattlePlan half of the integration.
//
// A venue's staff work the counter on the day an event fills the shop, so they
// are the people who most need to know it is coming. They cannot edit a pack;
// this is the read.
//
// WHOSE PACKS SHOW is a display rule, not a permission. RLS lets a venue's
// admins and staff read every pack at their venue (20260803000000), so the
// "only your own drafts" filter below is politeness, not security — a draft is
// half-written and showing someone else's to the whole shop is noise. Published
// packs are public anyway.
//
// FILTERED IN THE CLIENT, deliberately. A venue has a handful of packs, and the
// alternative is a nested PostgREST `or()` spanning three nullable date columns
// that nobody will be able to read in six months. The date logic below is the
// part that has to be right, so it is written plainly.

export interface VenueEventHold {
  /** BattlePlan's own vocabulary: every table, or the named ones. */
  scope: 'all' | 'selected';
  /** Empty when the scope is 'all'. */
  tableNames: string[];
  /** Every date held. One today; a multi-day event will return several. */
  dates: string[];
}

export interface VenueEvent {
  id:        string;
  name:      string;
  status:    string;
  starts_on: string | null;
  ends_on:   string | null;
  game:      { id: string; name: string; slug: string } | null;
  /** Null when the event holds no tables — most drafts, and any venue that
   *  runs its bookings elsewhere. */
  hold:      VenueEventHold | null;
}

interface RawPackRow {
  id: string; name: string; status: string;
  starts_on: string | null; ends_on: string | null; owner_id: string | null;
  game: { id: string; name: string; slug: string } | null;
}

interface RawHoldRow {
  battlepack_id: string;
  date: string;
  table_scope: 'all' | 'selected';
  blocked_date_tables: { store_tables: { name: string } | null }[] | null;
}

/**
 * Whether an event is still ahead of the venue.
 *
 * The last day is what matters: a three-day event on its middle day is very
 * much still on, so a bare `starts_on >= today` would drop it from the column
 * exactly when the counter needs it most. An undated draft is kept — the
 * organiser is mid-way through writing it and hiding their own work reads as a
 * bug.
 */
function eventIsUpcoming(e: { starts_on: string | null; ends_on: string | null }, todayIso: string): boolean {
  const last = e.ends_on ?? e.starts_on;
  return last === null || last >= todayIso;
}

/**
 * Fold blocked_dates rows into one hold per pack.
 *
 * Shared by the venue's column and an organiser's own, so the two can't come to
 * different conclusions about what an event has taken out of a room.
 */
function collectHolds(rows: RawHoldRow[] | null): Map<string, VenueEventHold> {
  const holds = new Map<string, VenueEventHold>();
  for (const row of (rows ?? [])) {
    const names = (row.blocked_date_tables ?? [])
      .map(l => l.store_tables?.name)
      .filter((n): n is string => !!n);
    const existing = holds.get(row.battlepack_id);
    if (existing) {
      existing.dates.push(row.date);
      for (const n of names) if (!existing.tableNames.includes(n)) existing.tableNames.push(n);
    } else {
      holds.set(row.battlepack_id, { scope: row.table_scope, tableNames: names.sort(), dates: [row.date] });
    }
  }
  return holds;
}

export function useVenueEvents(locationIds: string[], userId: string | null) {
  const [events,  setEvents]  = useState<VenueEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Stable key so the effect only re-runs when the set of venues really changes.
  const key = locationIds.join(',');

  useEffect(() => {
    if (locationIds.length === 0) { setEvents([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const d = new Date();
      const todayIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const { data: packData, error } = await supabase
        .from('battlepacks')
        .select('id, name, status, starts_on, ends_on, owner_id, game:games(id, name, slug)')
        .in('location_id', locationIds);

      if (cancelled) return;
      // The battlepack tables may not be readable at all (a venue whose staff
      // have no grant). An empty column is the right answer, not an error.
      if (error) { setEvents([]); setLoading(false); return; }

      const packs = ((packData as unknown as RawPackRow[]) ?? [])
        .filter(p => p.status === 'published' || (!!userId && p.owner_id === userId))
        .filter(p => eventIsUpcoming(p, todayIso))
        .sort((a, b) => {
          // Undated drafts last — they have no place on a timeline.
          if (!a.starts_on) return b.starts_on ? 1 : a.name.localeCompare(b.name);
          if (!b.starts_on) return -1;
          return a.starts_on.localeCompare(b.starts_on) || a.name.localeCompare(b.name);
        });

      if (packs.length === 0) { setEvents([]); setLoading(false); return; }

      // What each event actually takes out of the venue. Read from blocked_dates
      // rather than trusted from the pack, so the column shows what a customer
      // will really run into when they try to book.
      const { data: holdData } = await supabase
        .from('blocked_dates')
        .select('battlepack_id, date, table_scope, blocked_date_tables(store_tables(name))')
        .in('battlepack_id', packs.map(p => p.id))
        .order('date');

      if (cancelled) return;

      const holds = collectHolds(holdData as unknown as RawHoldRow[] | null);

      setEvents(packs.map(p => ({
        id: p.id, name: p.name, status: p.status,
        starts_on: p.starts_on, ends_on: p.ends_on, game: p.game,
        hold: holds.get(p.id) ?? null,
      })));
      setLoading(false);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, userId]);

  return { events, loading };
}

// ── useIsOrganiser ────────────────────────────────────────────────────────────
//
// Whether this person has been nominated to run events anywhere.
//
// Gates the personal events column. Asked as "are you an organiser" rather than
// "do you own any packs", because someone who has just been nominated and has
// not written an event yet still needs to see the column — an empty one that
// explains itself is how they find out the feature is theirs.

export function useIsOrganiser(userId: string | null) {
  const [isOrganiser, setIsOrganiser] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userId) { setIsOrganiser(false); return; }
    let cancelled = false;
    setIsOrganiser(null);

    supabase
      .from('location_staff')
      .select('location_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'organiser')
      .then(({ count, error }) => {
        if (cancelled) return;
        setIsOrganiser(!error && (count ?? 0) > 0);
      });

    return () => { cancelled = true; };
  }, [userId]);

  return isOrganiser;
}

// ── useMyEvents ───────────────────────────────────────────────────────────────
//
// The events this person is running, wherever they are running them.
//
// The venue's column answers "what is coming to my room"; this answers "what am
// I running". So it is scoped by OWNER rather than by venue, and it spans every
// venue at once — which is why, unlike the venue's column, each row has to say
// where it is.
//
// Drafts included. Half of an organiser's work is a pack that is not published
// yet, and a column that hid it would be missing the part they most need to get
// back to.

export interface MyEvent extends VenueEvent {
  /** Where it runs. Always shown — this column spans venues. */
  venueName: string | null;
}

interface RawMyPackRow extends RawPackRow {
  location: { id: string; name: string } | null;
}

export function useMyEvents(userId: string | null) {
  const [events,  setEvents]  = useState<MyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setEvents([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const d = new Date();
      const todayIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('battlepacks')
        .select('id, name, status, starts_on, ends_on, owner_id, game:games(id, name, slug), location:locations(id, name)')
        .eq('owner_id', userId);

      if (cancelled) return;
      if (error) { setEvents([]); setLoading(false); return; }

      const packs = ((data as unknown as RawMyPackRow[]) ?? [])
        .filter(p => eventIsUpcoming(p, todayIso))
        .sort((a, b) => {
          // Undated drafts last — they have no place on a timeline.
          if (!a.starts_on) return b.starts_on ? 1 : a.name.localeCompare(b.name);
          if (!b.starts_on) return -1;
          return a.starts_on.localeCompare(b.starts_on) || a.name.localeCompare(b.name);
        });

      if (packs.length === 0) { setEvents([]); setLoading(false); return; }

      const { data: holdData } = await supabase
        .from('blocked_dates')
        .select('battlepack_id, date, table_scope, blocked_date_tables(store_tables(name))')
        .in('battlepack_id', packs.map(p => p.id))
        .order('date');

      if (cancelled) return;
      const holds = collectHolds(holdData as unknown as RawHoldRow[] | null);

      setEvents(packs.map(p => ({
        id: p.id, name: p.name, status: p.status,
        starts_on: p.starts_on, ends_on: p.ends_on, game: p.game,
        hold: holds.get(p.id) ?? null,
        venueName: p.location?.name ?? null,
      })));
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [userId]);

  return { events, loading };
}

// ── useBookingsByDate ─────────────────────────────────────────────────────────
// Returns every booking at a location on a specific date (past or future),
// ordered by timeslot.

export function useBookingsByDate(locationId: string | null, date: string | null) {
  const [bookings, setBookings] = useState<UpcomingBooking[]>([]);
  const [loading,  setLoading]  = useState(true);

  const refetch = () => {
    if (!locationId || !date) { setBookings([]); setLoading(false); return; }
    setLoading(true);
    supabase
      .from('bookings')
      .select(BOOKING_SELECT)
      .eq('location_id', locationId)
      .eq('date', date)
      .order('timeslot_id')
      .then(({ data }) => {
        setBookings(((data as unknown as RawBookingRow[]) ?? []).map(mapBookingRow));
        setLoading(false);
      });
  };

  useEffect(refetch, [locationId, date]);

  return { bookings, loading, refetch };
}

// ── useBlockedDates ───────────────────────────────────────────────────────────
// Returns upcoming blocked dates across the given location IDs, ordered by date.

export type BlockRecurrence = 'none' | 'weekly' | 'monthly';
/** 'all' shuts the venue (including tables added later); 'selected' names tables. */
export type BlockTableScope = 'all' | 'selected';

export interface BlockedDate {
  id:             string;
  /** The blocked day for a one-off; the first day of the series when recurring. */
  date:           string;
  description:    string | null;
  /**
   * LEGACY mirror of `tableIds.length`, kept only so pre-2.15 clients still
   * compute capacity. `tableIds` is authoritative. See 20260812030000.
   */
  blocked_tables: number | null;
  recurrence:     BlockRecurrence;
  /** 1 = every week, 2 = every second week. Counted from the week of `date`. */
  interval_weeks: number;
  /** Full day names, e.g. ['Monday']. Empty for a one-off. */
  days_of_week:   string[];
  /**
   * Monthly only: which occurrence of `days_of_week` in the month — 1-4 for
   * first through fourth, -1 for the last. NULL for every other recurrence.
   */
  week_of_month:  number | null;
  /** Last day the rule can apply; null runs until deleted. */
  until_date:     string | null;
  table_scope:    BlockTableScope;
  /** The tables this block covers. Empty when table_scope is 'all'. */
  tableIds:       string[];
  location:       { id: string; name: string; icon: string };
  /** Who created the block. Null on rows predating 20260814050000. */
  created_by:     string | null;
  /**
   * `created_by`'s public handle — but ONLY when that is somebody other than
   * the viewer. A venue admin who blocked their own tables does not need
   * telling who did it, so this is null for your own blocks and the line
   * disappears. Resolved in the hook so the question is asked once per fetch
   * rather than once per row.
   */
  hostHandle:     string | null;
}

/** The recurrence fields, for callers that don't need the whole row. */
export type BlockRule = Pick<
  BlockedDate,
  'date' | 'recurrence' | 'interval_weeks' | 'days_of_week' | 'week_of_month' | 'until_date'
>;

/** A rule plus what it takes out — enough to work out capacity on a day. */
export type BlockCoverage = BlockRule & { table_scope: BlockTableScope; tableIds: string[] };

/** Midnight on the Monday of that date's week — the anchor every interval counts from. */
function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  // getDay() is Sunday-first; shift so Monday is 0.
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Is `d` the nth occurrence of its own weekday within its month?
 *
 * `nth` is 1-4 for first through fourth, and -1 for the last — which is not the
 * same as the fifth. A fifth Friday exists in some months and not others, so a
 * rule saying 5 would skip most of the year, while "last" is what people mean
 * and always resolves.
 *
 * A monthly rule with no week set matches nothing rather than everything. The
 * database will not store one, and if it ever did, blocking nothing is the
 * failure that leaves a venue open.
 */
function isNthWeekdayOfMonth(d: Date, nth: number | null | undefined): boolean {
  if (nth == null) return false;
  const dayOfMonth = d.getDate();

  if (nth === -1) {
    // Day 0 of the next month is the last day of this one.
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return dayOfMonth + 7 > daysInMonth;
  }

  return Math.floor((dayOfMonth - 1) / 7) + 1 === nth;
}

/**
 * Does this block apply on `iso`?
 *
 * A one-off applies on exactly its date. A weekly rule applies on the listed
 * weekdays, in every `interval_weeks`-th week counted from the week its series
 * starts. A monthly rule applies on the listed weekdays in the week of the
 * month named by `week_of_month`. Both run from `date` until `until_date`
 * inclusive.
 *
 * Anchoring the weekly interval to whole weeks rather than to day-differences is
 * what makes "every second Friday" mean the same Fridays no matter which day of
 * the week the rule happened to be created on.
 *
 * RECURRENCE IS AN ALLOWLIST, NOT AN ELSE. Anything this build does not
 * recognise falls back to "applies on its own date only", so a row written by a
 * newer client can block too little but can never close a venue that is open.
 * That is the direction this function has to fail in: it feeds dayHasCapacity,
 * which decides whether anyone can book anywhere.
 */
export function blockAppliesOn(rule: BlockRule, iso: string): boolean {
  const repeats = rule.recurrence === 'weekly' || rule.recurrence === 'monthly';
  if (!repeats) return rule.date === iso;

  const day = parseDateLocal(iso);
  if (iso < rule.date) return false;
  if (rule.until_date && iso > rule.until_date) return false;
  if (!rule.days_of_week.includes(DAY_NAMES[day.getDay()])) return false;

  if (rule.recurrence === 'monthly') return isNthWeekdayOfMonth(day, rule.week_of_month);

  const every = rule.interval_weeks ?? 1;
  if (every <= 1) return true;

  // Whole weeks between the two Mondays. Rounded because a DST change inside
  // the span leaves the difference an hour off a clean multiple.
  const weeks = Math.round(
    (startOfWeek(day).getTime() - startOfWeek(parseDateLocal(rule.date)).getTime()) / MS_PER_WEEK
  );
  return weeks % every === 0;
}

/**
 * Which tables a set of blocks takes out on a given day.
 *
 * `venueClosed` is separate from the id set on purpose: closing the venue has
 * to cover tables that don't exist yet, so it can't be expressed as a list of
 * today's ids. Overlapping blocks naming the same table collapse, which a
 * count-based model got wrong — two blocks each covering Table 1 removed two
 * tables' worth of capacity.
 */
export function blockedTablesOn(
  blocks: BlockCoverage[],
  iso:    string,
): { venueClosed: boolean; blockedTableIds: Set<string> } {
  const active = blocks.filter(b => blockAppliesOn(b, iso));
  return {
    venueClosed:     active.some(b => b.table_scope === 'all'),
    blockedTableIds: new Set(active.flatMap(b => b.tableIds)),
  };
}

/** Columns every consumer of a block needs, plus its table selection. */
const BLOCK_RULE_COLUMNS =
  'date, recurrence, interval_weeks, days_of_week, week_of_month, until_date, table_scope, blocked_date_tables(table_id)';

/** Raw block row → the shape blockedTablesOn expects. */
function mapBlockCoverage(r: unknown): BlockCoverage {
  const row = r as BlockRule & {
    table_scope: BlockTableScope;
    blocked_date_tables?: { table_id: string }[] | null;
  };
  return {
    date:           row.date,
    recurrence:     row.recurrence,
    interval_weeks: row.interval_weeks,
    days_of_week:   row.days_of_week ?? [],
    // ?? null, not left undefined: isNthWeekdayOfMonth treats a missing week as
    // "matches nothing", and a row served by an older API shape should block
    // nothing rather than every week of the month.
    week_of_month:  row.week_of_month ?? null,
    until_date:     row.until_date,
    table_scope:    row.table_scope,
    tableIds:       (row.blocked_date_tables ?? []).map(t => t.table_id),
  };
}

export function useBlockedDates(locationIds: string[]) {
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [loading,      setLoading]      = useState(true);

  // Stable key so the effect only re-runs when the set of venues changes.
  const key = locationIds.join(',');

  const refetch = () => {
    if (locationIds.length === 0) { setBlockedDates([]); setLoading(false); return; }
    setLoading(true);
    const d     = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    supabase
      .from('blocked_dates')
      .select(`
        id, date, description, blocked_tables, created_by,
        recurrence, interval_weeks, days_of_week, week_of_month, until_date,
        table_scope, blocked_date_tables(table_id),
        location:locations(id, name, icon)
      `)
      .in('location_id', locationIds)
      // A weekly rule started in March is still live in June, so it can't be
      // filtered on its start date. It drops off the list once it has expired.
      .or(`and(recurrence.eq.none,date.gte.${today}),and(recurrence.neq.none,or(until_date.is.null,until_date.gte.${today}))`)
      .order('date')
      .then(async ({ data }) => {
        // Flatten the join rows into plain ids, so nothing downstream has to
        // know the shape Supabase returns a nested select in.
        const rows = ((data ?? []) as unknown as (Omit<BlockedDate, 'tableIds' | 'hostHandle'> & {
          blocked_date_tables?: { table_id: string }[] | null;
        })[]).map(r => ({
          ...r,
          tableIds:   (r.blocked_date_tables ?? []).map(t => t.table_id),
          hostHandle: null as string | null,
        }));

        // Who else's blocks are in this list? A club or TO can hold tables at
        // a venue it does not own, and the venue's admins are owed the name.
        // Only for OTHER people — see hostHandle on BlockedDate.
        const me     = (await supabase.auth.getUser()).data.user?.id ?? null;
        const others = [...new Set(
          rows.map(r => r.created_by).filter((id): id is string => !!id && id !== me),
        )];
        if (others.length > 0) {
          // public_profiles, not user_profiles: this is somebody the viewer may
          // have no relationship with, and the handle is the public window.
          const { data: profiles } = await supabase
            .from('public_profiles').select('id, handle').in('id', others);
          const byId = new Map((profiles ?? []).map(p => [p.id as string, p.handle as string | null]));
          rows.forEach(r => { r.hostHandle = r.created_by ? byId.get(r.created_by) ?? null : null; });
        }

        setBlockedDates(rows);
        setLoading(false);
      });
  };

  useEffect(refetch, [key]);

  return { blockedDates, loading, refetch };
}

// ── useTableAvailability ──────────────────────────────────────────────────────
//
// How many tables are free for a location + date + timeslot, broken down by
// the kind of table.
//
// A venue with six wargaming tables and two painting benches has two
// capacities, and one shared counter overstates both: six people book "a
// table", the benches look untouched, and the wargaming tables are three times
// oversubscribed. So each label is counted against its own tables.
//
// LEGACY BOOKINGS HAVE NO LABEL, and they are most of them. One made before a
// venue had more than one kind took *a* table, so it is charged against the
// pool rather than any one label — which is why each label's availability is
// also capped by what is left overall. Without that cap, five unlabelled
// bookings against six tables would still show two benches free.

export interface TableKindAvailability {
  /** The label, or null for a venue whose tables are unlabelled. */
  label:     string | null;
  available: number;
}

export function useTableAvailability(
  locationId:  string | null,
  date:        string | null,
  timeslotId:  string | null,
) {
  const [state,   setState]   = useState<{ kinds: TableKindAvailability[]; totalFree: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId || !date || !timeslotId) { setState(null); return; }
    let cancelled = false;

    setLoading(true);
    setState(null);

    Promise.all([
      // Capacity is a SET, not a count: which enabled tables serve this
      // timeslot, and what each is called. A block names tables, so the two
      // have to be intersected rather than subtracted — a blocked table that
      // doesn't serve this timeslot was never part of this slot's capacity.
      supabase.from('store_table_timeslots')
        .select('table_id, store_tables!inner(id, enabled, location_id, label)')
        .eq('timeslot_id', timeslotId)
        .eq('store_tables.enabled', true)
        .eq('store_tables.location_id', locationId),
      // booking_occupancy, not bookings: a regular user can no longer read
      // other people's bookings, but they still need the slot's taken-count to
      // see availability. The view exposes occupancy without any identity.
      supabase.from('booking_occupancy').select('table_label')
        .eq('location_id', locationId)
        .eq('date', date)
        .eq('timeslot_id', timeslotId),
      // Blocked dates apply to the whole day, so they reduce the tables
      // available for every timeslot on that date. A recurring rule can't be
      // matched with `.eq('date', …)` — whether it covers this day is a
      // computation, so fetch the venue's rules and evaluate them.
      supabase.from('blocked_dates').select(BLOCK_RULE_COLUMNS)
        .eq('location_id', locationId)
        .or(`recurrence.neq.none,date.eq.${date}`),
    ]).then(([tablesRes, bookingsRes, blockedRes]) => {
      if (cancelled) return;

      const rules = (blockedRes.data ?? []).map(mapBlockCoverage);
      const { venueClosed, blockedTableIds } = blockedTablesOn(rules, date);

      const rows = (tablesRes.data ?? []) as unknown as {
        table_id: string; store_tables: { label: string | null } | null;
      }[];
      const usable = venueClosed ? [] : rows.filter(r => !blockedTableIds.has(r.table_id));

      // Tables per label, and the order they were first seen — so the picker
      // isn't reshuffled by an unrelated edit.
      const perLabel = new Map<string | null, number>();
      for (const r of usable) {
        const key = r.store_tables?.label?.trim() || null;
        perLabel.set(key, (perLabel.get(key) ?? 0) + 1);
      }

      const booked = (bookingsRes.data ?? []) as { table_label: string | null }[];
      const bookedPerLabel = new Map<string | null, number>();
      for (const b of booked) {
        const key = b.table_label?.trim() || null;
        bookedPerLabel.set(key, (bookedPerLabel.get(key) ?? 0) + 1);
      }

      const totalFree = Math.max(0, usable.length - booked.length);

      setState({
        totalFree,
        kinds: [...perLabel.entries()].map(([label, count]) => ({
          label,
          // Its own tables minus its own bookings, but never more than the venue
          // has left overall — that second term is what stops unlabelled legacy
          // bookings being invisible to every label.
          available: Math.max(0, Math.min(count - (bookedPerLabel.get(label) ?? 0), totalFree)),
        })),
      });
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [locationId, date, timeslotId]);

  /**
   * How many tables are free in total.
   *
   * NOT the sum of the per-label numbers. Each of those is capped by what is
   * left overall, so with six wargaming tables, two benches and five
   * unlabelled bookings they read 3 and 2 — a sum of 5 against 3 real tables.
   * The pool is the truth; the per-label figures are what you may still ask
   * for, which is a different question.
   */
  const available = state === null ? null : state.totalFree;

  return { kinds: state?.kinds ?? null, available, loading };
}

// ── useLocationTimeslots ──────────────────────────────────────────────────────
// All timeslots for a location, regardless of day-of-week availability.

export interface LocationTimeslot {
  id:           string;
  name:         string;
  start_time:   string;
  end_time:     string;
  /** Full day names this slot runs on, e.g. ['Tuesday', 'Wednesday']. */
  availability: string[];
  /** Weeks between occurrences; 1 is every matching weekday. */
  interval_weeks: number;
  /** Which occurrence to count the cycle from. Null when weekly. */
  anchor_date: string | null;
  /** 'anyone' or 'members' — see 20260817000000. */
  audience: TimeslotAudience;
}

/** Who may book a night. Venues use 'anyone' for everything. */
export type TimeslotAudience = 'anyone' | 'members';

export function useLocationTimeslots(locationId: string | null) {
  const [timeslots, setTimeslots] = useState<LocationTimeslot[]>([]);
  const [loading,   setLoading]   = useState(true);

  const refetch = () => {
    if (!locationId) { setTimeslots([]); setLoading(false); return; }
    setLoading(true);
    supabase
      .from('timeslots')
      .select('id, name, start_time, end_time, availability, interval_weeks, anchor_date, audience')
      .eq('location_id', locationId)
      .order('start_time')
      .then(({ data }) => {
        setTimeslots((data ?? []) as LocationTimeslot[]);
        setLoading(false);
      });
  };

  useEffect(refetch, [locationId]);

  return { timeslots, loading, refetch };
}

// ── useStoreTables ────────────────────────────────────────────────────────────
// Table objects for a location, each with the timeslot IDs it's available for.

export type TableSize = 'wargaming' | 'tcg';

export interface StoreTable {
  id:          string;
  name:        string;
  /**
   * What this table is, in the venue's own words. Free text since
   * 20260817010000 — it replaced `size`, which allowed only 'wargaming' or
   * 'tcg'. Null only for a row written before the backfill, which is none.
   */
  label:       string | null;
  /** The venue's own note about this table. Never shown to a customer. */
  notes:       string | null;
  enabled:     boolean;
  timeslotIds: string[];
}

export function useStoreTables(locationId: string | null) {
  const [tables,  setTables]  = useState<StoreTable[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = () => {
    if (!locationId) { setTables([]); setLoading(false); return; }
    setLoading(true);
    supabase
      .from('store_tables')
      .select('id, name, label, notes, enabled, store_table_timeslots(timeslot_id)')
      .eq('location_id', locationId)
      .order('created_at')
      .then(({ data }) => {
        const rows = (data ?? []).map(r => ({
          id:          r.id as string,
          name:        r.name as string,
          label:       (r.label ?? null) as string | null,
          notes:       (r.notes ?? null) as string | null,
          enabled:     r.enabled as boolean,
          timeslotIds: ((r.store_table_timeslots ?? []) as { timeslot_id: string }[]).map(t => t.timeslot_id),
        }));
        setTables(rows);
        setLoading(false);
      });
  };

  useEffect(refetch, [locationId]);

  return { tables, loading, refetch };
}

// ── findImpactedBookings ──────────────────────────────────────────────────────
// A capacity-reducing table change (turning it off, dropping timeslots, or
// deleting it) can leave a date+timeslot with more bookings than tables.
// Given the post-change capacity for each *losing* timeslot, this returns the
// upcoming slots that would be over capacity, so the admin can be warned.

export interface ImpactedSlot {
  date:          string;
  timeslotId:    string;
  timeslotName:  string;
  timeLabel:     string;
  bookingCount:  number;
  capacityAfter: number;
  overflow:      number;
  customers:     string[];
}

export async function findImpactedBookings(
  locationId:              string,
  capacityAfterByTimeslot: Record<string, number>,
): Promise<ImpactedSlot[]> {
  const timeslotIds = Object.keys(capacityAfterByTimeslot);
  if (timeslotIds.length === 0) return [];

  const d     = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const { data } = await supabase
    .from('bookings')
    .select('id, date, user_name, timeslot_id, timeslot:timeslots(name, start_time, end_time)')
    .eq('location_id', locationId)
    .in('timeslot_id', timeslotIds)
    .gte('date', today);

  interface Row {
    date:        string;
    user_name:   string | null;
    timeslot_id: string;
    timeslot:    { name: string; start_time: string; end_time: string } | null;
  }
  const rows = (data as unknown as Row[]) ?? [];

  // Group bookings by date + timeslot.
  const groups = new Map<string, {
    date: string; timeslotId: string; timeslotName: string;
    start: string; end: string; customers: string[];
  }>();

  for (const b of rows) {
    const key = `${b.date}__${b.timeslot_id}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        date: b.date, timeslotId: b.timeslot_id,
        timeslotName: b.timeslot?.name ?? '',
        start: b.timeslot?.start_time ?? '', end: b.timeslot?.end_time ?? '',
        customers: [],
      };
      groups.set(key, g);
    }
    g.customers.push(b.user_name ?? 'Guest');
  }

  const impacted: ImpactedSlot[] = [];
  for (const g of groups.values()) {
    const capacityAfter = capacityAfterByTimeslot[g.timeslotId] ?? 0;
    if (g.customers.length > capacityAfter) {
      impacted.push({
        date: g.date, timeslotId: g.timeslotId, timeslotName: g.timeslotName,
        timeLabel: formatBookingTime({ start_time: g.start, end_time: g.end }),
        bookingCount: g.customers.length, capacityAfter,
        overflow: g.customers.length - capacityAfter, customers: g.customers,
      });
    }
  }

  impacted.sort((a, b) => a.date.localeCompare(b.date) || a.timeLabel.localeCompare(b.timeLabel));
  return impacted;
}

// ── Booking fees ──────────────────────────────────────────────────────────────
// A venue can charge for a table. Nothing is collected here — the fee exists so
// the player is told about it before they confirm. Rules resolve most-specific
// first: a timeslot rule beats a weekday rule, which beats the venue default.

export type FeeScope = 'default' | 'day' | 'timeslot';

export interface BookingFee {
  id:           string;
  scope:        FeeScope;
  /** Full day name ('Monday') for `day` rules, else null. */
  day_of_week:  string | null;
  timeslot_id:  string | null;
  amount_cents: number;
  /** Required — every rule states its own terms. See 20260811010000. */
  message:      string;
  /**
   * The `store_tables.label` values this rule covers, or null for every table
   * type. A venue can hold both — "$10 a table" plus "$15 for TCG" — and the
   * type-specific one wins for a TCG booking. See 20260818030000.
   */
  table_labels: string[] | null;
}

/** 1000 → "$10", 1050 → "$10.50", 0 → "Free". */
export function formatFeeAmount(cents: number): string {
  if (cents === 0) return 'Free';
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/** The fee that applies to one prospective booking. */
export interface ResolvedFee {
  amountCents: number;
  message:     string;
  /** Which rule won — lets the admin UI explain why this fee applied. */
  scope:       FeeScope;
}

/**
 * Pick the fee that applies to a date + timeslot + table type. Returns null
 * when the venue has no rule that covers it (the common case — most venues
 * charge nothing).
 */
export function resolveBookingFee(
  fees:       BookingFee[],
  date:       string | null,
  timeslotId: string | null,
  tableLabel: string | null = null,
): ResolvedFee | null {
  // A rule with no table set covers every type. One that names types covers
  // only the type the player picked — so a booking with no type at all can
  // only ever match the unrestricted rules.
  const covers = (f: BookingFee) =>
    !f.table_labels?.length || (!!tableLabel && f.table_labels.includes(tableLabel));

  // Within a tier the type-specific rule wins, so a venue holding both
  // "$10 a table" and "$15 for TCG" resolves the way that reads.
  const best = (match: (f: BookingFee) => boolean) => {
    const tier = fees.filter(f => match(f) && covers(f));
    return tier.find(f => f.table_labels?.length) ?? tier[0];
  };

  const byTimeslot = timeslotId
    ? best(f => f.scope === 'timeslot' && f.timeslot_id === timeslotId)
    : undefined;
  const byDay = date
    ? best(f => f.scope === 'day' && f.day_of_week === DAY_NAMES[parseDateLocal(date).getDay()])
    : undefined;

  // Most specific wins; the venue default catches everything else.
  const winner = byTimeslot ?? byDay ?? best(f => f.scope === 'default');
  if (!winner) return null;

  return {
    amountCents: winner.amount_cents,
    message:     winner.message,
    scope:       winner.scope,
  };
}

const BOOKING_FEE_SELECT = 'id, scope, day_of_week, timeslot_id, amount_cents, message, table_labels';

/** Every fee rule at a venue — for the Manage Store editor. */
export function useLocationBookingFees(locationId: string | null) {
  const [fees,    setFees]    = useState<BookingFee[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = () => {
    if (!locationId) { setFees([]); setLoading(false); return; }
    setLoading(true);
    supabase
      .from('location_booking_fees')
      .select(BOOKING_FEE_SELECT)
      .eq('location_id', locationId)
      .then(({ data }) => {
        setFees((data ?? []) as BookingFee[]);
        setLoading(false);
      });
  };

  useEffect(refetch, [locationId]);

  return { fees, loading, refetch };
}

/**
 * The single fee that applies to one prospective booking — for the booking
 * flow. Loads the venue's rules, then resolves them locally so changing the
 * date or timeslot doesn't cost another round trip.
 */
export function useBookingFee(
  locationId: string | null,
  date:       string | null,
  timeslotId: string | null,
  /** The table type the player chose, so a type-specific fee can win. */
  tableLabel: string | null = null,
) {
  const { fees, loading } = useLocationBookingFees(locationId);
  const fee = useMemo(
    () => resolveBookingFee(fees, date, timeslotId, tableLabel),
    [fees, date, timeslotId, tableLabel],
  );
  return { fee, loading };
}

// ── useUserBookings ───────────────────────────────────────────────────────────

export function useUserBookings(userId: string | null) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(true);

  const refetch = () => {
    if (!userId) { setBookings([]); setLoading(false); return; }
    setLoading(true);
    supabase
      .from('bookings')
      .select(BOOKING_SELECT)
      .eq('user_id', userId)
      .gte('date', new Date().toISOString().slice(0, 10))
      .order('date')
      .then(({ data }) => {
        setBookings(((data as unknown as RawBookingRow[]) ?? []).map(mapBookingRow));
        setLoading(false);
      });
  };

  useEffect(refetch, [userId]);

  return { bookings, loading, refetch };
}

// ── useSuggestedBattles ───────────────────────────────────────────────────────
// Nudge players to log games we think they played: their past bookings (last 30
// days) that have no matching battle yet. A booking is "covered" when a battle
// exists on its date for the same game — or, for a booking with no game, any
// battle that day. Suggestions the user dismisses are remembered and stay hidden.

export interface BattleSuggestion {
  bookingId: string;
  date:      string;
  game:      { id: string; name: string; slug: string } | null;
  location:  { id: string; name: string };
}

const SUGGESTION_WINDOW_DAYS = 30;

// Local YYYY-MM-DD, offset by `days` (avoids the UTC shift toISOString would add).
function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useSuggestedBattles(userId: string | null) {
  const [suggestions, setSuggestions] = useState<BattleSuggestion[]>([]);
  const [loading,     setLoading]     = useState(true);

  const refetch = useCallback(() => {
    if (!userId) { setSuggestions([]); setLoading(false); return; }
    setLoading(true);

    const todayIso = isoDaysFromToday(0);
    const sinceIso = isoDaysFromToday(-SUGGESTION_WINDOW_DAYS);

    Promise.all([
      // Past bookings in the window (strictly before today — the session is done).
      supabase.from('bookings').select(BOOKING_SELECT)
        .eq('user_id', userId).gte('date', sinceIso).lt('date', todayIso)
        .order('date', { ascending: false }),
      // Battles that could cover them — same window, just the date + game.
      supabase.from('battles').select('date_played, game_id')
        .eq('user_id', userId).gte('date_played', sinceIso),
      supabase.from('battle_suggestion_dismissals').select('booking_id')
        .eq('user_id', userId),
      // Bookings you accepted an invite to feed the same nudge, on the same
      // rules — a past game you attended but haven't logged.
      supabase.from('my_incoming_booking_shares')
        .select('booking_id, date, game_id, game_name, game_slug, location_id, location_name')
        .eq('status', 'accepted').gte('date', sinceIso).lt('date', todayIso),
    ]).then(([bkRes, btRes, dmRes, shRes]) => {
      const ownBookings = ((bkRes.data as unknown as RawBookingRow[]) ?? []).map(mapBookingRow);
      // Accepted shared bookings, shaped like a booking so the loop treats them
      // identically. Their id is the owner's booking id (fine for dismissals —
      // that table is keyed by (user_id, booking_id), and the row exists).
      const sharedBookings: Booking[] = ((shRes.data as {
        booking_id: string; date: string;
        game_id: string | null; game_name: string | null; game_slug: string | null;
        location_id: string | null; location_name: string | null;
      }[] | null) ?? []).map(s => ({
        id: s.booking_id,
        date: s.date,
        user_name: null,
        // The share view deliberately withholds the owner's identity, and this
        // shape only ever feeds the battle-logging nudge — which reads the
        // date and game, never who booked it.
        user_id:            null,
        created_by_user_id: null,
        game: s.game_id ? { id: s.game_id, name: s.game_name ?? '', slug: s.game_slug ?? '' } : null,
        location: { id: s.location_id ?? '', name: s.location_name ?? '', address: null },
        timeslot: { id: '', name: '', start_time: '', end_time: '' },
      }));
      const bookings  = [...ownBookings, ...sharedBookings];
      const battles   = (btRes.data as { date_played: string; game_id: string | null }[] | null) ?? [];
      const dismissedIds = new Set((dmRes.data as { booking_id: string }[] | null ?? []).map(d => d.booking_id));
      // Duplicate bookings for the same day + game collapse into one suggestion, so
      // a single dismissal must hide the whole group — key dismissals by day+game,
      // not by the one booking id that happened to represent the group.
      const dismissedKeys = new Set(
        bookings.filter(b => dismissedIds.has(b.id)).map(b => `${b.date}|${b.game?.id ?? ''}`)
      );

      // For date+game matching, and a date-only fallback for game-less bookings.
      const coveredGameDate = new Set(battles.map(b => `${b.date_played}|${b.game_id ?? ''}`));
      const datesWithBattle = new Set(battles.map(b => b.date_played));

      const seen: Set<string> = new Set();
      const result: BattleSuggestion[] = [];
      for (const b of bookings) {
        const key = `${b.date}|${b.game?.id ?? ''}`;   // day + game groups duplicates
        if (dismissedKeys.has(key)) continue;
        const covered = b.game
          ? coveredGameDate.has(`${b.date}|${b.game.id}`)
          : datesWithBattle.has(b.date);
        if (covered) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ bookingId: b.id, date: b.date, game: b.game, location: b.location });
      }

      setSuggestions(result);
      setLoading(false);
    });
  }, [userId]);

  useEffect(() => { refetch(); }, [refetch]);

  // Remember a dismissal so the suggestion doesn't come back; hide it immediately.
  const dismiss = useCallback(async (bookingId: string) => {
    if (!userId) return;
    setSuggestions(prev => prev.filter(s => s.bookingId !== bookingId));
    await supabase.from('battle_suggestion_dismissals')
      .insert({ user_id: userId, booking_id: bookingId });
  }, [userId]);

  return { suggestions, loading, refetch, dismiss };
}
