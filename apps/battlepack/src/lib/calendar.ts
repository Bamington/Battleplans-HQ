/**
 * calendar.ts — turning a published pack into something a calendar accepts.
 *
 * Three destinations, one description of the event. Google and Outlook take a
 * URL with the event in the query string; everything else (Apple Calendar,
 * desktop Outlook, Thunderbird, Android) takes an .ics file. They disagree
 * about syntax and about nothing else, so the event is shaped once by
 * packCalendarEvent() and each builder only formats it.
 *
 * TIMES ARE FLOATING, AND THAT IS THE WHOLE TIMEZONE STORY. A pack stores a
 * `date` and a `time` with no zone, because an event happens at 10am at the
 * venue — not at an instant. An .ics DTSTART with no `Z` and no TZID means
 * exactly that: whatever the reading calendar calls 10am. Converting to UTC
 * would need a venue timezone we do not store, and getting it wrong moves
 * somebody's Saturday by an hour. So nothing here ever constructs a local Date
 * from pack data; the arithmetic runs in UTC purely as a safe integer clock and
 * the components come back out as wall-clock digits.
 */

import type { Pack, PublicPack } from './packs';
import { weekdayNameOf } from './recurrence';
import { leagueLabels } from './leagues';

/** A calendar event, in the only terms all three destinations share. */
export interface CalendarEvent {
  /** Stable across re-adds, so a second add updates rather than duplicates. */
  uid: string;
  title: string;
  /** Venue name and address, as one line. */
  location: string;
  description: string;
  /** The pack's own page — the thing that is always up to date. */
  url: string;
  /** No start time on the pack means a day in the diary, not a slot in it. */
  allDay: boolean;
  /** Wall-clock start, as [y, m, d, hour, minute]; hour/minute 0 when allDay. */
  start: WallClock;
  /** RRULE body for a repeating event, without the `RRULE:` prefix. */
  rrule?: string | null;
  /**
   * Wall-clock end. For an all-day event this is the day AFTER the last one —
   * every calendar format treats an all-day end as exclusive, and an event
   * that ends on its own start date is a zero-length event.
   */
  end: WallClock;
}

type WallClock = [number, number, number, number, number];

// ── Wall-clock arithmetic ────────────────────────────────────────────────────

/**
 * Date + time as a UTC millisecond count.
 *
 * UTC is used as a calendar with no daylight saving rather than as a timezone:
 * adding 90 minutes to 00:30 has to land on 02:00 on every date of the year,
 * and local-time arithmetic does not do that on the two days a year the clocks
 * move. The value never leaves this file as an instant.
 */
const toClock = (date: string, time?: string | null): number => {
  const [y, m, d] = date.split('-').map(Number);
  const [hh = 0, mi = 0] = (time ?? '00:00').split(':').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mi || 0);
};

const fromClock = (ms: number): WallClock => {
  const d = new Date(ms);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()];
};

const addMinutes = (ms: number, minutes: number) => ms + minutes * 60_000;

const pad = (n: number) => String(n).padStart(2, '0');

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** '2026-09-19' → '19 Sep 2026', for the round list inside a league's entry. */
const formatDayLabel = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return y && m && d ? `${d} ${MONTHS[m - 1]} ${y}` : iso;
};

/** `20260906` — the date half, shared by every format. */
const ymd = ([y, m, d]: WallClock) => `${y}${pad(m)}${pad(d)}`;

/** `20260906T100000` — ICS and Google's compact form. */
const ymdhms = (w: WallClock) => `${ymd(w)}T${pad(w[3])}${pad(w[4])}00`;

/** `2026-09-06T10:00:00` — Outlook wants ISO-ish and dashed. */
const isoish = (w: WallClock) => `${w[0]}-${pad(w[1])}-${pad(w[2])}T${pad(w[3])}:${pad(w[4])}:00`;

// ── The event ────────────────────────────────────────────────────────────────

/**
 * Which day of the week an RRULE means, in the two letters ICS uses.
 */
const ICS_DAYS: Record<string, string> = {
  Monday: 'MO', Tuesday: 'TU', Wednesday: 'WE', Thursday: 'TH',
  Friday: 'FR', Saturday: 'SA', Sunday: 'SU',
};

