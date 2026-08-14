import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@battleplans/ui';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Game {
  id:   string;
  name: string;
  slug: string;
}

export interface Location {
  id:   string;
  name: string;
  icon: string;
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
      .select('id, name, icon')
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

export interface DaySlot { id: string; availability: string[] }

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
      supabase.from('timeslots').select('id, availability').eq('location_id', locationId),
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
        .select('id, availability')
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
      .select('id, name, start_time, end_time, availability')
      .eq('location_id', locationId)
      .contains('availability', [dayName])
      .order('start_time')
      .then(({ data }) => {
        setTimeslots(data ?? []);
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
      .select('id, name, icon')
      .contains('admins', [userId])
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
      supabase.from('locations').select('id, name, icon').contains('admins', [userId]),
      supabase.from('location_staff').select('location_id').eq('user_id', userId),
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
          .from('locations').select('id, name, icon').in('id', staffIds);
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

export interface StaffMember {
  userId:     string;
  handle:     string | null;
  /** Their real name. Only venue admins can see this — see 20260812050000. */
  username:   string | null;
  avatarPath: string | null;
  createdAt:  string | null;
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
        }[] | null) ?? []).map(p => ({
          userId:     p.user_id,
          handle:     p.handle,
          username:   p.username,
          avatarPath: p.avatar_path,
          createdAt:  null,
        })));
        setLoading(false);
      });
  }, [locationId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { staff, loading, refetch };
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

      const holds = new Map<string, VenueEventHold>();
      for (const row of ((holdData as unknown as RawHoldRow[]) ?? [])) {
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

export type BlockRecurrence = 'none' | 'weekly';
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
  /** Last day the rule can apply; null runs until deleted. */
  until_date:     string | null;
  table_scope:    BlockTableScope;
  /** The tables this block covers. Empty when table_scope is 'all'. */
  tableIds:       string[];
  location:       { id: string; name: string; icon: string };
}

/** The recurrence fields, for callers that don't need the whole row. */
export type BlockRule = Pick<
  BlockedDate, 'date' | 'recurrence' | 'interval_weeks' | 'days_of_week' | 'until_date'
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
 * Does this block apply on `iso`?
 *
 * A one-off applies on exactly its date. A weekly rule applies on the listed
 * weekdays, in every `interval_weeks`-th week counted from the week its series
 * starts, from `date` until `until_date` inclusive.
 *
 * Anchoring the interval to whole weeks rather than to day-differences is what
 * makes "every second Friday" mean the same Fridays no matter which day of the
 * week the rule happened to be created on.
 */
export function blockAppliesOn(rule: BlockRule, iso: string): boolean {
  if (rule.recurrence !== 'weekly') return rule.date === iso;

  const day = parseDateLocal(iso);
  if (iso < rule.date) return false;
  if (rule.until_date && iso > rule.until_date) return false;
  if (!rule.days_of_week.includes(DAY_NAMES[day.getDay()])) return false;

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
  'date, recurrence, interval_weeks, days_of_week, until_date, table_scope, blocked_date_tables(table_id)';

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
        id, date, description, blocked_tables,
        recurrence, interval_weeks, days_of_week, until_date,
        table_scope, blocked_date_tables(table_id),
        location:locations(id, name, icon)
      `)
      .in('location_id', locationIds)
      // A weekly rule started in March is still live in June, so it can't be
      // filtered on its start date. It drops off the list once it has expired.
      .or(`and(recurrence.eq.none,date.gte.${today}),and(recurrence.neq.none,or(until_date.is.null,until_date.gte.${today}))`)
      .order('date')
      .then(({ data }) => {
        // Flatten the join rows into plain ids, so nothing downstream has to
        // know the shape Supabase returns a nested select in.
        setBlockedDates(((data ?? []) as unknown as (Omit<BlockedDate, 'tableIds'> & {
          blocked_date_tables?: { table_id: string }[] | null;
        })[]).map(r => ({
          ...r,
          tableIds: (r.blocked_date_tables ?? []).map(t => t.table_id),
        })));
        setLoading(false);
      });
  };

  useEffect(refetch, [key]);

  return { blockedDates, loading, refetch };
}

// ── useTableAvailability ──────────────────────────────────────────────────────
// Returns how many tables are free for a given location + date + timeslot.
// null while loading, number when resolved.

export function useTableAvailability(
  locationId:  string | null,
  date:        string | null,
  timeslotId:  string | null,
) {
  const [available, setAvailable] = useState<number | null>(null);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    if (!locationId || !date || !timeslotId) { setAvailable(null); return; }

    setLoading(true);
    setAvailable(null);

    Promise.all([
      // Capacity is now a SET, not a count: which enabled tables serve this
      // timeslot. A block names tables, so the two have to be intersected
      // rather than subtracted — a blocked table that doesn't serve this
      // timeslot was never part of this slot's capacity to begin with.
      supabase.from('store_table_timeslots')
        .select('table_id, store_tables!inner(id, enabled, location_id)')
        .eq('timeslot_id', timeslotId)
        .eq('store_tables.enabled', true)
        .eq('store_tables.location_id', locationId),
      // booking_occupancy, not bookings: a regular user can no longer read
      // other people's bookings, but they still need the slot's taken-count to
      // see availability. The view exposes occupancy without any identity.
      supabase.from('booking_occupancy').select('id', { count: 'exact', head: true })
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
      const capacityIds = ((tablesRes.data as { table_id: string }[] | null) ?? [])
        .map(r => r.table_id);
      const bookedCount = bookingsRes.count ?? 0;

      const rules = (blockedRes.data ?? []).map(mapBlockCoverage);
      const { venueClosed, blockedTableIds } = blockedTablesOn(rules, date);

      const effectiveTables = venueClosed
        ? 0
        : capacityIds.filter(id => !blockedTableIds.has(id)).length;

      setAvailable(Math.max(0, effectiveTables - bookedCount));
      setLoading(false);
    });
  }, [locationId, date, timeslotId]);

  return { available, loading };
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
}

export function useLocationTimeslots(locationId: string | null) {
  const [timeslots, setTimeslots] = useState<LocationTimeslot[]>([]);
  const [loading,   setLoading]   = useState(true);

  const refetch = () => {
    if (!locationId) { setTimeslots([]); setLoading(false); return; }
    setLoading(true);
    supabase
      .from('timeslots')
      .select('id, name, start_time, end_time, availability')
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
  size:        TableSize;
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
      .select('id, name, size, enabled, store_table_timeslots(timeslot_id)')
      .eq('location_id', locationId)
      .order('created_at')
      .then(({ data }) => {
        const rows = (data ?? []).map(r => ({
          id:          r.id as string,
          name:        r.name as string,
          size:        r.size as TableSize,
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
 * Pick the fee that applies to a date + timeslot. Returns null when the venue
 * has no rule that covers it (the common case — most venues charge nothing).
 */
export function resolveBookingFee(
  fees:       BookingFee[],
  date:       string | null,
  timeslotId: string | null,
): ResolvedFee | null {
  const byTimeslot = timeslotId
    ? fees.find(f => f.scope === 'timeslot' && f.timeslot_id === timeslotId)
    : undefined;
  const byDay = date
    ? fees.find(f => f.scope === 'day' && f.day_of_week === DAY_NAMES[parseDateLocal(date).getDay()])
    : undefined;

  // Most specific wins; the venue default catches everything else.
  const winner = byTimeslot ?? byDay ?? fees.find(f => f.scope === 'default');
  if (!winner) return null;

  return {
    amountCents: winner.amount_cents,
    message:     winner.message,
    scope:       winner.scope,
  };
}

const BOOKING_FEE_SELECT = 'id, scope, day_of_week, timeslot_id, amount_cents, message';

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
) {
  const { fees, loading } = useLocationBookingFees(locationId);
  const fee = useMemo(
    () => resolveBookingFee(fees, date, timeslotId),
    [fees, date, timeslotId],
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
