/**
 * recurrence.ts — when a repeating pack actually happens.
 *
 * A recurring pack stores a RULE, not a list of dates: weekly on these days
 * every n weeks, or the nth such weekday of each month, ending on a date the
 * database insists on. Three separate things then have to agree about what that
 * rule means — the RRULE in [calendar.ts](calendar.ts) that lands in an
 * attendee's diary, the `blocked_dates` row that holds the venue's tables, and
 * the sentence the organiser reads while they are setting it up. This file is
 * the third, and it is written to match the other two rather than to be
 * convenient:
 *
 * - **Weeks are counted between MONDAYS**, exactly as `blockAppliesOn` does it
 *   in BattlePlan, and exactly as iCalendar's `INTERVAL` does with the default
 *   `WKST=MO`. Counting "every 14 days from the start" instead would agree with
 *   both only when the start is a Monday.
 * - **`week_of_month` is 1-4 or -1 for LAST**, never "fifth" — a month with a
 *   fifth Friday is not the same event as one without.
 * - **A series is always bounded**, so nothing here needs a horizon to guess.
 *
 * Everything is pure and works in local dates: a pack stores the day it meets,
 * not an instant, so a UTC round trip is the one thing that could move it.
 */

import type { PackRecurrence } from './packs';

/** Monday first — the order the day chips are shown in, and how a week reads. */
export const WEEK_DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;

/** `Date#getDay()` is Sunday-first; this is the lookup back to a name. */
const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

/** Which occurrence of the weekday, as it is offered and as it is read back. */
export const WEEK_OF_MONTH_LABELS: Record<number, string> = {
  1: 'First', 2: 'Second', 3: 'Third', 4: 'Fourth', [-1]: 'Last',
};

/** The order those are offered in, with "last" at the end where it belongs. */
export const WEEK_OF_MONTH_OPTIONS = [1, 2, 3, 4, -1];

/**
 * The rule alone, without the pack around it.
 *
 * A `Pack` satisfies this, and so does the half-finished rule a form is holding
 * before it is valid enough to save — which is the state the sentence below is
 * most needed in.
 */
export interface RecurrenceRule {
  recurrence: PackRecurrence;
  interval_weeks: number;
  days_of_week: string[];
  week_of_month: number | null;
  until_date: string | null;
}

/**
 * The rule that means "does not repeat", with every field cleared.
 *
 * Spelled out rather than left to the caller because the database checks the
 * whole shape: a pack with `recurrence = 'none'` must carry no weekdays and no
 * week of the month, so switching a series off is five fields, not one.
 */
export const NO_RECURRENCE: RecurrenceRule = {
  recurrence: 'none',
  interval_weeks: 1,
  days_of_week: [],
  week_of_month: null,
  until_date: null,
};

// ── Dates, locally ───────────────────────────────────────────────────────────

/** `2026-07-11` → that day at local noon. Noon dodges every DST edge. */
const parseLocal = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12);
};

/** Back to `YYYY-MM-DD`, in local time — never `toISOString`, which is UTC. */
const isoOf = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** The Monday of that date's week. The anchor every interval is counted from. */
const mondayOf = (date: Date): Date => {
  const out = new Date(date);
  // getDay() is 0 for Sunday, which is the END of a Monday-first week.
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
};

const addDays = (date: Date, n: number): Date => {
  const out = new Date(date);
  out.setDate(out.getDate() + n);
  return out;
};

/** The full weekday name of an ISO date, e.g. `2026-07-11` → `Saturday`. */
export function weekdayNameOf(iso: string): string {
  return DAY_NAMES[parseLocal(iso).getDay()];
}

