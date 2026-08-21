/**
 * EventBasicsForm.tsx — the right panel for the Event Basics category.
 *
 * The first of the three write paths: this category's storage is `core`, so
 * every field here is a real typed column on `battlepacks` rather than jsonb.
 *
 * There is no save button: the editor is a place you return to rather than a
 * form you submit, and a published pack stays editable, so an explicit submit
 * step would be in the way on every visit.
 *
 * The single-line and date fields commit on blur or on pick, matching the rest
 * of the platform. The description is markdown from a rich text editor, so it
 * commits on a debounce instead — see useDebouncedSave for why blur is the
 * wrong moment for those.
 *
 * THE GAME IS READ-ONLY HERE, ON PURPOSE.
 * The Figma shows it as a "Choose a game" dropdown. That is a leftover from the
 * BattleCards artboard this frame was duplicated from — the design doc calls it
 * out as one of two changes the decisions force on the design. The game is
 * fixed at creation (§4): the game-specific mandatory category set resolves
 * exactly once, from it, and allowing a change would mean reconciling those
 * categories every time — orphaning content the organiser has already typed,
 * with no free answer between blocking, silently dropping, and keep-and-flag.
 */

import { useEffect, useState } from 'react';
import {
  BannerPicker, GAME_ICONS, PanelSection, PickerTile, Input, RichTextEditor, SearchSelect, Select, Notebook, UserRounded, Callout,
} from '@battleplans/ui';
import type { PendingBanner } from '@battleplans/ui';
import type { CategoryFormProps } from '../../registry/categories';
import { venueOptions } from '../../lib/pickerOptions';
import { useDebouncedSave } from '../../hooks/useDebouncedSave';
import { useVenueHours, startTimeWarning } from '../../hooks/useVenueHours';
import { bannerUrl, uploadPackBanner, deleteBannerObject, listMyClubs } from '../../lib/packs';
import type { LocationOption, Pack, PackRecurrence, PackTimeline } from '../../lib/packs';
import {
  NO_RECURRENCE, WEEK_DAYS, WEEK_OF_MONTH_LABELS, WEEK_OF_MONTH_OPTIONS,
  describeRecurrence, weekdayNameOf,
} from '../../lib/recurrence';
import type { RecurrenceRule } from '../../lib/recurrence';
import { BANNER_MIN_ASPECT } from '../PackDocument';
import { formatDate } from '../packBody';

/**
 * The three shapes, in the create flow's own words.
 *
 * Deliberately the same copy as NewPackModal's cards: it is the same question,
 * and an organiser who answered it wrongly at creation should recognise it
 * rather than have to work out that these are the same three things.
 */
const EVENT_TYPES: { id: PackTimeline; title: string; description: string }[] = [
  { id: 'one-day',   title: 'One Day',   description: 'Starts and finishes on the same day.' },
  { id: 'multi-day', title: 'Multi-Day', description: 'Two or more days, each with its own timetable.' },
  { id: 'league',    title: 'League',    description: 'Games organised by players over weeks.' },
];

