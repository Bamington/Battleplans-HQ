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

import type { PublicPack, ScheduleItem } from './packs';

/**
 * How long an event is assumed to last when its schedule is empty.
 *
 * Most packs have rounds and breaks, and their durations add up to the real
 * length of the day — that is preferred whenever it exists. This is only the
 * floor for a pack published before the timetable was filled in. Three hours
 * blocks out a recognisable evening or morning without swallowing the whole
 * day, which a nine-hour guess would.
 */
const DEFAULT_DURATION_MINUTES = 180;

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

/** `20260906` — the date half, shared by every format. */
const ymd = ([y, m, d]: WallClock) => `${y}${pad(m)}${pad(d)}`;

/** `20260906T100000` — ICS and Google's compact form. */
const ymdhms = (w: WallClock) => `${ymd(w)}T${pad(w[3])}${pad(w[4])}00`;

/** `2026-09-06T10:00:00` — Outlook wants ISO-ish and dashed. */
const isoish = (w: WallClock) => `${w[0]}-${pad(w[1])}-${pad(w[2])}T${pad(w[3])}:${pad(w[4])}:00`;

// ── The event ────────────────────────────────────────────────────────────────

/** Total length of the day as the timetable describes it, or null if empty. */
const scheduledMinutes = (schedule: ScheduleItem[]): number | null => {
  const total = schedule.reduce((sum, i) => sum + (i.duration_minutes || 0), 0);
  return total > 0 ? total : null;
};

/**
 * A published pack as a calendar event, or null when there is no date to add.
 *
 * A pack with no start date is publishable — an organiser can put the format
 * and the rules up while the date is still being agreed — and there is nothing
 * to put in a calendar until it has one. The button is hidden in that case
 * rather than adding an event to today.
 *
 * `origin` is passed in rather than read from `window` so this stays a pure
 * function: it is the only part that depends on where the page is served from,
 * and a test should not have to fake a location to check the rest.
 */
export function packCalendarEvent(data: PublicPack, origin: string): CalendarEvent | null {
  const { pack, venue, host, schedule = [] } = data;
  if (!pack?.starts_on) return null;

  const slug    = data.display_slug ?? pack.slug ?? '';
  const url     = `${origin.replace(/\/$/, '')}/${slug}`;
  const allDay  = !pack.starts_at;
  const lastDay = pack.ends_on && pack.ends_on > pack.starts_on ? pack.ends_on : pack.starts_on;

  // An all-day event runs whole days and ends the morning after the last one.
  // A timed event runs from the start time for as long as the timetable says,
  // landing on the final day when the pack spans several.
  const startMs = toClock(pack.starts_on, pack.starts_at);
  const endMs   = allDay
    ? addMinutes(toClock(lastDay), 24 * 60)
    : addMinutes(toClock(lastDay, pack.starts_at), scheduledMinutes(schedule) ?? DEFAULT_DURATION_MINUTES);

  // Deliberately not the pack's description: a blurb is markdown, is often
  // several paragraphs, and renders as a wall of asterisks in a calendar
  // popup. What belongs here is the handful of facts somebody re-reads from
  // the diary entry, and a link to the page that has the rest — and stays
  // right when this copy does not.
  const description = [
    pack.format,
    host?.name ? `Hosted by ${host.name}` : null,
    venue?.name ? `At ${venue.name}` : null,
    url,
  ].filter(Boolean).join('\n');

  return {
    // The pack id, not the slug: a stable UID is what makes a second add
    // update the existing entry instead of leaving two events in the diary.
    uid: `battlepack-${pack.id}@battlepack.app`,
    title: pack.name,
    location: [venue?.name, venue?.address].filter(Boolean).join(', '),
    description,
    url,
    allDay,
    start: fromClock(startMs),
    end: fromClock(endMs),
  };
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
export function icsForEvent(event: CalendarEvent): string {
  // VALUE=DATE for an all-day event. A DTSTART of `20260906` and one of
  // `20260906T000000` are different things: the first is a day in the diary,
  // the second is a midnight appointment.
  const [dtstart, dtend] = event.allDay
    ? [`DTSTART;VALUE=DATE:${ymd(event.start)}`, `DTEND;VALUE=DATE:${ymd(event.end)}`]
    : [`DTSTART:${ymdhms(event.start)}`, `DTEND:${ymdhms(event.end)}`];

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Battleplans//BattlePack//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${utcStamp(new Date())}`,
    dtstart,
    dtend,
    `SUMMARY:${icsEscape(event.title)}`,
    ...(event.location    ? [`LOCATION:${icsEscape(event.location)}`]       : []),
    ...(event.description ? [`DESCRIPTION:${icsEscape(event.description)}`] : []),
    `URL:${event.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  // CRLF, not \n. The spec says so and the strict parsers mean it.
  return lines.map(fold).join('\r\n') + '\r\n';
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
export function downloadIcs(event: CalendarEvent): void {
  const blob = new Blob([icsForEvent(event)], { type: 'text/calendar;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = icsFilename(event);
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