/**
 * A repeating event's rule, or null when it happens once.
 *
 * UNTIL rather than COUNT. RFC 5545 requires UNTIL to have the same value type
 * as DTSTART, and this file's DTSTARTs are floating — so a floating UNTIL is
 * both legal and required, and no occurrences have to be counted to write it.
 * COUNT would have meant reimplementing the weekday and week-of-month
 * arithmetic that BattlePlan already owns, in a second place, to produce a
 * number the rule can express directly.
 */
function recurrenceRule(pack: Pack, allDay: boolean, onDay: string | null): string | null {
  if (!pack.recurrence || pack.recurrence === 'none') return null;

  // ONE VEVENT REPEATS ON ITS OWN WEEKDAY, not on the pack's whole list.
  //
  // The two readings only diverge for a multi-day event, and there the pack's
  // list is the days it RUNS ON — Saturday and Sunday for a weekender. Handing
  // that list to both days' events would repeat Saturday's timetable on Sunday
  // as well, doubling a fortnightly weekender into four events. Each day
  // repeats on the day it is, which is what BYDAY means once DTSTART is fixed.
  //
  // A single-day pack keeps the full list, because there the list is a real
  // answer: a club running Friday AND Saturday nights is one event repeating
  // on both, and one VEVENT is where that belongs.
  const names = onDay ? [onDay] : (pack.days_of_week ?? []);
  const days = names.map((d: string) => ICS_DAYS[d]).filter(Boolean);
  if (days.length === 0) return null;

  // An until_date is mandatory for a recurring pack, so an unbounded series is
  // a state the database refuses rather than one to guess a horizon for.
  if (!pack.until_date) return null;

  // THE LAST MOMENT OF THE LAST DAY, not that day at some start time. UNTIL is
  // inclusive of instants at or before it, so a rule ending "18 Dec at 10:00"
  // drops an occurrence that starts at 18:00 on the 18th — the series would end
  // a fortnight early and nothing would say so. 23:59 covers any start time,
  // and matching a floating DTSTART with a floating UNTIL is what the spec
  // requires anyway.
  const until = toClock(pack.until_date, allDay ? null : '23:59');
  const untilPart = allDay ? ymd(fromClock(until)) : ymdhms(fromClock(until));

  if (pack.recurrence === 'monthly') {
    // BYDAY carries the ordinal for a monthly rule: 1FR is the first Friday,
    // -1FR the last. Same -1-is-last convention as blocked_dates.
    const nth = pack.week_of_month ?? 1;
    return `FREQ=MONTHLY;BYDAY=${days.map(d => `${nth}${d}`).join(',')};UNTIL=${untilPart}`;
  }

  const interval = (pack.interval_weeks ?? 1) > 1 ? `INTERVAL=${pack.interval_weeks};` : '';
  return `FREQ=WEEKLY;${interval}BYDAY=${days.join(',')};UNTIL=${untilPart}`;
}

/**
 * A published pack as calendar events — one per day, or one for a league.
 *
 * ONE VEVENT PER SEGMENT is the rule for `days`, because a two-day tournament
 * is two entries in a diary and not one block spanning the night between them.
 * Each is timed from its own day, so day two starting earlier than day one is
 * expressible — which is the thing a single pack-level start time never was.
 *
 * A LEAGUE IS ONE EVENT, settled with Chris: an all-day span for the whole
 * thing, with the rounds listed in the description. Six diary entries for a
 * self-organised league is more noise than help, and only the league's own
 * start date is worth an email, so one entry is also the honest shape.
 *
 * A pack with no dated segment returns nothing. A pack is publishable before
 * its dates are agreed, and there is nothing to put in a calendar until it has
 * one — the button is dropped rather than adding an event to today.
 *
 * `origin` is passed in rather than read from `window` so this stays a pure
 * function: it is the only part that depends on where the page is served from,
 * and a test should not have to fake a location to check the rest.
 */