/** How often, in the words the venue's own blocked dates use. */
const REPEATS: { value: PackRecurrence; label: string }[] = [
  { value: 'none',    label: 'Does not repeat' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

/** The recurrence half of a pack, on its own. */
const ruleOf = (pack: Pack): RecurrenceRule => ({
  recurrence:     pack.recurrence,
  interval_weeks: pack.interval_weeks,
  days_of_week:   pack.days_of_week,
  week_of_month:  pack.week_of_month,
  until_date:     pack.until_date,
});

const EventBasicsForm = ({
  pack, games, venues, segments, onChange, onSegmentChange, onTypeChange,
}: CategoryFormProps) => {
  /**
   * The event's first day. Dates and times live on a SEGMENT now, not on the
   * pack — the pack's copies are a derived envelope, and writing to them would
   * be overwritten by the next sync. Every pack has at least one segment, so
   * this is only null for a moment during the first render.
   */
  const day = segments[0] ?? null;

  /**
   * Which of the three the pack currently is.
   *
   * Derived rather than stored, because it already is: a league is
   * `schedule_shape === 'periods'`, and the difference between one-day and
   * multi-day is how many segments there are. Storing a fourth copy of that
   * would be a fourth thing to keep in step with the other three.
   */
  const eventType: PackTimeline =
    pack.schedule_shape === 'periods' ? 'league'
    : segments.length > 1 ? 'multi-day'
    : 'one-day';

  const league   = eventType === 'league';
  const multiDay = eventType === 'multi-day';
  // Local copy so typing is not fighting a round trip on every keystroke.
  // Re-synced whenever the row changes underneath — a rename from the left
  // panel's inline editor has to show up here too.
  const [name, setName] = useState(pack.name);
  useEffect(() => { setName(pack.name); }, [pack.name]);

  const [format, setFormat] = useState(pack.format ?? '');
  useEffect(() => { setFormat(pack.format ?? ''); }, [pack.format]);

  const commitFormat = () => {
    const next = format.trim();
    if (next !== (pack.format ?? '')) onChange({ format: next || null });
  };

  // Whether this event starts outside the venue's usual bookable hours.
  const venueHours  = useVenueHours(pack.location_id ?? null);
  const startWarning = startTimeWarning(segments[0]?.starts_at ?? null, venueHours);

  // The clubs this user could put their name on. Fetched here rather than
  // threaded through the registry, the same way the venue's hours are — only
  // this one form asks the question.
  const [clubs, setClubs] = useState<LocationOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    listMyClubs().then(rows => { if (!cancelled) setClubs(rows); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // The description is markdown from a rich text editor, so it commits on a
  // debounce rather than on blur, exactly as the section categories do.
  const {
    value: description,
    setValue: setDescription,
    state: descriptionState,
  } = useDebouncedSave(pack.description ?? '', next => {
    onChange({ description: next.trim() || null });
  });

  const game = games.find(g => g.id === pack.game_id) ?? null;
  // Shared artwork map first, the database column only as a fallback — most of
  // the catalogue has no `games.icon`.
  const gameArt = game ? GAME_ICONS[game.slug] ?? game.icon : null;

  // The upload is the one thing in this form that can fail slowly and visibly,
  // so it gets its own busy and error state rather than borrowing the row's.
  const [bannerBusy,  setBannerBusy]  = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  async function handleBanner(next: PendingBanner | null) {
    setBannerError(null);
    // Whatever the row points at now — removed or replaced, it stops being
    // reachable, so it goes. Captured before the patch, since onChange is
    // optimistic and pack.banner_path is about to say something else.
    const previous = pack.banner_path;

    if (next === null) {
      onChange({ banner_path: null, banner_aspect: null });
      await deleteBannerObject(previous);
      return;
    }

    setBannerBusy(true);
    try {
      // Path and ratio go in one patch: a path with the previous banner's ratio
      // would have the hero reserve the wrong height.
      onChange({
        banner_path:   await uploadPackBanner(pack.id, next.blob),
        banner_aspect: next.aspect,
      });
      // Only once the new one is up and the row has been pointed at it.
      await deleteBannerObject(previous);
    } catch (e) {
      setBannerError(e instanceof Error ? e.message : 'Could not upload that banner.');
    } finally {
      setBannerBusy(false);
    }
  }

  // ── Repeats ────────────────────────────────────────────────────────────────
  //
  // HELD LOCALLY ONLY WHILE IT IS HALF-MADE, and read from the row the rest of
  // the time. The database will not accept part of a series — a repeating pack
  // must name at least one weekday and must have an end date — so picking
  // "Weekly" cannot be written on its own, and the answer has to wait
  // somewhere until the rest of it arrives.
  //
  // The moment it is whole it is saved and this goes back to null, which is
  // what makes the field behave like every other one here: a change that the
  // editor holds back — a published pack's rule, which emails people — snaps
  // back to what is stored if the organiser cancels the confirmation. Keeping
  // the rule in state after saving would leave the form showing a series that
  // was never written.
  const [pending, setPending] = useState<RecurrenceRule | null>(null);
  const rule = pending ?? ruleOf(pack);

  // A write that landed, or an edit from somewhere else, ends the wait.
  useEffect(() => { setPending(null); }, [
    pack.recurrence, pack.interval_weeks, pack.week_of_month, pack.until_date,
    pack.days_of_week.join(','),
  ]);

  const repeats = rule.recurrence !== 'none';
  const monthly = rule.recurrence === 'monthly';

  const ruleReady = !repeats || (rule.days_of_week.length > 0 && !!rule.until_date);

  /** Save it, but only once it is a rule the database would accept. */
  const commitRule = (next: RecurrenceRule) => {
    if (next.recurrence !== 'none' && (next.days_of_week.length === 0 || !next.until_date)) {
      setPending(next);
      return;
    }

    setPending(null);
    onChange({
      recurrence:     next.recurrence,
      // Weeks are not how a monthly rule counts, and a stale interval is a
      // constraint violation rather than a harmless leftover.
      interval_weeks: next.recurrence === 'weekly' ? next.interval_weeks : 1,
      days_of_week:   next.recurrence === 'none' ? [] : next.days_of_week,
      week_of_month:  next.recurrence === 'monthly' ? (next.week_of_month ?? 1) : null,
      until_date:     next.recurrence === 'none' ? null : next.until_date,
    });
  };

  /**
   * Switching it on guesses the weekday from the start date, because that is
   * the answer every time: someone whose event starts on a Friday and repeats
   * weekly means Fridays. The end date is the one thing that cannot be guessed,
   * so it is what the form then asks for.
   */
  const changeRecurrence = (next: PackRecurrence) => {
    if (next === 'none') return commitRule(NO_RECURRENCE);
    const start = day?.starts_on ?? null;
    commitRule({
      ...rule,
      recurrence:    next,
      days_of_week:  rule.days_of_week.length > 0 ? rule.days_of_week
                   : start ? [weekdayNameOf(start)] : [],
      week_of_month: next === 'monthly' ? (rule.week_of_month ?? 1) : null,
    });
  };

  const toggleDay = (name: string) => {
    const next = rule.days_of_week.includes(name)
      ? rule.days_of_week.filter(d => d !== name)
      : [...rule.days_of_week, name];
    commitRule({ ...rule, days_of_week: next });
  };

  const commitName = () => {
    const next = name.trim();
    // The name is the one required field in this category, so an empty one is
    // reverted rather than saved — otherwise the pack loses its only label and
    // the left nav, the document heading and the home row all go blank.
    if (!next) { setName(pack.name); return; }
    if (next !== pack.name) onChange({ name: next });
  };


  return (
    <PanelSection title="Basic Details">
      <Input
        label="Event Name"
        required
        leftIcon={<UserRounded className="w-4 h-4" />}
        placeholder={'e.g. "July RTT", "Learn to Play Warmachine!", etc.'}
        helperText="You don't need to include the Game or Location here."
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={commitName}
      />

      {/* Read-only — see the note at the top of this file. */}
      <div className="flex flex-col gap-1.5">
        <span className="block font-body text-sm font-medium text-white">Game</span>
        <div className="w-full flex items-center gap-2 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2.5">
          {gameArt
            ? <img src={gameArt} alt="" className="w-4 h-4 rounded object-cover shrink-0" />
            : <Notebook className="w-4 h-4 text-gray-500 shrink-0" />}
          <span className="font-body text-sm text-gray-300 truncate">{game?.name ?? 'Unknown game'}</span>
        </div>
        <p className="font-body text-xs text-gray-500">
          The game is set when a pack is created and cannot be changed — it decides
          which categories the pack has.
        </p>
      </div>

      {/* Dates, start time and format all live here because Event Basics is the
          only `core` form. Key Info is not a category — it is a panel showing
          these values back, so this is the one place they are entered. */}
      {/* Stacked rather than side by side — full-width date inputs give the
          native picker room, and two half-width ones were the tightest thing
      {/* ── What kind of event ─────────────────────────────────────────────
          The same three choices the create flow offers, in the same words,
          because they are the same question — and an organiser who picked
          wrongly at creation should not have to start again. It is the only
          control here that changes the SHAPE of the pack rather than its
          contents, which is why it sits above the dates it governs. */}
      <div className="flex flex-col gap-1.5">
        <span className="block font-body text-sm font-medium text-white">Event Type</span>
        <div role="radiogroup" aria-label="Event type" className="flex items-stretch gap-1.5">
          {EVENT_TYPES.map(t => (
            <PickerTile
              key={t.id}
              title={t.title}
              description={t.description}
              selected={eventType === t.id}
              onSelect={() => onTypeChange(t.id)}
            />
          ))}
        </div>
      </div>

      {/* Stacked rather than side by side — full-width date inputs give the
          native picker room, and two half-width ones were the tightest thing
          in the panel. */}
      <Input
        label={league ? 'League Starts' : 'Start Date'}
        type="date"
        value={day?.starts_on ?? ''}
        onChange={e => onSegmentChange({ starts_on: e.target.value || null })}
      />

      {/* A league runs to a date; a tournament runs to a time. The two never
          appear together, because a league has no clock and a day has no span. */}
      {league ? (
        /* READ-ONLY, and that is the fix rather than an omission. A league's
           end is the last round's end, so an input here would be a second
           editor for a value Schedule owns — and the two would disagree the
           moment a round moved. */
        <div className="flex flex-col gap-1.5">
          <span className="block font-body text-sm font-medium text-white">League Ends</span>
          <p className="font-body text-sm text-gray-400">
            {pack.ends_on
              ? `${formatDate(pack.ends_on)} — the end of the last round.`
              : 'Set by the rounds in Schedule.'}
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <Input
              label={multiDay ? 'Day 1 Starts' : 'Start Time'}
              type="time"
              value={(day?.starts_at ?? '').slice(0, 5)}
              onChange={e => onSegmentChange({ starts_at: e.target.value || null })}
            />
          </div>
          <div className="flex-1 min-w-0">
            {/* THE DAY'S OWN END, and the reason it is asked for here rather
                than derived from the rounds: it is what goes in an attendee's
                calendar, so adding a round must not be able to move it. */}
            <Input
              label={multiDay ? 'Day 1 Ends' : 'End Time'}
              type="time"
              value={(day?.ends_at ?? '').slice(0, 5)}
              onChange={e => onSegmentChange({ ends_at: e.target.value || null })}
            />
          </div>
        </div>
      )}

      {multiDay && (
        <Callout>
          {segments.length > 1
            ? `${segments.length} days. The rest of them, and every day's timetable, are in Schedule.`
            : 'Add the other days in Schedule.'}
        </Callout>
      )}

      {league && (
        <Callout>
          Rounds are periods rather than days — set them up in Schedule. A league
          has no start time; players arrange their own games.
        </Callout>
      )}

      {/* ── Does it happen again ───────────────────────────────────────────
          Not a fourth event type, and that is the decision this whole section
          rests on: "multi-day" and "repeats monthly" are answers to different
          questions, and a monthly weekender needs to give both. So it sits
          below the dates as a property OF the event, not beside One Day and
          Multi-Day as an alternative to them.

          Absent for a league, because the database refuses the combination: a
          league's rounds ARE its schedule, and a league that also repeats
          fortnightly is not a thing anybody means. */}
      {/* ONE-DAY ONLY, and narrower than the database allows on purpose.
          Chris's call: a repeating multi-day event is expressible — the two
          axes were split so it could be — but every part of it is a second
          question (which day of the weekend anchors the series, what a change
          to day two means for the copies) and none of them has been answered.
          A league never repeats at all; its rounds ARE its schedule. */}
      {eventType === 'one-day' && (
        <div className="flex flex-col gap-1.5">
          <Select
            label="Repeats"
            value={rule.recurrence}
            onChange={e => changeRecurrence(e.target.value as PackRecurrence)}
          >
            {REPEATS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>

          {repeats && (
            <div className="flex flex-col gap-3 p-3 rounded-lg bg-gray-800 border border-gray-700">

              {monthly ? (
                /* WHICH OCCURRENCE of the weekday, not which date. "The 12th"
                   drifts across the week, and a club night is "the first
                   Saturday" — the same rule the venue blocks tables by. */
                <Select
                  label="Which Week"
                  value={String(rule.week_of_month ?? 1)}
                  onChange={e => commitRule({ ...rule, week_of_month: Number(e.target.value) })}
                >
                  {WEEK_OF_MONTH_OPTIONS.map(n => (
                    <option key={n} value={String(n)}>{WEEK_OF_MONTH_LABELS[n]}</option>
                  ))}
                </Select>
              ) : (
                <Select
                  label="How Often"
                  value={String(rule.interval_weeks || 1)}
                  onChange={e => commitRule({ ...rule, interval_weeks: Number(e.target.value) })}
                >
                  <option value="1">Every week</option>
                  <option value="2">Every 2nd week</option>
                  <option value="3">Every 3rd week</option>
                  <option value="4">Every 4th week</option>
                </Select>
              )}

              <div className="flex flex-col gap-2">
                <span className="block font-body text-sm font-medium text-white">Days</span>
                <div className="flex flex-wrap gap-2">
                  {WEEK_DAYS.map(d => {
                      const on = rule.days_of_week.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleDay(d)}
                          className={[
                            'px-3 py-1.5 rounded-lg font-body text-sm font-medium transition-colors',
                            on
                              ? 'bg-primary-900 text-primary-200 border border-primary-700'
                              : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-white',
                          ].join(' ')}
                        >
                          {d.slice(0, 3)}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* REQUIRED, not optional — and the one field here that cannot be
                  guessed. A bounded series is what lets the pack's own end date
                  hold the last occurrence, which is what keeps every existing
                  reader of that column working. */}
              <Input
                label="Repeats Until"
                type="date"
                value={rule.until_date ?? ''}
                min={day?.starts_on ?? undefined}
                onChange={e => commitRule({ ...rule, until_date: e.target.value || null })}
              />

              {/* The rule as a sentence, ending in how many events it makes.
                  The pattern and the end date are each easy to read and
                  impossible to multiply in your head — "every second Friday
                  until 18 December" is either five events or six. */}
              {ruleReady ? (
                <p className="font-body text-sm text-white border-t border-gray-700 pt-3">
                  {describeRecurrence(day?.starts_on ?? null, rule)
                    ?? 'Give the event a start date and this will say how many times it runs.'}
                </p>
              ) : (
                /* Nothing has been written yet, and saying so is the point:
                   this is the one place in the editor where a change waits. */
                <Callout flavour="warning">
                  {rule.days_of_week.length === 0
                    ? 'Pick at least one day — a series with none never happens.'
                    : 'Choose when it ends. A repeating event needs a last date, and nothing is saved until it has one.'}
                </Callout>
              )}
            </div>
          )}
        </div>
      )}


      {/* Informs, never blocks. A venue can open early for a tournament, and a
          club at a hired hall keeps its own hours — so an unusual time is worth
          a second look, not a refusal. Silent when the venue has no timeslots,
          because then there is no "usual" to be outside of. */}
      {startWarning && (
        <Callout flavour="warning">{startWarning}</Callout>
      )}

      {/* `format`, not `pack.format` — the local copy is what typing updates.
          Bound to the row instead, every keystroke re-rendered the field back
          to the saved value, so the box looked frozen; and because React reset
          the DOM each time, the local state only ever caught the single most
          recent character, which then appeared on blur. Name above has always
          had this right. */}
      <Input
        label="Format"
        placeholder="e.g. 2000 Points, Matched Play"
        value={format}
        onChange={e => setFormat(e.target.value)}
        onBlur={commitFormat}
      />

      {/* Only shown when there is a club to choose. Someone who runs no clubs
          would otherwise get a field whose only answer is None. Sits above
          Location because it answers the earlier question: whose event is this,
          before where it happens. */}
      {clubs.length > 0 && (
        <SearchSelect
          label="Host"
          placeholder="None"
          searchPlaceholder="Search clubs…"
          emptyLabel="No clubs match that."
          helperText="The club running this event. Its name appears under the title."
          value={pack.host_location_id ?? ''}
          onChange={id => onChange({ host_location_id: id || null })}
          options={[{ value: '', label: 'None' }, ...venueOptions(clubs)]}
        />
      )}

      <SearchSelect
        label="Location"
        placeholder="Choose a location"
        searchPlaceholder="Search venues…"
        emptyLabel="No venues match that."
        value={pack.location_id ?? ''}
        onChange={id => onChange({ location_id: id || null })}
        /* Same builder the New Event card uses, so the two pickers cannot
           drift apart on ordering or artwork. */
        options={venueOptions(venues)}
      />

      {/* Markdown, like every other prose field. Debounced rather than saved on
          blur, because a rich text editor loses focus for ordinary reasons. */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="block font-body text-sm font-medium text-white">Brief Description</span>
          <span className="font-body text-xs text-gray-500">
            {descriptionState === 'saving' ? 'Saving…' : descriptionState === 'error' ? 'Not saved' : ''}
          </span>
        </div>
        <RichTextEditor
          value={description}
          onChange={setDescription}
          placeholder={'e.g. "After an epic RTT last month, we\'re back for another clash! Show your strategic acumen and dominate the battlefield to claim victory."'}
        />
        <p className="font-body text-xs text-gray-500">
          Use this to add flavour to your event. You don't need to mention rules or
          format details here — those get their own categories.
        </p>
      </div>

      {/* Unlike the create flow, the pack row already exists here, so the file
          can go straight to storage — the bucket policy keys on the pack id in
          the path, and there is one. Only the resulting path goes through
          onChange, so the write and its error handling stay in one place. */}
      <div className="flex flex-col gap-1.5">
        <BannerPicker
          label="Event Banner"
          currentUrl={bannerUrl(pack.banner_path)}
          currentAspect={pack.banner_aspect}
          minAspect={BANNER_MIN_ASPECT}
          disabled={bannerBusy}
          onChange={handleBanner}
        />
        {bannerBusy && <p className="font-body text-xs text-gray-500">Uploading…</p>}
        {bannerError && <p className="font-body text-sm text-red-400">{bannerError}</p>}
      </div>
    </PanelSection>
  );
};

export default EventBasicsForm;
