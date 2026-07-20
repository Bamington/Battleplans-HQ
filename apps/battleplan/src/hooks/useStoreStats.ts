/**
 * useStoreStats.ts — Loads a venue's booking history for the Store Stats page.
 *
 * Returns raw bookings; the page applies the time-range filter and the
 * aggregations in `lib/storeStats`. RLS already restricts bookings to venues the
 * signed-in user administers, so it is the real guard here — passing a
 * locationId you don't administer simply returns nothing.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@battleplans/ui';
import type { StoreBooking } from '../lib/storeStats';

/** Rows per request. PostgREST caps a single response (1000 by default), so we
 *  page explicitly — otherwise a busy venue would silently under-report. */
const PAGE = 500;

const SELECT = `
  id, date, user_id, user_name, user_email,
  timeslot_id, timeslot_name, timeslot_start_time,
  game:games(id, name, slug),
  timeslot:timeslots(id, name, start_time)
`;

interface RawRow {
  id:                  string;
  date:                string;
  user_id:             string | null;
  user_name:           string | null;
  user_email:          string | null;
  timeslot_id:         string | null;
  timeslot_name:       string | null;
  timeslot_start_time: string | null;
  game:     { id: string; name: string; slug: string } | null;
  timeslot: { id: string; name: string; start_time: string } | null;
}

/** Prefer the booking's point-in-time snapshot over the live join, so renaming
 *  or deleting a timeslot doesn't rewrite (or drop) historical bookings. */
function mapRow(r: RawRow): StoreBooking {
  const name  = r.timeslot_name       ?? r.timeslot?.name       ?? null;
  const start = r.timeslot_start_time ?? r.timeslot?.start_time ?? null;
  return {
    id:         r.id,
    date:       r.date,
    user_id:    r.user_id,
    user_name:  r.user_name,
    user_email: r.user_email,
    game:       r.game ?? null,
    timeslot:   name
      ? { id: r.timeslot?.id ?? r.timeslot_id ?? name, name, start_time: start ?? '' }
      : null,
  };
}

export function useStoreStats(locationId: string | null) {
  const [bookings, setBookings] = useState<StoreBooking[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!locationId) { setBookings([]); setLoading(false); return; }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const all: StoreBooking[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error: err } = await supabase
          .from('bookings')
          .select(SELECT)
          .eq('location_id', locationId)
          .order('date', { ascending: true })
          .range(from, from + PAGE - 1);

        if (err) { if (!cancelled) { setError(err.message); setLoading(false); } return; }

        const batch = (data as unknown as RawRow[]) ?? [];
        all.push(...batch.map(mapRow));
        if (batch.length < PAGE) break;
      }

      if (cancelled) return;
      setBookings(all);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [locationId]);

  useEffect(() => { const cleanup = refetch(); return cleanup; }, [refetch]);

  return { bookings, loading, error, refetch };
}