export function packCalendarEvents(data: PublicPack, origin: string): CalendarEvent[] {
  const { pack, venue, host, segments = [] } = data;
  if (!pack) return [];

  const slug = data.display_slug ?? pack.slug ?? '';
  const url  = `${origin.replace(/\/$/, '')}/${slug}`;

  // Deliberately not the pack's description: a blurb is markdown, is often
  // several paragraphs, and renders as a wall of asterisks in a calendar
  // popup. What belongs here is the handful of facts somebody re-reads from
  // the diary entry, and a link to the page that has the rest — and stays
  // right when this copy does not.
  const baseDescription = [
    pack.format,
    host?.name ? `Hosted by ${host.name}` : null,
    venue?.name ? `At ${venue.name}` : null,
  ].filter(Boolean);

  const location = [venue?.name, venue?.address].filter(Boolean).join(', ');
  const ordered  = [...segments].sort((a, b) => a.ordinal - b.ordinal);
  const dated    = ordered.filter(s => s.starts_on);

  if (dated.length === 0) return [];

  // ── A league: one span, rounds in the description ──────────────────────────
  if (pack.schedule_shape === 'periods') {
    const first = dated[0];
    const last  = dated[dated.length - 1];
    const lastDay = last.ends_on && last.ends_on > (last.starts_on ?? '')
      ? last.ends_on
      : last.starts_on!;

    // The same labeller the page and the editor use, so an Event in the
    // description is not numbered as a round it is not.
    const names  = leagueLabels(dated);
    const rounds = dated.map(s => `${names.get(s.id) ?? 'Round'} — ${formatDayLabel(s.starts_on!)}`);

    return [{
      uid: `battlepack-${pack.id}@battlepack.app`,
      title: pack.name,
      location,
      description: [...baseDescription, '', ...rounds, '', url].join('\n'),
      url,
      allDay: true,
      // Exclusive end, as every format here treats an all-day end.
      start: fromClock(toClock(first.starts_on!)),
      end: fromClock(addMinutes(toClock(lastDay), 24 * 60)),
      rrule: null,
    }];
  }

  // ── Days: one event each ───────────────────────────────────────────────────
  const many = dated.length > 1;

  return dated.map((segment, index) => {
    // Both times or neither — the database enforces that an end needs a start,
    // and a day with no times is a marker rather than an appointment.
    const timed  = !!(segment.starts_at && segment.ends_at);
    const allDay = !timed;
    const lastDay = segment.ends_on && segment.ends_on > segment.starts_on!
      ? segment.ends_on
      : segment.starts_on!;

    const start = toClock(segment.starts_on!, timed ? segment.starts_at : null);
    const end   = timed
      ? toClock(lastDay, segment.ends_at)
      : addMinutes(toClock(lastDay), 24 * 60);

    const dayName = segment.label?.trim() || `Day ${index + 1}`;

    return {
      // The segment id, not the index: a stable UID is what makes a second add
      // correct the existing entry rather than leaving two, and an index would
      // shift the moment a day is inserted before another.
      uid: `battlepack-${pack.id}-${segment.id}@battlepack.app`,
      title: many ? `${pack.name} — ${dayName}` : pack.name,
      location,
      description: [...baseDescription, url].join('\n'),
      url,
      allDay,
      start: fromClock(start),
      end: fromClock(end),
      // Its own weekday once there is more than one day; see recurrenceRule.
      rrule: recurrenceRule(pack, allDay, many ? weekdayNameOf(segment.starts_on!) : null),
    };
  });
}


// ── ICS ──────────────────────────────────────────────────────────────────────

/** Escape a value for a content line: backslash, semicolon, comma, newline. */
const icsEscape = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/**
 * Fold a content line to 75 octets, per RFC 5545.
 *
 * Not decoration — a long DESCRIPTION or URL on one line is what makes strict
 * parsers (Apple Calendar among them) reject the whole file rather than the
 * line. Folding counts UTF-8 BYTES, so a line of emoji folds sooner than a line
 * of ASCII, and a continuation always begins with a single space.
 */
