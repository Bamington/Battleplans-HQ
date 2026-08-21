/**
 * packBody.tsx — how a pack's content becomes a document.
 *
 * The editor's centre column and the public page at battlepack.app/<slug> show
 * the SAME document. This is that document, in one place, so the two cannot
 * drift — a category that renders one way for the organiser and another way for
 * the attendee is the bug this file exists to prevent.
 *
 * What lives here is everything that turns stored content into nodes: the per
 * category body, the derived Key Info rows, and the pairing that lets two
 * sections share a row. What does NOT live here is anything about editing —
 * selection, the nav, the panels. The editor wraps these in its own chrome; the
 * public page does not wrap them in anything.
 */

import type { ReactNode } from 'react';
import {
  MarkdownBody, AltArrowDown, Calendar, InfoCircle, ListCheck, MapPin, Play, Trophy,
} from '@battleplans/ui';
import { EmptySection, ScheduleTable } from './PackDocument';
import { recurrencePattern } from '../lib/recurrence';
import { leagueLabels } from '../lib/leagues';
import LinkPreview from './LinkPreview';
import { readChecklist } from './forms/ChecklistSectionForm';
import { readFaq } from './forms/FaqSectionForm';
import { readScheduleNotes } from './forms/RoundsBreaksForm';
import { readTitledList } from './forms/TitledListForm';
import { groupBySegment, timeSchedule } from '../lib/packs';
import type {
  LocationOption, Pack, PackCategoryRow, ScheduleItem, ScheduleKind, ScheduleSegment,
} from '../lib/packs';
import type { CategoryDefinition } from '../registry/categories';

// ── Formatting ───────────────────────────────────────────────────────────────

export const formatDate = (iso?: string | null) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : null;
};

