/**
 * RoundsBreaksForm.tsx — the right panel for the Schedule category.
 *
 * The second of the three write paths: `schedule` storage, meaning real rows in
 * `battlepack_schedule_items` rather than jsonb. This one is genuinely
 * relational — the document queries it, the organiser reorders it, and each row
 * is a typed record rather than free text — which is exactly why it earned a
 * table of its own.
 *
 * AN ITEM KNOWS HOW LONG IT LASTS, NOT WHEN IT HAPPENS. Asking for a start and
 * a finish per round is asking the organiser to do arithmetic the app can do,
 * and to redo all of it every time anything moves. A round is "two hours"; where
 * it falls follows from the pack's start time and everything before it. Nothing
 * needs recalculating on a reorder or a deletion, because nothing was stored.
 *
 * REORDERING is a single batch renumber, not a shuffle through spare ordinals.
 * The unique constraint on (pack_id, ordinal) is DEFERRABLE INITIALLY DEFERRED,
 * so the transient collision while two rows share a number never surfaces.
 *
 * Rows are optimistic: local order changes immediately and the database catches
 * up, because waiting for a round trip before a row moves feels broken.
 */

import { useEffect, useState } from 'react';
import {
  Button, ButtonPair, PanelSection, EditableListItem, Input, Select, Callout, RichTextEditor,
  AddCircle,
} from '@battleplans/ui';
import type { CategoryFormProps } from '../../registry/categories';
import type { ScheduleItem, ScheduleSegment, SegmentKind } from '../../lib/packs';
import { useDebouncedSave } from '../../hooks/useDebouncedSave';
import type { SaveSection } from './SectionForm';
import {
  addScheduleItem, deleteScheduleItem, reorderSchedule, updateScheduleItem, timeSchedule,
  addSegment, updateSegment, deleteSegment, reorderSegments, syncLeagueDates,
  saveCategoryContent,
} from '../../lib/packs';
import { addDays as afterDays, leagueLabels } from '../../lib/leagues';
import { formatDate, periodRange } from '../packBody';

const KIND_OPTIONS = [
  { value: 'round', label: 'Round' },
  { value: 'break', label: 'Break' },
  { value: 'event', label: 'Event' },
];

/**
 * The four writes this form makes, injectable so the gallery can drive it from
 * memory. The ordering logic is the part most worth being able to exercise.
 */
export interface ScheduleOps {
  add: (packId: string, kind: ScheduleItem['kind'], ordinal: number, label: string, duration: number, segmentId?: string) => Promise<unknown>;
  update: (id: string, patch: Partial<ScheduleItem>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reorder: (items: ScheduleItem[]) => Promise<void>;
  /** Day operations. Separate from the item ones: a different table, and one
   *  of them can email everybody holding a calendar entry. */
  addDay: (packId: string, after: ScheduleSegment | null, shape?: 'days' | 'periods', kind?: SegmentKind) => Promise<ScheduleSegment>;
  updateDay: (id: string, patch: Partial<ScheduleSegment>) => Promise<void>;
  removeDay: (id: string) => Promise<void>;
  reorderDays: (segments: ScheduleSegment[]) => Promise<void>;
  /**
   * Re-date a league's rounds after anything that shifts the sequence.
   *
   * Its own op rather than something the writes above do quietly, because it
   * is the one operation whose result is not a property of the row it was
   * called about: adding round four re-dates nothing, but adding an Event
   * between rounds one and two moves everything behind it.
   */
  syncLeague: (segments: ScheduleSegment[], startsOn: string | null, weeks: number) => Promise<ScheduleSegment[]>;
}

const LIVE_OPS: ScheduleOps = {
  add: addScheduleItem,
  update: updateScheduleItem,
  remove: deleteScheduleItem,
  reorder: reorderSchedule,
  addDay: addSegment,
  updateDay: updateSegment,
  removeDay: deleteSegment,
  reorderDays: reorderSegments,
  syncLeague: syncLeagueDates,
};

/** One to twelve weeks a round. Beyond that it is a season, not a round. */
const ROUND_WEEK_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: i === 0 ? '1 week' : `${i + 1} weeks`,
}));

/** What a new row is called, so the organiser rarely has to type a label. */
function defaultLabel(kind: ScheduleItem['kind'], existing: ScheduleItem[]): string {
  if (kind === 'break') return 'Break';
  if (kind === 'event') return 'Event';
  return `Round ${existing.filter(i => i.kind === 'round').length + 1}`;
}

