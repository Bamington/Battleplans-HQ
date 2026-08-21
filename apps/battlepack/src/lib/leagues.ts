/**
 * leagues.ts — where a league's rounds land on the calendar.
 *
 * A league is a start date, a round length in whole weeks, and a sequence of
 * segments. The organiser does not date the rounds; they date themselves, one
 * after another, from the day the league starts. What the organiser controls is
 * the ORDER, the length, and where the Events go.
 *
 * ── An Event occupies the calendar ───────────────────────────────────────────
 *
 * Chris's call, and the rule the whole layout turns on. An Event — a painting
 * week, a launch night, a break — is not an annotation over whatever round it
 * happens to overlap. It is a stretch of time the rounds do not get to use, so
 * every round after it starts later:
 *
 *     Round 1        07/09 – 13/09
 *     Round 2        14/09 – 20/09
 *     Painting Week  21/09 – 27/09    ← an Event
 *     Round 3        28/09 – 04/10    ← pushed back by it
 *
 * That is what makes "week three is the break week" something you can say. The
 * alternative — an Event that sits alongside and moves nothing — cannot express
 * a break at all, which is the most common thing a league has.
 *
 * ── Rounds are computed, Events are authored ─────────────────────────────────
 *
 * A round's dates are a function of everything before it. An Event's LENGTH is
 * the organiser's own — it answers to something outside the league, like the
 * shop being shut or a painting competition already in the diary — and so is
 * its start, but only forwards: it can be pushed later than the rounds have
 * reached, leaving a deliberate gap, and never earlier, which would have it
 * happen during a round. See the layout for the case that proves it.
 *
 * An Event with no dates yet falls in behind the previous segment and runs a
 * week, which is the shape of nearly every break — and the organiser can then
 * move it.
 *
 * The result is WRITTEN to the segments rather than derived on read. Everything
 * downstream — the envelope, the public page, the calendar file, the change
 * emails — already reads segment dates, and a league whose dates existed only
 * as a formula would need every one of them taught to run it.
 */

import type { ScheduleSegment } from './packs';

/** A day in milliseconds, for the only arithmetic this file does. */
const DAY = 24 * 60 * 60 * 1000;

const parseLocal = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12);
};

const isoOf = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** `2026-09-07` + 6 → `2026-09-13`. Noon-anchored, so DST cannot shift it. */
export function addDays(iso: string, days: number): string {
  return isoOf(new Date(parseLocal(iso).getTime() + days * DAY));
}

/** Whole days from one date to another, inclusive of both ends. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseLocal(to).getTime() - parseLocal(from).getTime()) / DAY) + 1;
}

/** How long an Event runs, in days. A week when it has not been dated yet. */
const DEFAULT_EVENT_DAYS = 7;

/**
 * Where every segment of a league falls, laid out end to end.
 *
 * Returns only the segments whose dates would CHANGE, so a caller can write
 * exactly those rows and nothing else — which is what keeps a round length
 * change from touching every segment's `updated_at`, and more importantly what
 * keeps it from looking like an edit to segments that did not move.
 *
 * A league with no start date lays out nothing: dates computed from a date the
 * organiser has not chosen would be an invention, and every one of them would
 * move the moment they chose.
 */
export function layOutLeague(
  segments: ScheduleSegment[],
  startsOn: string | null,
  roundLengthWeeks: number,
): { id: string; starts_on: string; ends_on: string }[] {
  if (!startsOn) return [];

  const weeks  = Math.max(1, roundLengthWeeks || 1);
  const inOrder = [...segments].sort((a, b) => a.ordinal - b.ordinal);
  const changed: { id: string; starts_on: string; ends_on: string }[] = [];

  let cursor = startsOn;

  for (const segment of inOrder) {
    let starts: string;
    let ends: string;

    if (segment.kind === 'event') {
      // ── An Event keeps its LENGTH always, and its start when it can ──────
      //
      // Its length is the authored thing: a painting week is a week wherever
      // it ends up. Its start is honoured too, but only forwards — an Event
      // pinned to a date the rounds ahead of it have already passed is asking
      // to happen during Round 2, and the sequence would go backwards.
      //
      // That is not hypothetical. Put an Event after round three, then change
      // the round length from one week to two: the rounds now run past where
      // the Event was pinned. Honouring the old date there produced a league
      // whose Round 4 started before its Round 3 finished.
      //
      // So it slides along, keeping its length. Moving it LATER than the
      // sequence has reached is still the organiser's call, and leaves a
      // deliberate gap — a fortnight when nothing is on.
      const pinned = segment.starts_on;
      const span   = pinned && segment.ends_on && segment.ends_on >= pinned
        ? daysBetween(pinned, segment.ends_on)
        : DEFAULT_EVENT_DAYS;

      starts = pinned && pinned > cursor ? pinned : cursor;
      ends   = addDays(starts, span - 1);
    } else {
      starts = cursor;
      ends   = addDays(starts, weeks * 7 - 1);
    }

    if (segment.starts_on !== starts || segment.ends_on !== ends) {
      changed.push({ id: segment.id, starts_on: starts, ends_on: ends });
    }

    cursor = addDays(ends, 1);
  }

  return changed;
}

/**
 * The same layout, applied in memory.
 *
 * For the form, which has to draw the new dates before the write lands — and
 * for the demo in the gallery, which has no database at all.
 */
export function withLeagueDates(
  segments: ScheduleSegment[],
  startsOn: string | null,
  roundLengthWeeks: number,
): ScheduleSegment[] {
  const moves = new Map(
    layOutLeague(segments, startsOn, roundLengthWeeks).map(m => [m.id, m]),
  );
  return segments.map(s => {
    const move = moves.get(s.id);
    return move ? { ...s, starts_on: move.starts_on, ends_on: move.ends_on } : s;
  });
}

/**
 * What a league segment calls itself.
 *
 * ROUNDS ARE NUMBERED AMONG THEMSELVES. A painting week between rounds two and
 * three does not make the next round "Round 4" — it is still the third round of
 * play, and numbering it otherwise would have the pack disagree with everyone
 * standing in the shop.
 */
export function leagueLabels(segments: ScheduleSegment[]): Map<string, string> {
  const out = new Map<string, string>();
  let round = 0;
  for (const segment of [...segments].sort((a, b) => a.ordinal - b.ordinal)) {
    const isEvent = segment.kind === 'event';
    if (!isEvent) round += 1;
    out.set(segment.id, segment.label?.trim() || (isEvent ? 'Event' : `Round ${round}`));
  }
  return out;
}
