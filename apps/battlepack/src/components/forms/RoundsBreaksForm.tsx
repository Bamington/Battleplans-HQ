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
import type { ScheduleItem, ScheduleSegment } from '../../lib/packs';
import { useDebouncedSave } from '../../hooks/useDebouncedSave';
import type { SaveSection } from './SectionForm';
import {
  addScheduleItem, deleteScheduleItem, reorderSchedule, updateScheduleItem, timeSchedule,
  addSegment, updateSegment, deleteSegment, reorderSegments,
  saveCategoryContent,
} from '../../lib/packs';

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
  addDay: (packId: string, after: ScheduleSegment | null, shape?: 'days' | 'periods') => Promise<ScheduleSegment>;
  updateDay: (id: string, patch: Partial<ScheduleSegment>) => Promise<void>;
  removeDay: (id: string) => Promise<void>;
  reorderDays: (segments: ScheduleSegment[]) => Promise<void>;
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
};

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
  pack, schedule, segments, rows, categoryKey, reload, ops = LIVE_OPS,
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
    persist(() => ops.updateDay(day.id, p));
  };

  const addDay = () =>
    persist(async () => {
      const created = await ops.addDay(pack.id, days[days.length - 1] ?? null, pack.schedule_shape);
      // Select it: adding a day and then having to find it would be two steps
      // where the organiser meant one.
      setDayId(created.id);
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
      await ops.removeDay(target.id);
      // Renumber so the sequence has no holes — "Day 1, Day 3" would be a lie
      // about how many days there are.
      await ops.reorderDays(days.filter(d => d.id !== target.id));
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

      {/* ── The days ───────────────────────────────────────────────────────
          A one-day event shows only the button, because a chip labelled "Day 1"
          over the only day names a distinction that does not exist. The moment
          there are two, the strip appears and the fields below it belong to
          whichever is selected. */}
      <div className="flex flex-col gap-2">
        {many && (
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
                      : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-white',
                  ].join(' ')}
                >
                  {d.label?.trim() || `${Unit} ${i + 1}`}
                </button>
              ))}
            </div>
          </>
        )}

        {day && (many || periods) && (
          <div className="flex flex-col gap-2 p-3 rounded-lg bg-gray-800 border border-gray-700">
            <Input
              size="sm"
              label={periods ? 'Starts' : 'Date'}
              type="date"
              value={day.starts_on ?? ''}
              onChange={e => patchDay({ starts_on: e.target.value || null })}
            />

            {/* A ROUND SPANS DATES; A DAY SPANS HOURS. Both are "when does this
                part run", and the two never appear together — a league keeps no
                clock, because players arrange their own games inside the week. */}
            {periods ? (
              <Input
                size="sm"
                label="Ends"
                type="date"
                value={day.ends_on ?? ''}
                min={day.starts_on ?? undefined}
                onChange={e => patchDay({ ends_on: e.target.value || null })}
              />
            ) : (
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
            )}
            <Input
              size="sm"
              label="Name (optional)"
              placeholder={`${Unit} ${days.indexOf(day) + 1}`}
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
                    ? `Remove this ${unit}? The ${items.length} ${items.length === 1 ? 'row' : 'rows'} scheduled in it go too.`
                    : `Remove this ${unit}?`}
                  {' '}This cannot be undone.
                </p>
                <ButtonPair>
                  <Button size="sm" color="danger" disabled={busy} onClick={() => { setConfirmRemoveDay(null); removeDay(day); }}>
                    {`Remove the ${unit}`}
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
                disabled={busy || days.length <= 1}
                onClick={() => setConfirmRemoveDay(day)}
              >
                {`Remove this ${unit}`}
              </Button>
            )}
          </div>
        )}

        {(many || periods) && (
          <Button
            size="sm"
            variant="outline"
            color="secondary"
            disabled={busy}
            leftIcon={<AddCircle className="w-4 h-4" />}
            onClick={addDay}
          >
            {`Add another ${unit}`}
          </Button>
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
