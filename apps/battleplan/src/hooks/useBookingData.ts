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

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseDateLocal(iso: string): Date {
  // Avoid UTC shift by treating the date string as local time
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateLabel(iso: string): string {
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
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    if (!userId) { setAdminLocations([]); setLoading(false); return; }

    supabase
      .from('locations')
      .select('id, name, icon')
      .contains('admins', [userId])
      .order('name')
      .then(({ data }) => {
        setAdminLocations(data ?? []);
        setLoading(false);
      });
  }, [userId]);

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
      .select(`
        id, date, user_name,
        game:games(id, name, slug),
        location:locations(id, name),
        timeslot:timeslots(id, name, start_time, end_time)
      `)
      .in('location_id', locationIds)
      .gte('date', today)
      .order('date')
      .order('timeslot_id')
      .then(({ data }) => {
        setBookings((data as unknown as UpcomingBooking[]) ?? []);
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
      supabase.from('locations').select('tables').eq('id', locationId).single(),
      supabase.from('bookings').select('id', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .eq('date', date)
        .eq('timeslot_id', timeslotId),
    ]).then(([locRes, bookingsRes]) => {
      const totalTables   = locRes.data?.tables ?? 0;
      const bookedCount   = bookingsRes.count   ?? 0;
      setAvailable(Math.max(0, totalTables - bookedCount));
      setLoading(false);
    });
  }, [locationId, date, timeslotId]);

  return { available, loading };
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
      .select(`
        id, date, user_name,
        game:games(id, name, slug),
        location:locations(id, name),
        timeslot:timeslots(id, name, start_time, end_time)
      `)
      .eq('user_id', userId)
      .gte('date', new Date().toISOString().slice(0, 10))
      .order('date')
      .then(({ data }) => {
        setBookings((data as unknown as Booking[]) ?? []);
        setLoading(false);
      });
  };

  useEffect(refetch, [userId]);

  return { bookings, loading, refetch };
}
