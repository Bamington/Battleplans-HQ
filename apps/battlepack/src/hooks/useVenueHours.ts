/**
 * useVenueHours — when a venue's tables are normally bookable.
 *
 * The earliest a timeslot opens and the latest one closes, across every slot
 * the venue has. Used to warn an organiser whose event starts outside those
 * hours — a 9:30 start at a shop that opens at 10:00 is usually a typo, and
 * finding out on the day is the wrong time.
 *
 * A WARNING, NOT A RULE. An event can legitimately start before opening: a
 * venue can unlock early for a tournament, and a club at a hired hall keeps its
 * own hours entirely. So this only ever informs, and nothing here blocks a
 * save.
 *
 * Null when the venue has no timeslots at all, which is most of the time for a
 * hall that has never taken a booking — there is no "usual" to compare against,
 * and inventing one would produce a warning on every event.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@battleplans/ui';

export interface VenueHours {
  /** Earliest timeslot start, 'HH:MM'. */
  opens:  string;
  /** Latest timeslot end, 'HH:MM'. */
  closes: string;
}

/** 'HH:MM:SS' or 'HH:MM' → 'HH:MM'. Compared as strings, which sorts correctly. */
function hhmm(t: string): string {
  return t.slice(0, 5);
}

export function useVenueHours(locationId: string | null): VenueHours | null {
  const [hours, setHours] = useState<VenueHours | null>(null);

  useEffect(() => {
    if (!locationId) { setHours(null); return; }
    let cancelled = false;

    supabase
      .from('timeslots')
      .select('start_time, end_time')
      .eq('location_id', locationId)
      .then(({ data, error }) => {
        if (cancelled) return;
        const rows = (data ?? []) as { start_time: string; end_time: string }[];
        if (error || rows.length === 0) { setHours(null); return; }

        setHours({
          opens:  rows.reduce((min, r) => (hhmm(r.start_time) < min ? hhmm(r.start_time) : min), hhmm(rows[0].start_time)),
          closes: rows.reduce((max, r) => (hhmm(r.end_time)   > max ? hhmm(r.end_time)   : max), hhmm(rows[0].end_time)),
        });
      });

    return () => { cancelled = true; };
  }, [locationId]);

  return hours;
}

/** 'HH:MM' → '9:30 AM'. Matches how BattlePlan writes a timeslot. */
export function formatHour(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/**
 * What's odd about this start time, if anything.
 *
 * Only compares when there is both a time and some hours to compare against;
 * everything else is "nothing to say".
 */
export function startTimeWarning(startsAt: string | null, hours: VenueHours | null): string | null {
  if (!startsAt || !hours) return null;
  const t = hhmm(startsAt);
  if (t < hours.opens)  return `Starts before this venue usually opens (${formatHour(hours.opens)}).`;
  if (t > hours.closes) return `Starts after this venue usually closes (${formatHour(hours.closes)}).`;
  return null;
}
