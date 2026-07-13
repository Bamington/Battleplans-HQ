import { useEffect, useState } from 'react';
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
  game:      { id: string; name: string; slug: string } | null;
  location:  { id: string; name: string };
  timeslot:  { id: string; name: string; start_time: string; end_time: string };
}

// Raw booking row as selected from Supabase: the per-booking snapshot columns
// plus the live joins (kept as a fallback).
interface RawBookingRow {
  id:                   string;
  date:                 string;
  user_name:            string | null;
  location_id:          string | null;
  timeslot_id:          string | null;
  location_name:        string | null;
  timeslot_name:        string | null;
  timeslot_start_time:  string | null;
  timeslot_end_time:    string | null;
  game:      { id: string; name: string; slug: string } | null;
  location:  { id: string; name: string } | null;
  timeslot:  { id: string; name: string; start_time: string; end_time: string } | null;
}

// Columns to select for a displayable booking: the snapshot columns first, then
// the live joins as a fallback for rows that predate the snapshot.
const BOOKING_SELECT = `
  id, date, user_name, location_id, timeslot_id,
  location_name, timeslot_name, timeslot_start_time, timeslot_end_time,
  game:games(id, name, slug),
  location:locations(id, name),
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
    game:      r.game ?? null,
    location: {
      id:   r.location?.id ?? r.location_id ?? '',
      name: r.location_name ?? r.location?.name ?? '',
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
    supabase
      .from('games')
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
    const base = supabase.from('games').select('id, name, slug');
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

// ── useAvailableDates ─────────────────────────────────────────────────────────
// Returns the next 60 dates that have at least one timeslot at the location,
// minus any fully-blocked dates (blocked_tables IS NULL).

export function useAvailableDates(locationId: string | null) {
  const [dates,   setDates]   = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) { setDates([]); return; }

    setLoading(true);

    Promise.all([
      supabase
        .from('timeslots')
        .select('availability')
        .eq('location_id', locationId),
      supabase
        .from('blocked_dates')
        .select('date, blocked_tables')
        .eq('location_id', locationId)
        .gte('date', new Date().toISOString().slice(0, 10)),
    ]).then(([tsRes, bdRes]) => {
      // Collect all available day names across all timeslots
      const availableDays = new Set<string>(
        (tsRes.data ?? []).flatMap(ts => ts.availability as string[])
      );

      // Collect fully-blocked dates (blocked_tables IS NULL = entire venue blocked)
      const fullyBlocked = new Set<string>(
        (bdRes.data ?? [])
          .filter(bd => bd.blocked_tables === null)
          .map(bd => bd.date)
      );

      // Generate next 60 calendar days, keep those whose weekday has a timeslot
      const result: { value: string; label: string }[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 1; i <= 60 && result.length < 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayName = DAY_NAMES[d.getDay()];
        if (availableDays.has(dayName) && !fullyBlocked.has(iso)) {
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

// ── useUpcomingBookings ───────────────────────────────────────────────────────
// Returns all bookings on or after today across the given location IDs,
// ordered by date then timeslot.

export interface UpcomingBooking {
  id:        string;
  date:      string;
  user_name: string | null;
  game:      { id: string; name: string; slug: string } | null;
  location:  { id: string; name: string };
  timeslot:  { id: string; name: string; start_time: string; end_time: string };
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

export interface BlockedDate {
  id:             string;
  date:           string;
  description:    string | null;
  blocked_tables: number | null;
  location:       { id: string; name: string; icon: string };
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
        location:locations(id, name, icon)
      `)
      .in('location_id', locationIds)
      .gte('date', today)
      .order('date')
      .then(({ data }) => {
        setBlockedDates((data as unknown as BlockedDate[]) ?? []);
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
      // Total capacity = enabled tables that are available for this timeslot.
      supabase.from('store_table_timeslots')
        .select('table_id, store_tables!inner(id)', { count: 'exact', head: true })
        .eq('timeslot_id', timeslotId)
        .eq('store_tables.enabled', true),
      supabase.from('bookings').select('id', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .eq('date', date)
        .eq('timeslot_id', timeslotId),
      // Blocked dates apply to the whole day, so they reduce the tables
      // available for every timeslot on that date.
      supabase.from('blocked_dates').select('blocked_tables')
        .eq('location_id', locationId)
        .eq('date', date),
    ]).then(([tablesRes, bookingsRes, blockedRes]) => {
      const totalTables = tablesRes.count ?? 0;
      const bookedCount = bookingsRes.count ?? 0;

      // A NULL blocked_tables means the entire venue is blocked that day.
      const blocks        = blockedRes.data ?? [];
      const fullyBlocked  = blocks.some(b => b.blocked_tables === null);
      const blockedTables = fullyBlocked
        ? totalTables
        : blocks.reduce((sum, b) => sum + (b.blocked_tables ?? 0), 0);

      const effectiveTables = Math.max(0, totalTables - blockedTables);
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