/**
 * Read the schedule's prose out of the category row.
 *
 * The rows live in their own table, which has columns for durations and labels
 * and nowhere to put a paragraph. The category's jsonb is already there and
 * otherwise unused for this key, so the notes go in it — no migration, and the
 * deviations table takes content for any category.
 */
export function readScheduleNotes(content: unknown): string {
  const value = content as { notes?: string } | null | undefined;
  return value?.notes ?? '';
}

const RoundsBreaksForm = ({
  pack, schedule, segments, rows, categoryKey, reload, onChange, ops = LIVE_OPS,
  save: saveFn = saveCategoryContent,
}: CategoryFormProps & { ops?: ScheduleOps; save?: SaveSection }) => {
  const [allItems, setAllItems] = useState<ScheduleItem[]>(schedule);
  const [error, setError] = useState<string | null>(null);
  const [busy,  setBusy]  = useState(false);

  /**
   * Which day the round list below is editing.
   *
   * Held by id rather than by index so it survives a day being removed above
   * it — an index would quietly start editing a different day.
   */
  const [dayId, setDayId] = useState<string | null>(null);

  useEffect(() => { setAllItems(schedule); }, [schedule]);

  const days = [...segments].sort((a, b) => a.ordinal - b.ordinal);
  // Falls back to the first day whenever the selection no longer exists, which
  // is what happens the moment the selected day is deleted.
  const day = days.find(d => d.id === dayId) ?? days[0] ?? null;
  const many = days.length > 1;
  /**
   * A league's segments are PERIODS, not days: a span of dates with a name, and
   * no clock at all. Players arrange their own games inside one, so asking when
   * it starts would be asking for a time nobody keeps.
   */
  const periods = pack.schedule_shape === 'periods';
  const unit    = periods ? 'round' : 'day';
  const Unit    = periods ? 'Round' : 'Day';

  /**
   * Where the league begins, and the anchor everything is measured from.
   *
   * The FIRST SEGMENT'S start, not `pack.starts_on` — the pack's copy is a
   * cache a trigger recomputes from these rows, so during the moment between a
   * write and its reload it is the old answer. Event Basics writes to the same
   * segment, which is what makes the date entered there the league's start.
   */
  const leagueStart = days[0]?.starts_on ?? null;
  const roundWeeks  = pack.round_length_weeks || 1;

  /** Rounds numbered among themselves, so an Event never takes a number. */
  const names = leagueLabels(days);
  const segmentName = (segment: ScheduleSegment, index: number) =>
    (periods ? names.get(segment.id) : null) ?? segment.label?.trim() ?? `${Unit} ${index + 1}`;

  const isEvent  = day?.kind === 'event';
  // What the thing being edited is called, which is not always the unit: a
  // league's strip holds rounds AND events, and "Remove this round" on a
  // painting week would be describing something else.
  const thisUnit = isEvent ? 'event' : unit;

  /** Where the segment before this one finishes, so an Event cannot overlap it. */
  const previousEnds = (() => {
    const index = day ? days.indexOf(day) : -1;
    if (index <= 0) return null;
    const before = days[index - 1];
    return before.ends_on ?? before.starts_on ?? null;
  })();
  const afterDay = (iso: string) => afterDays(iso, 1);

  /** When the league finishes, as it would read after the current layout. */
  const leagueEnds = (() => {
    if (!periods) return null;
    const last = days[days.length - 1];
    const end  = last?.ends_on ?? last?.starts_on ?? null;
    return end ? formatDate(end) : null;
  })();

  const items = day ? allItems.filter(i => i.segment_id === day.id) : [];

  // Prose, so it commits on a debounce rather than on blur — a rich text editor
  // loses focus for ordinary reasons like reaching for the bold button.
  const {
    value: notes,
    setValue: setNotes,
    state: notesState,
  } = useDebouncedSave(readScheduleNotes(rows[categoryKey]?.content), async next => {
    const body = next.trim();
    await saveFn(pack.id, categoryKey, body ? { notes: body } : null);
    await reload();
  });

  /**
   * What a new round should last: whatever the last one lasts, which is the
   * value they gave at creation until they change it. A day of two-hour rounds
   * should not need the number typing five times.
   */
  const defaultDuration = (kind: ScheduleItem['kind']) => {
    const sameKind = [...items].reverse().find(i => i.kind === kind);
    return sameKind?.duration_minutes ?? (kind === 'round' ? 120 : 10);
  };

  // Clock times, derived here exactly as the document derives them.
  const timed = timeSchedule(items, day?.starts_at ?? null);

  async function persist(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the schedule.');
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const add = (kind: ScheduleItem['kind']) =>
    persist(() => ops
      // Numbered within the day, and added to the day being edited. Without the
      // segment a database trigger would file it under day one, which is right
      // for an older client and wrong for this one.
      .add(pack.id, kind, items.length, defaultLabel(kind, items), defaultDuration(kind), day?.id)
      .then(() => {}));

  const remove = (item: ScheduleItem) =>
    persist(async () => {
      await ops.remove(item.id);
      // Close the gap so ordinals stay 0..n-1 and the numbering has no holes.
      // Times need no fixing — they were never stored.
      await ops.reorder(items.filter(i => i.id !== item.id));
    });

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    // Optimistic, and only within this day: the visible order comes from
    // allItems, so each of this day's slots takes the next reordered row while
    // every other day is left exactly where it was.
    setAllItems(prev => {
      const queue = [...next];
      return prev.map(i => (i.segment_id === day?.id ? queue.shift() ?? i : i));
    });
    persist(() => ops.reorder(next));
  };

  const patch = (item: ScheduleItem, p: Partial<ScheduleItem>) => {
    setAllItems(prev => prev.map(i => (i.id === item.id ? { ...i, ...p } : i)));
    persist(() => ops.update(item.id, p));
  };

  /**
   * Change a day.
   *
   * NOT optimistic, unlike the rows above. A day's date is what the pack's own
   * envelope is recomputed from and what the notification signature is hashed
   * from, so the result of this write is decided by triggers — guessing it
   * locally would mean guessing what the database is about to do.
   */
  const patchDay = (p: Partial<ScheduleSegment>) => {
    if (!day) return;
    persist(async () => {
      await ops.updateDay(day.id, p);
      // Only an Event's dates are editable in a league, and moving one moves
      // every round behind it. The local copy is patched first so the layout
      // runs against what was just written rather than what was on screen.
      await relayout(days.map(d => (d.id === day.id ? { ...d, ...p } : d)));
    });
  };

  /**
   * Re-date a league after something moved.
   *
   * Silent for a tournament: a day is where the organiser put it, and laying
   * days out end to end would take that away from them.
   */
  const relayout = async (next: ScheduleSegment[]) => {
    if (!periods) return;
    const anchor = [...next].sort((a, b) => a.ordinal - b.ordinal)[0]?.starts_on ?? leagueStart;
    await ops.syncLeague(next, anchor, roundWeeks);
  };

  const addDay = (kind: SegmentKind = 'round') =>
    persist(async () => {
      const created = await ops.addDay(pack.id, days[days.length - 1] ?? null, pack.schedule_shape, kind);
      // The new one has no dates of its own yet — a league's rounds get theirs
      // from the layout, which is also what moves the league's end date.
      await relayout([...days, created]);
      // Select it: adding a day and then having to find it would be two steps
      // where the organiser meant one.
      setDayId(created.id);
    });

  /**
   * Change how long every round runs for.
   *
   * Two writes and they belong together: the number is the pack's, and the
   * dates it implies are the segments'. Between them the league would say a
   * round is three weeks while its rounds were still a week long.
   */
  const changeRoundLength = (weeks: number) =>
    persist(async () => {
      onChange({ round_length_weeks: weeks });
      await ops.syncLeague(days, leagueStart, weeks);
    });

  /**
   * Remove a day, once it has been confirmed.
   *
   * ALWAYS asked, unlike removing a round. A category that is hidden gives its
   * content back and a round can be added again in seconds; a day takes its
   * whole timetable with it and there is no way back.
   */
  const removeDay = (target: ScheduleSegment) =>
    persist(async () => {
      const left = days.filter(d => d.id !== target.id);
      await ops.removeDay(target.id);
      // Renumber so the sequence has no holes — "Day 1, Day 3" would be a lie
      // about how many days there are.
      await ops.reorderDays(left);
      // Everything behind what went closes up, and the league finishes earlier.
      await relayout(left.map((d, i) => ({ ...d, ordinal: i + 1 })));
      setDayId(null);
    });

  const [confirmRemoveDay, setConfirmRemoveDay] = useState<ScheduleSegment | null>(null);

  /**
   * By how many minutes the timetable runs past the day's stated end.
   *
   * The day's end is the organiser's, not the timetable's — that separation is
   * what stops a round being added from moving somebody's diary entry. So when
   * the two disagree this warns rather than correcting: only the organiser
   * knows whether the rounds are wrong or the end time is.
   */
  const overrunsBy = (() => {
    if (periods) return null;
    if (!day?.starts_at || !day.ends_at || items.length === 0) return null;
    const mins = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const over = mins(day.starts_at) + items.reduce((n, i) => n + i.duration_minutes, 0) - mins(day.ends_at);
    return over > 0 ? over : null;
  })();

  return (
    <PanelSection
      title={periods ? "The League" : "The Day"}
      action={notesState === 'saving' ? 'Saving…' : notesState === 'error' ? 'Not saved' : ''}
    >

      {error && <Callout flavour="bad" onDismiss={() => setError(null)}>{error}</Callout>}

      {/* ── The days, or the league's timeline ─────────────────────────────
          A one-day event shows only the button, because a chip labelled "Day 1"
          over the only day names a distinction that does not exist. The moment
          there are two, the strip appears and the fields below it belong to
          whichever is selected.

          A LEAGUE ALWAYS SHOWS ITS STRIP, even with one round, because the
          strip is where Events are added and where the round length lives. */}
      <div className="flex flex-col gap-2">

        {/* ── How long a round is ──────────────────────────────────────────
            ONE NUMBER FOR THE WHOLE LEAGUE. Chris's call, and it is what a
            league organiser actually means: rounds are a fortnight each, not a
            fortnight for round one and three weeks for round two. Changing it
            re-dates every round and moves the league's end, which is why the
            sentence underneath says where it now finishes. */}
        {periods && (
          <Select
            size="sm"
            label="Round Length"
            value={String(roundWeeks)}
            disabled={busy}
            helperText={leagueEnds
              ? `Every round runs the same length. The league finishes ${leagueEnds}.`
              : 'Every round runs the same length.'}
            onChange={e => changeRoundLength(Number(e.target.value))}
            options={ROUND_WEEK_OPTIONS}
          />
        )}

        {(many || periods) && (
          <>
            <span className="block font-body text-sm font-medium text-white">{periods ? 'Rounds' : 'Days'}</span>
            <div className="flex flex-wrap gap-1.5">
              {days.map((d, i) => (
                <button
                  key={d.id}
                  type="button"
                  disabled={busy}
                  aria-pressed={d.id === day?.id}
                  onClick={() => setDayId(d.id)}
                  className={[
                    'px-3 py-1.5 rounded-lg font-body text-sm font-medium transition-colors',
                    d.id === day?.id
                      ? 'bg-primary-900 text-primary-200 border border-primary-700'
                      : d.kind === 'event'
                        // An Event is not play, and the strip says so before it
                        // is opened — otherwise a break week is indistinguishable
                        // from the round beside it.
                        ? 'bg-gray-800 text-gray-400 border border-dashed border-gray-600 hover:text-white'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-white',
                  ].join(' ')}
                >
                  {segmentName(d, i)}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Directly under the chips it extends, rather than below the editor
            for whichever one is open — the button adds to the strip, so it
            belongs with the strip. */}
        {(many || periods) && (
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              color="secondary"
              disabled={busy}
              leftIcon={<AddCircle className="w-4 h-4" />}
              onClick={() => addDay('round')}
            >
              {`Add another ${unit}`}
            </Button>

            {/* A LEAGUE'S ONE PIECE OF AUTHORED TIME. Everything else lays
                itself out; this is the painting week, the launch night, the
                fortnight the shop is shut — and it PUSHES the rounds after it
                later, because it occupies that stretch of the calendar. */}
            {periods && (
              <Button
                size="sm"
                variant="outline"
                color="secondary"
                disabled={busy}
                leftIcon={<AddCircle className="w-4 h-4" />}
                onClick={() => addDay('event')}
              >
                Add an Event
              </Button>
            )}
          </div>
        )}

        {day && (many || periods) && (
          <div className="flex flex-col gap-2 p-3 rounded-lg bg-gray-800 border border-gray-700">

            {/* ── When it runs ─────────────────────────────────────────────
                A ROUND IS NOT DATED BY HAND. Its dates fall out of the
                league's start, the round length and everything ahead of it —
                so an input here would be a second answer to a question already
                settled, and the two would disagree the moment a round was
                added above it. Shown, not asked.

                An EVENT is the exception, and the only one: it answers to
                something outside the league — the shop being shut, a painting
                competition already in the diary — so its dates are the
                organiser's, and the rounds behind it move to fit. */}
            {periods && !isEvent ? (
              <div className="flex flex-col gap-1">
                <span className="block font-body text-sm font-medium text-white">When</span>
                <p className="font-body text-sm text-gray-400">
                  {day.starts_on
                    ? `${periodRange(day)} — set by the league's start date and the round length.`
                    : 'Give the league a start date in Event Basics and the rounds will lay themselves out.'}
                </p>
              </div>
            ) : periods ? (
              <>
                <Input
                  size="sm"
                  label="Starts"
                  type="date"
                  value={day.starts_on ?? ''}
                  min={previousEnds ? afterDay(previousEnds) : undefined}
                  onChange={e => patchDay({ starts_on: e.target.value || null })}
                />
                <Input
                  size="sm"
                  label="Ends"
                  type="date"
                  value={day.ends_on ?? ''}
                  min={day.starts_on ?? undefined}
                  onChange={e => patchDay({ ends_on: e.target.value || null })}
                />
                <p className="font-body text-xs text-gray-500">
                  The rounds after this one start again once it finishes.
                </p>
              </>
            ) : (
              <>
                <Input
                  size="sm"
                  label="Date"
                  type="date"
                  value={day.starts_on ?? ''}
                  onChange={e => patchDay({ starts_on: e.target.value || null })}
                />
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <Input
                      size="sm"
                      label="Starts"
                      type="time"
                      value={(day.starts_at ?? '').slice(0, 5)}
                      onChange={e => patchDay({ starts_at: e.target.value || null })}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Input
                      size="sm"
                      label="Ends"
                      type="time"
                      value={(day.ends_at ?? '').slice(0, 5)}
                      onChange={e => patchDay({ ends_at: e.target.value || null })}
                    />
                  </div>
                </div>
              </>
            )}

            <Input
              size="sm"
              label="Name (optional)"
              placeholder={segmentName(day, days.indexOf(day))}
              defaultValue={day.label ?? ''}
              onBlur={e => {
                const label = e.target.value.trim();
                if (label !== (day.label ?? '')) patchDay({ label: label || null });
              }}
            />

            {/* The one thing the day's end time is for, said where it is set.
                It informs rather than blocks: a day that runs past its stated
                end is a timetable to fix or an end time to correct, and only
                the organiser knows which. */}
            {overrunsBy !== null && (
              <Callout flavour="warning">
                The rounds below run {overrunsBy} minutes past this day&rsquo;s end time.
              </Callout>
            )}

            {confirmRemoveDay?.id === day.id ? (
              <div className="flex flex-col gap-2 p-3 rounded-lg bg-gray-900 border border-red-900">
                <p className="font-body text-sm text-gray-300">
                  {items.length > 0
                    ? `Remove this ${thisUnit}? The ${items.length} ${items.length === 1 ? 'row' : 'rows'} scheduled in it go too.`
                    : `Remove this ${thisUnit}?`}
                  {' '}This cannot be undone.
                </p>
                <ButtonPair>
                  <Button size="sm" color="danger" disabled={busy} onClick={() => { setConfirmRemoveDay(null); removeDay(day); }}>
                    {`Remove the ${thisUnit}`}
                  </Button>
                  <Button size="sm" variant="outline" color="secondary" onClick={() => setConfirmRemoveDay(null)}>
                    Keep it
                  </Button>
                </ButtonPair>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                color="danger"
                disabled={busy || (days.length <= 1 && !isEvent)}
                onClick={() => setConfirmRemoveDay(day)}
              >
                {`Remove this ${thisUnit}`}
              </Button>
            )}
          </div>
        )}
      </div>


      {/* Above the rows, because that is where it lands in the document and the
          panel should not disagree with what it is editing. Optional: most days
          need no preamble, and an empty one renders nothing. */}
      <div className="flex flex-col gap-1.5">
        <span className="block font-body text-sm font-medium text-white">Schedule Notes</span>
        <RichTextEditor
          value={notes}
          onChange={setNotes}
          placeholder="e.g. Rounds start on the hour — please be at your table five minutes early."
        />
      </div>

      {/* Silent for a league, which keeps no clock — and it asks about the DAY
          being edited rather than the pack, whose start time is now only a
          derived cache of the first one. */}
      {!periods && day && !day.starts_at && items.length > 0 && (
        <Callout flavour="warning">
          {many
            ? 'Give this day a start time above and it will lay itself out.'
            : 'Set a start time in Event Basics and the day will lay itself out.'}
        </Callout>
      )}

      {/* A LEAGUE ROUND HOLDS NOTHING. It IS the period of time — week three
          is the break week — so there is no timetable inside it to fill in,
          and offering Add Round inside Round 3 would be offering a round
          within a round. Tournament days keep the whole list. */}
      {periods && days.length === 0 && (
        <p className="font-body text-sm text-gray-500">
          No rounds yet. A league's rounds are stretches of time — a week each,
          usually — and players arrange their own games inside them.
        </p>
      )}

      {!periods && (
        <>
        {items.length === 0 && (
          <p className="font-body text-sm text-gray-500">
            {periods
              ? 'Nothing fixed inside this round — which is usual for a league, where players arrange their own games. Add something only if there is a set time everyone should know about.'
              : 'Nothing scheduled yet. Not every event has rounds — a narrative or campaign day may have none at all, and this category can be removed.'}
          </p>
        )}

        {items.map((item, index) => (
          <EditableListItem
            key={item.id}
            index={index}
            count={items.length}
            disabled={busy}
            removeLabel={`Remove ${item.label ?? 'item'}`}
            onMove={delta => move(index, delta)}
            onRemove={() => remove(item)}
            header={
              <div className="flex items-center gap-2">
                <span className="font-body font-bold text-xs text-gray-500 tabular-nums w-6 shrink-0">
                  {String(index).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <Select
                    value={item.kind}
                    onChange={e => patch(item, { kind: e.target.value as ScheduleItem['kind'] })}
                    options={KIND_OPTIONS}
                  />
                </div>
              </div>
            }
          >

            <Input
              size="sm"
              placeholder={
                item.kind === 'round' ? 'Round 1'
                  : item.kind === 'event' ? 'Prizegiving'
                  : 'Lunch'
              }
              defaultValue={item.label ?? ''}
              onBlur={e => {
                const label = e.target.value.trim();
                if (label !== (item.label ?? '')) patch(item, { label: label || null });
              }}
            />

            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <Input
                  size="sm"
                  type="number"
                  min={0}
                  step={5}
                  aria-label="Length in minutes"
                  value={item.duration_minutes}
                  onChange={e => patch(item, { duration_minutes: Math.max(0, Number(e.target.value) || 0) })}
                />
              </div>
              <span className="font-body text-xs text-gray-500 shrink-0">minutes</span>

              {/* Read-only: worked out from the day's start and everything above. */}
              {timed[index] && (
                <span className="shrink-0 font-body text-xs text-gray-400 tabular-nums">
                  {timed[index].startsAt.slice(0, 5)}–{timed[index].endsAt.slice(0, 5)}
                </span>
              )}
            </div>
          </EditableListItem>
        ))}

        {/* Stacked: the labels are long enough that side by side truncates them
            in a 256px panel. */}
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            leftIcon={<AddCircle className="w-4 h-4" />}
            disabled={busy}
            onClick={() => add('round')}
          >
            Add Round
          </Button>
          <Button
            size="sm"
            variant="outline"
            color="secondary"
            className="w-full"
            leftIcon={<AddCircle className="w-4 h-4" />}
            disabled={busy}
            onClick={() => add('break')}
          >
            Add Break
          </Button>
          <Button
            size="sm"
            variant="outline"
            color="secondary"
            className="w-full"
            leftIcon={<AddCircle className="w-4 h-4" />}
            disabled={busy}
            onClick={() => add('event')}
          >
            Add Event
          </Button>
        </div>
        </>
      )}
    </PanelSection>
  );
};

export default RoundsBreaksForm;