/** `time` columns arrive as HH:MM:SS; the document shows "10:00 AM". */
export const formatTime = (t?: string | null) => {
  if (!t) return null;
  const [hRaw, m] = t.split(':');
  const h = Number(hRaw);
  if (Number.isNaN(h)) return null;
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m} ${suffix}`;
};

export const formatTimeRange = (from?: string | null, to?: string | null) => {
  const a = formatTime(from);
  const b = formatTime(to);
  return a && b ? `${a} - ${b}` : a ?? b;
};

/**
 * What a schedule row shows when the organiser has not named it.
 *
 * Only rounds get a number: they are the one kind that comes in a numbered
 * sequence, and "Break 2" would number the gaps as though anybody counted them.
 */
export const SCHEDULE_FALLBACK: Record<ScheduleKind, { label: (ordinal: number) => string; icon: ReactNode }> = {
  round: { label: n => `Round ${n}`, icon: <Play className="w-4 h-4" /> },
  break: { label: () => 'Break',     icon: <ListCheck className="w-4 h-4" /> },
  event: { label: () => 'Event',     icon: <Trophy className="w-4 h-4" /> },
};

// ── Key Info ─────────────────────────────────────────────────────────────────

export interface KeyInfoRowData { icon: ReactNode; text: string }

/**
 * The venue / when / format read-back beside the blurb.
 *
 * Key Info is NOT a category. It is a read-back of values the pack already
 * holds, so it has no form, no storage and no entry in the nav. Everything in
 * it is entered in Event Basics; asking for any of it twice would be asking for
 * two answers.
 */
export function keyInfoRows(pack: Pack, venue?: LocationOption | null): KeyInfoRowData[] {
  const starts = formatDate(pack.starts_on);
  const ends   = formatDate(pack.ends_on);
  const time   = pack.starts_at ? formatTime(pack.starts_at) : null;

  /**
   * A REPEATING EVENT IS NOT A LONG ONE, and the envelope alone cannot tell
   * them apart: a Friday night that runs until December stores the same
   * starts_on and ends_on as a five-month festival. So a recurring pack says
   * its rule instead — "Every Friday at 6:00 PM, 11/07/2026 – 18/12/2026" —
   * because a bare "11/07 – 18/12" is the one reading of those two columns
   * that is actively wrong here.
   *
   * The pattern, not the organiser's occurrence count: someone reading this is
   * deciding whether they are free on Friday, and "17 events" answers a
   * question only the person running it asked.
   */
  const repeat = recurrencePattern(pack);

  const when = repeat
    // Both bounds, because a series that has not started yet is a real thing to
    // read: "every Friday" alone cannot say the first one is in September.
    ? [
        [repeat, time ? `at ${time}` : null].filter(Boolean).join(' '),
        starts && ends ? `${starts} – ${ends}` : starts,
      ].filter(Boolean).join(', ')
    : starts
      ? [starts, ends ? `– ${ends}` : null, time ? `at ${time}` : null].filter(Boolean).join(' ')
      : null;

  return [
    ...(venue ? [{
      icon: <MapPin className="w-4 h-4" />,
      text: `${venue.name}${venue.address ? `, ${venue.address}` : ''}`,
    }] : []),
    ...(when ? [{ icon: <Calendar className="w-4 h-4" />, text: when }] : []),
    ...(pack.format ? [{ icon: <InfoCircle className="w-4 h-4" />, text: pack.format }] : []),
  ];
}

// ── Category body ────────────────────────────────────────────────────────────

export interface CategoryBodyArgs {
  category: CategoryDefinition;
  pack: Pack;
  rows: Record<string, PackCategoryRow>;
  /** The days or periods. Always at least one — see ScheduleSegment. */
  segments: ScheduleSegment[];
  schedule: ScheduleItem[];
}

/**
 * When a league round runs, as one line.
 *
 * Sits where a day shows its clock times, because it answers the same question
 * — when is this part of the event — with the only precision a league has.
 */
export function periodRange(segment: ScheduleSegment): string {
  const from = formatDate(segment.starts_on);
  const to   = segment.ends_on && segment.ends_on !== segment.starts_on
    ? formatDate(segment.ends_on)
    : null;
  if (!from) return 'Dates to be confirmed';
  return to ? `${from} - ${to}` : from;
}

/**
 * What a day calls itself.
 *
 * The organiser's own label wins. Failing that, "Day 1" for a tournament and
 * the date range for a league period — a league's weeks are identified by when
 * they are, and numbering them again would say the same thing twice.
 */
export function segmentLabel(segment: ScheduleSegment, index: number): string {
  if (segment.label?.trim()) return segment.label.trim();

  if (segment.ends_on && segment.ends_on !== segment.starts_on) {
    const from = formatDate(segment.starts_on);
    const to   = formatDate(segment.ends_on);
    if (from && to) return `${from} – ${to}`;
  }

  const day = formatDate(segment.starts_on);
  return day ? `Day ${index + 1} — ${day}` : `Day ${index + 1}`;
}

/** What one category contributes to the document. */
export function categoryBody({ category: c, pack, rows, segments, schedule }: CategoryBodyArgs): ReactNode {
  if (c.key === 'rounds-breaks') {
    const notes = readScheduleNotes(rows[c.key]?.content);

    // One table per day. A pack with a single segment gets exactly what it got
    // before — no heading, one table — because a heading over the only day is
    // a label for a distinction that does not exist.
    // ── A league is a list of periods, not a timetable ─────────────────────
    //
    // A round IS the stretch of time — week three is the break week — so there
    // is nothing inside one to lay out. Rendered as rows through the same
    // ScheduleTable the days use, with the date range where a day would show
    // clock times, so the two read as the same kind of thing.
    if (pack.schedule_shape === 'periods') {
      const periods = [...segments].sort((a, b) => a.ordinal - b.ordinal);
      // ROUNDS ARE NUMBERED AMONG THEMSELVES. A painting week between rounds
      // two and three does not make the next one Round 4 — it is still the
      // third round of play, and everyone standing in the shop will call it
      // that whatever the pack says.
      const names = leagueLabels(periods);
      const table = periods.length === 0
        ? <EmptySection hint="No rounds yet." />
        : <ScheduleTable rows={periods.map(s => ({
            ordinal: s.ordinal,
            // An Event is not play, and the row says so: it takes the same
            // recessive styling a break does on a tournament day.
            kind: (s.kind === 'event' ? 'event' : 'round') as ScheduleKind,
            label: names.get(s.id) ?? 'Round',
            time: periodRange(s),
            icon: s.kind === 'event'
              ? <Trophy className="w-4 h-4" />
              : <ListCheck className="w-4 h-4" />,
          }))} />;

      return notes
        ? (
          <div className="flex flex-col gap-3">
            <MarkdownBody className="text-base leading-6 text-gray-300">{notes}</MarkdownBody>
            {table}
          </div>
        )
        : table;
    }

    // The database guarantees at least one segment, so `days` is only ever
    // empty if a caller passed none. Falling back to one unnamed day timed from
    // the pack keeps a timetable on screen; the alternative is a silently blank
    // section, which looks like the organiser wrote nothing.
    const days = segments.length > 0
      ? groupBySegment(segments, schedule)
      : [{ segment: { id: 'pack', starts_at: pack.starts_at } as ScheduleSegment, items: schedule }];
    const named = days.length > 1;

    const table = days.every(d => d.items.length === 0)
      ? <EmptySection hint="No rounds or breaks yet." />
      : (
        <div className="flex flex-col gap-5">
          {days.map((day, dayIndex) => {
            // Times are worked out here rather than read from the row — an item
            // stores how long it lasts and nothing else, so a reorder cannot
            // leave the clock disagreeing with the order. Each day is timed
            // from ITS OWN start, not the pack's: day two rarely starts when
            // day one did.
            const timed = timeSchedule(day.items, day.segment.starts_at);
            return (
              <div key={day.segment.id} className="flex flex-col gap-2">
                {named && (
                  <h3 className="font-heading text-lg leading-6 text-gray-300">
                    {segmentLabel(day.segment, dayIndex)}
                  </h3>
                )}
                {day.items.length === 0
                  ? <EmptySection hint="Nothing scheduled for this day yet." />
                  : <ScheduleTable rows={day.items.map((s, i) => ({
                      ordinal: s.ordinal,
                      kind: s.kind,
                      label: s.label ?? SCHEDULE_FALLBACK[s.kind]?.label(s.ordinal) ?? 'Break',
                      time: timed[i] ? formatTimeRange(timed[i].startsAt, timed[i].endsAt) : `${s.duration_minutes} min`,
                      icon: SCHEDULE_FALLBACK[s.kind]?.icon ?? <ListCheck className="w-4 h-4" />,
                    }))} />}
              </div>
            );
          })}
        </div>
      );

    // Notes sit between the heading and the table — anything that applies to
    // the whole day is read before the day itself, not discovered under it.
    return notes
      ? (
        <div className="flex flex-col gap-3">
          <MarkdownBody className="text-base leading-6 text-gray-300">{notes}</MarkdownBody>
          {table}
        </div>
      )
      : table;
  }

  if (c.key === 'event-basics') {
    // The venue moved into Key Info, where the design shows it. This is just
    // the blurb now, which is why the document calls it About.
    return pack.description
      ? <MarkdownBody className="text-base leading-6 text-gray-300">{pack.description}</MarkdownBody>
      : <EmptySection hint="No description yet." />;
  }

  if (c.key === 'what-to-bring') {
    // A bulleted list where an item with a link is clickable end to end — the
    // URL is a field, not something pasted mid-sentence, so the whole phrase
    // can carry it.
    const list = readChecklist(rows[c.key]?.content);
    return list.length
      ? (
        <ul className="list-disc ps-5 space-y-1">
          {list.map((item, i) => (
            <li key={i}>
              {item.url
                ? (
                  <a href={item.url} target="_blank" rel="noreferrer noopener"
                     className="text-primary-400 hover:underline">
                    {item.text}
                  </a>
                )
                : item.text}
            </li>
          ))}
        </ul>
      )
      : <EmptySection hint={`Nothing in ${c.label} yet.`} />;
  }

  if (c.key === 'prizes' || c.key === 'resources') {
    // A titled entry per row. The title carries the weight and the description
    // sits under it, so the section can be scanned by title alone.
    const entries = readTitledList(rows[c.key]?.content);
    return entries.length
      ? (
        <div className="w-full flex flex-col gap-3">
          {entries.map((entry, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              {/* Skipped when empty rather than rendered blank — prizes written
                  before this was a list read back as one untitled entry. */}
              {entry.title && (
                <p className="font-body font-bold text-base leading-6 text-white">
                  {entry.url
                    ? (
                      <a href={entry.url} target="_blank" rel="noreferrer noopener"
                         className="text-primary-400 hover:underline">
                        {entry.title}
                      </a>
                    )
                    : entry.title}
                </p>
              )}
              {entry.description && (
                <MarkdownBody className="text-base leading-6 text-gray-300">
                  {entry.description}
                </MarkdownBody>
              )}
            </div>
          ))}
        </div>
      )
      : <EmptySection hint={`Nothing in ${c.label} yet.`} />;
  }

  if (c.key === 'faq') {
    const faqs = readFaq(rows[c.key]?.content);
    // An accordion: an FAQ is scanned for the one question you have, so the
    // questions want to be a short list you read down.
    //
    // Native <details>: keyboard operable and announced as a disclosure without
    // ARIA of our own, nothing to hold about which one is open, and
    // find-in-page still reaches a closed answer.
    return faqs.length
      ? (
        <div className="w-full flex flex-col rounded-xl overflow-hidden border border-gray-700">
          {faqs.map((item, i) => (
            <details key={i}
                     className="group border-b border-gray-700 last:border-b-0 bg-gray-800 open:bg-gray-900">
              <summary className="flex items-start gap-2 px-4 py-3 cursor-pointer list-none
                                  marker:content-none hover:bg-gray-700/40 transition-colors">
                <AltArrowDown className="w-4 h-4 mt-1 shrink-0 text-primary-500 transition-transform group-open:rotate-180" />
                <MarkdownBody className="flex-1 min-w-0 text-base leading-6 font-medium text-white">
                  {item.question}
                </MarkdownBody>
              </summary>
              <div className="px-4 pb-3 ps-10">
                <MarkdownBody className="text-base leading-6 text-gray-300">{item.answer}</MarkdownBody>
              </div>
            </details>
          ))}
        </div>
      )
      : <EmptySection hint={`Nothing in ${c.label} yet.`} />;
  }

  // The remaining `section` categories hold markdown plus an optional URL.
  const content = rows[c.key]?.content as { body?: string; url?: string } | null | undefined;
  return content?.body || content?.url
    ? (
      <>
        {content.body && (
          <MarkdownBody className="text-base leading-6 text-gray-300">{content.body}</MarkdownBody>
        )}
        {content.url && <LinkPreview url={content.url} />}
      </>
    )
    : <EmptySection hint={`Nothing in ${c.label} yet.`} />;
}

// ── Row grouping ─────────────────────────────────────────────────────────────

/**
 * Group a tab's categories into rows, pairing the ones that asked to share.
 *
 * Done on the VISIBLE categories, so removing one half of a pair leaves the
 * other full width rather than half a row with a hole beside it.
 */
export function groupIntoRows(inTab: CategoryDefinition[]): CategoryDefinition[][] {
  const groups: CategoryDefinition[][] = [];
  for (const c of inTab) {
    const previous = groups[groups.length - 1];
    if (c.row && previous?.[0].row === c.row) previous.push(c);
    else groups.push([c]);
  }
  return groups;
}