/** dd/mm/yyyy, matching how every other date in the pack is shown. */
export function shortDate(iso: string): string {
  const d = parseLocal(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Which occurrence of its own weekday a date is — 2026-09-12 is the second
 * Saturday, so 2. Returns -1 when it is the last one in the month.
 *
 * The default a monthly rule is born with. Someone setting a club night to
 * repeat monthly from the second Saturday means the second Saturday, and asking
 * them which week they meant when the date already says it is a question with
 * one possible answer.
 */
export function weekOfMonthOf(iso: string): number {
  const date = parseLocal(iso);
  // Last wins over fourth: a month with four Saturdays has its fourth AND last
  // on the same day, and "last" is the rule that survives a five-week month.
  if (date.getMonth() !== addDays(date, 7).getMonth()) return -1;
  return Math.floor((date.getDate() - 1) / 7) + 1;
}

/**
 * Is this date the `nth` such weekday of its month? -1 asks for the last.
 *
 * The same rule BattlePlan blocks tables by. A null week matches nothing rather
 * than everything: a monthly rule that has lost its week should produce no
 * dates, not one every week.
 */
function isNthWeekdayOfMonth(date: Date, nth: number | null): boolean {
  if (nth == null) return false;
  if (nth === -1) return date.getMonth() !== addDays(date, 7).getMonth();
  return Math.floor((date.getDate() - 1) / 7) + 1 === nth;
}

// ── The dates themselves ─────────────────────────────────────────────────────

/**
 * A safety rail, not a policy. `until_date` is required, so a series is already
 * bounded — this only stops a typo'd year from walking a decade of days.
 */
const MAX_OCCURRENCES = 400;

/**
 * Every date a recurring pack runs on, first to last, inclusive of both ends.
 *
 * The first occurrence is the start date ITSELF only if it falls on one of the
 * chosen weekdays. That is deliberate and matches `blockAppliesOn`: someone who
 * sets a Friday series starting on a Wednesday means "Fridays, from Wednesday
 * onwards", and silently moving their start date back to fit would be the form
 * disagreeing with the calendar file about when the event begins.
 *
 * A rule that does not repeat is its own single date, so callers can count
 * occurrences without asking whether it recurs first.
 */
export function occurrenceDates(from: string | null, rule: RecurrenceRule): string[] {
  if (!from) return [];
  if (rule.recurrence === 'none') return [from];
  if (!rule.until_date || rule.days_of_week.length === 0) return [];
  if (rule.until_date < from) return [];

  const start = parseLocal(from);
  const until = parseLocal(rule.until_date);
  const wanted = new Set(rule.days_of_week);
  const out: string[] = [];

  if (rule.recurrence === 'monthly') {
    // Day by day: a month is not a whole number of weeks, so there is no stride
    // to step by — and 31 tests a month over a bounded series is nothing.
    for (let d = start; d <= until && out.length < MAX_OCCURRENCES; d = addDays(d, 1)) {
      if (wanted.has(DAY_NAMES[d.getDay()]) && isNthWeekdayOfMonth(d, rule.week_of_month)) {
        out.push(isoOf(d));
      }
    }
    return out;
  }

  const every = Math.max(1, rule.interval_weeks || 1);
  // Anchored on the start's OWN Monday, so "every 2nd Friday" means the same
  // Fridays the RRULE picks and the same ones the table hold blocks.
  for (let week = mondayOf(start); week <= until && out.length < MAX_OCCURRENCES; week = addDays(week, 7 * every)) {
    for (let i = 0; i < 7; i++) {
      const day = addDays(week, i);
      if (day < start || day > until) continue;
      if (wanted.has(DAY_NAMES[day.getDay()])) out.push(isoOf(day));
    }
  }
  return out;
}

// ── Saying it in words ───────────────────────────────────────────────────────

/**
 * `['Saturday','Sunday']` → `Saturday and Sunday`.
 *
 * Singular, because both sentences this feeds already carry the repetition in
 * their opening words: "Every Friday", "The first Friday of the month". "Every
 * Fridays" is the version that reads as a bug.
 */
function listDays(days: string[]): string {
  // Back into week order, so Sunday-then-Saturday reads as Saturday and Sunday.
  const ordered = WEEK_DAYS.filter(d => days.includes(d));
  if (ordered.length === 0) return 'no days';
  if (ordered.length === 1) return ordered[0];
  return `${ordered.slice(0, -1).join(', ')} and ${ordered[ordered.length - 1]}`;
}

/** 1 → every, 2 → every 2nd. Written out because "every 1st week" is not English. */
function intervalWords(every: number): string {
  if (every <= 1) return 'Every';
  const suffix = every === 2 ? 'nd' : every === 3 ? 'rd' : 'th';
  return `Every ${every}${suffix}`;
}

/**
 * The pattern alone — "Every 2nd Friday", "The first Saturday of the month".
 *
 * What an ATTENDEE needs, and all of it: the count belongs to the organiser
 * setting the series up, not to someone deciding whether they are free on
 * Friday. Null when the rule names no days, because "Every" on its own is not
 * a sentence.
 */
export function recurrencePattern(rule: RecurrenceRule): string | null {
  if (rule.recurrence === 'none' || rule.days_of_week.length === 0) return null;
  return rule.recurrence === 'monthly'
    ? `The ${(WEEK_OF_MONTH_LABELS[rule.week_of_month ?? 1] ?? 'First').toLowerCase()} ${listDays(rule.days_of_week)} of the month`
    : `${intervalWords(rule.interval_weeks)} ${listDays(rule.days_of_week)}`;
}

/**
 * The whole rule in one sentence, ending in how many events it makes.
 *
 * The count is the point. A weekday pattern and an end date are each easy to
 * read and impossible to multiply in your head — "every second Friday until 18
 * December" is either five events or six, and the difference is whether the
 * organiser has to run one more. So the sentence always says the number, and
 * the last date it lands on, which is not always the end date they typed.
 *
 * Returns null when there is nothing true to say yet — no start date, or a rule
 * still missing the days or the end that would make it real.
 */
export function describeRecurrence(from: string | null, rule: RecurrenceRule): string | null {
  if (rule.recurrence === 'none' || !from) return null;
  if (rule.days_of_week.length === 0 || !rule.until_date) return null;

  const dates = occurrenceDates(from, rule);
  const pattern = recurrencePattern(rule);
  if (!pattern) return null;

  if (dates.length === 0) {
    // Reachable two ways — an end before the start, or a window too narrow to
    // contain one of the chosen weekdays — and both are worth saying out loud,
    // because the pack would otherwise be a series that never happens.
    return `${pattern} — but nothing falls between ${shortDate(from)} and ${shortDate(rule.until_date)}.`;
  }
  if (dates.length === 1) {
    return `${pattern} — once only, on ${shortDate(dates[0])}.`;
  }
  // DATES, not events. A fortnightly weekender runs on 28 dates and holds 14
  // weekends, and this function cannot tell which the organiser is counting —
  // it never sees the days. The number of dates is true of both.
  return `${pattern} — ${dates.length} dates, the last on ${shortDate(dates[dates.length - 1])}.`;
}