const fold = (line: string): string => {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = '';
  let bytes = 0;
  // Iterate by code point, never by index — splitting mid-surrogate produces a
  // file whose text is corrupt in exactly one place.
  for (const char of line) {
    const size = encoder.encode(char).length;
    // 74 on continuation lines: the leading space is one of the 75.
    if (bytes + size > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
};

/** `20260906T093000Z` — the one genuinely-UTC stamp in the file. */
const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
  `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** One VEVENT in a VCALENDAR, ready to be handed to any calendar app. */
/** One VEVENT block, without the calendar wrapper. */
function veventLines(event: CalendarEvent): string[] {
  // VALUE=DATE for an all-day event. A DTSTART of `20260906` and one of
  // `20260906T000000` are different things: the first is a day in the diary,
  // the second is a midnight appointment.
  const [dtstart, dtend] = event.allDay
    ? [`DTSTART;VALUE=DATE:${ymd(event.start)}`, `DTEND;VALUE=DATE:${ymd(event.end)}`]
    : [`DTSTART:${ymdhms(event.start)}`, `DTEND:${ymdhms(event.end)}`];

  return [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${utcStamp(new Date())}`,
    dtstart,
    dtend,
    ...(event.rrule ? [`RRULE:${event.rrule}`] : []),
    `SUMMARY:${icsEscape(event.title)}`,
    ...(event.location    ? [`LOCATION:${icsEscape(event.location)}`]       : []),
    ...(event.description ? [`DESCRIPTION:${icsEscape(event.description)}`] : []),
    `URL:${event.url}`,
    'END:VEVENT',
  ];
}

/**
 * A calendar file holding every day of an event.
 *
 * A VCALENDAR is a container, which is the whole reason a multi-day pack can
 * be added in one click here and cannot through Google's or Outlook's URL:
 * those are pre-filled compose forms with room for exactly one event.
 */
export function icsForEvents(events: CalendarEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Battleplans//BattlePack//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events.flatMap(veventLines),
    'END:VCALENDAR',
  ];

  // CRLF, not \n. The spec says so and the strict parsers mean it.
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** One event's file. Kept for the single-day case and the gallery. */
export function icsForEvent(event: CalendarEvent): string {
  return icsForEvents([event]);
}

/**
 * A filename an attendee can find again in their downloads folder.
 *
 * ASCII only, because a Content-Disposition-less blob download takes the
 * filename verbatim and Windows will not accept several of the characters an
 * event name can legally contain.
 */
export const icsFilename = (event: CalendarEvent) =>
  `${event.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'event'}.ics`;

/**
 * Hand the .ics to the browser as a download.
 *
 * A blob URL with a `download` attribute, revoked on the next tick — the click
 * is synchronous, so by the time the timeout runs the browser has taken the
 * bytes and the URL is only holding memory.
 */
export function downloadIcs(events: CalendarEvent[]): void {
  if (events.length === 0) return;
  const blob = new Blob([icsForEvents(events)], { type: 'text/calendar;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  // Named for the event, not for the day: a two-day tournament downloads one
  // file, and "july-rtt-day-1.ics" would be a lie about what is inside it.
  link.download = icsFilename(events[0]);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 0);
}

// ── Web calendars ────────────────────────────────────────────────────────────

/**
 * Google Calendar's event-composer URL.
 *
 * `dates` takes the same compact form as ICS and reads it the same way: no `Z`
 * means the user's own calendar timezone, which is the floating behaviour we
 * want. All-day is expressed by passing bare dates, again with an exclusive
 * end.
 */
export function googleCalendarUrl(event: CalendarEvent): string {
  const dates = event.allDay
    ? `${ymd(event.start)}/${ymd(event.end)}`
    : `${ymdhms(event.start)}/${ymdhms(event.end)}`;

  const params = new URLSearchParams({
    action:   'TEMPLATE',
    text:     event.title,
    dates,
    details:  event.description,
    location: event.location,
    // Google's template URL is the one of the two that understands repetition,
    // so a recurring event arrives as a series rather than a single occurrence.
    ...(event.rrule ? { recur: `RRULE:${event.rrule}` } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/**
 * Outlook on the web (outlook.com and Microsoft 365 accounts both land here).
 *
 * Desktop Outlook is not this — it is the .ics option, which it opens natively.
 */
export function outlookCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    path:    '/calendar/action/compose',
    rru:     'addevent',
    subject: event.title,
    startdt: event.allDay ? ymd(event.start).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : isoish(event.start),
    enddt:   event.allDay ? ymd(event.end).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')   : isoish(event.end),
    body:    event.description,
    location: event.location,
    ...(event.allDay ? { allday: 'true' } : {}),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}
