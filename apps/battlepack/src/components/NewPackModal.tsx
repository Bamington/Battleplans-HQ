/**
 * NewPackModal.tsx — "Create New Event", the create-pack flow.
 *
 * Step 1 (node 1069:17848) — Basic Details: name, game, location, description.
 * Step 2 (node 1069:18258) — Event Rounds: the shape of the day, when it
 *   starts, and the round defaults that generate the schedule.
 *
 * STEP 3 DOES NOT EXIST YET. The bar says 3 because that is the shape of the
 * finished flow; step 2's Next finishes here and opens the editor.
 *
 * NOTHING IS WRITTEN UNTIL THE FLOW FINISHES. Every field is held in local
 * state and the pack and its schedule are created together at the end, so
 * backing out at step 2 leaves no half-made draft behind. The cost is that a
 * failure at the end has to report against the whole flow rather than one
 * field, which is the better trade for something created once.
 *
 * The game is collected in step 1 because it is fixed at creation: the
 * game-specific mandatory category set resolves exactly once, from it.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Modal, Input, SearchSelect, Select, Button, Callout, StepProgress, PickerTile, RichTextEditor,
  BannerPicker, ArrowRight, ArrowLeft, Calendar, CloseCircle,
} from '@battleplans/ui';
import type { PendingBanner } from '@battleplans/ui';
import {
  buildSchedule, createPack, listGames, listPacks,
  recentIdsFrom, minutesToTime, savePackBanner,
} from '../lib/packs';
import { describeRecurrence, shortDate, weekOfMonthOf, weekdayNameOf } from '../lib/recurrence';
import { addDays } from '../lib/leagues';
import { BANNER_MIN_ASPECT } from './PackDocument';
import { gameOptions, venueOptions } from '../lib/pickerOptions';
import type {
  GameOption, LocationOption, PackRecurrence, PackTimeline, RecurrenceFields,
} from '../lib/packs';

export interface NewPackModalProps {
  open: boolean;
  onClose: () => void;
  /** The venues this user administers — the only ones a pack may belong to. */
  stores: LocationOption[];
  /** The store being acted as, pre-selected so the common case is one less pick. */
  defaultStoreId?: string;
  /** Fires with the new pack's id once it exists. */
  onCreated: (packId: string) => void;
}

/**
 * The shape of the event, and the last thing about it that cannot be changed
 * casually later.
 *
 * All three are buildable now that the schedule hangs off dated segments rather
 * than one pack-level date. One-day and multi-day are the same shape and differ
 * only in how many days there are, so moving between them is adding or removing
 * a day; a league is genuinely different and switching to it drops the clock
 * times, which is why Event Basics asks before doing it.
 */
const TIMELINES: { id: PackTimeline; title: string; description: string; enabled: boolean }[] = [
  { id: 'one-day',   title: 'One-Day Tournament',   description: 'Starts and finishes on the same day.',        enabled: true },
  { id: 'multi-day', title: 'Multi-Day Tournament', description: 'Rounds across two or more days, each with its own timetable.', enabled: true },
  { id: 'league',    title: 'League',               description: 'Games organised by players over weeks.',      enabled: true },
];

const NewPackModal = ({ open, onClose, stores, defaultStoreId, onCreated }: NewPackModalProps) => {
  const [step, setStep] = useState(1);

  const [games,  setGames]  = useState<GameOption[]>([]);
  const [recent, setRecent] = useState<{ games: string[]; venues: string[] }>({ games: [], venues: [] });

  // Step 1
  const [name,        setName]        = useState('');
  const [gameId,      setGameId]      = useState('');
  const [locationId,  setLocationId]  = useState('');
  const [format,      setFormat]      = useState('');
  const [description, setDescription] = useState('');
  // undefined until the organiser crops one. Held rather than uploaded — see
  // the note at the picker.
  const [banner, setBanner] = useState<PendingBanner | null | undefined>(undefined);

  // Step 2 — defaults are the design's, and are what most one-day events run.
  const [timeline,     setTimeline]     = useState<PackTimeline>('one-day');
  const [startDate,    setStartDate]    = useState('');
  const [startTime,    setStartTime]    = useState('10:00');
  // ── Does it happen again ──────────────────────────────────────────────────
  //
  // TWO QUESTIONS, NOT SIX. Everything else a recurring pack needs is already
  // implied by the start date: a series starting on a Friday repeats on
  // Fridays, and a monthly one starting on the second Saturday means the second
  // Saturday. Asking again here would be asking the organiser to restate what
  // they have just typed — and the full rule, with several weekdays and an
  // interval, is in Event Basics for the events that actually need it.
  const [repeats,   setRepeats]   = useState<PackRecurrence>('none');
  const [untilDate, setUntilDate] = useState('');
  const [rounds,       setRounds]       = useState(3);
  // Consecutive from the first, so the count is the whole question. Two,
  // because a multi-day event with one day is not one.
  const [dayCount,     setDayCount]     = useState(2);
  // A LEAGUE MEASURES ITS ROUNDS IN WEEKS, not hours. "Two weeks a round" is
  // what the organiser says, and the hours-and-minutes control below is asking
  // about a timetable a league does not have.
  const [roundWeeks,   setRoundWeeks]   = useState(1);
  // Held as hours and minutes because that is how they are asked for. The two
  // are the source of truth and the stored duration is derived — going the
  // other way (deriving the fields from a minutes total) makes clearing the
  // minutes box while typing snap the hours around.
  const [roundHours,   setRoundHours]   = useState(2);
  const [roundMins,    setRoundMins]    = useState(0);
  const [breakMinutes, setBreakMinutes] = useState(10);

  const roundMinutes = roundHours * 60 + roundMins;

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  // Reset on every open so a cancelled attempt doesn't prefill the next one.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setName(''); setGameId(''); setDescription(''); setFormat(''); setBanner(undefined);
    // Pre-select the store being acted as, or the only one they have.
    setLocationId(defaultStoreId || (stores.length === 1 ? stores[0].id : ''));
    setTimeline('one-day'); setStartDate(''); setStartTime('10:00');
    setRepeats('none'); setUntilDate('');
    setRounds(3); setRoundHours(2); setRoundMins(0); setBreakMinutes(10);
    setDayCount(2); setRoundWeeks(1);
    setError(null);

    Promise.all([listGames(), listPacks()])
      .then(([g, packs]) => { setGames(g); setRecent(recentIdsFrom(packs)); })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load games.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const gameOpts  = useMemo(() => gameOptions(games, recent.games),    [games, recent.games]);
  const venueOpts = useMemo(() => venueOptions(stores, recent.venues), [stores, recent.venues]);

  const preview = useMemo(
    () => buildSchedule({ rounds, roundMinutes, breakMinutes }),
    [rounds, roundMinutes, breakMinutes],
  );

  // Location is required: a pack belongs to the store running it, and only
  // that store's admins can edit it, so one without a venue would be a pack
  // nobody could reach.
  // Where the generated day ends, for the preview line.
  const finishTime = (() => {
    const [h, mm] = startTime.split(':').map(Number);
    const total = (h || 0) * 60 + (mm || 0) + preview.reduce((sum, i) => sum + i.duration_minutes, 0);
    return minutesToTime(total).slice(0, 5);
  })();

  /**
   * The rule those two answers make, or null when it does not repeat.
   *
   * Null is also the answer while it is INCOMPLETE — a repeat with no start
   * date to take its weekday from, or no end date — because the database will
   * not accept a half-made series, and creating the pack without the rule is
   * better than not creating it at all.
   */
  const recurrence = useMemo<RecurrenceFields | null>(() => {
    if (repeats === 'none' || !startDate || !untilDate) return null;
    // Belt and braces: the control is hidden for the other two, and a stale
    // answer from before the type was switched must not survive.
    if (timeline !== 'one-day') return null;
    return {
      recurrence:     repeats,
      interval_weeks: 1,
      days_of_week:   [weekdayNameOf(startDate)],
      week_of_month:  repeats === 'monthly' ? weekOfMonthOf(startDate) : null,
      until_date:     untilDate,
    };
  }, [repeats, startDate, untilDate, timeline]);

  const step1Valid = name.trim().length > 0 && gameId !== '' && locationId !== '';

  /** A league is the one shape that measures in weeks and keeps no clock. */
  const league = timeline === 'league';

  /**
   * What a league's two numbers add up to, and when it therefore finishes.
   *
   * The end date is the thing being decided here and the thing nobody can work
   * out in their head — six rounds of a fortnight is not a number you multiply
   * while looking at a calendar. It is also not asked for anywhere: a league's
   * end follows from its rounds, which is why adding one later moves it.
   */
  const leagueSummary = (() => {
    if (rounds < 1) return 'Add at least one round — a league with none has nothing to play.';
    const weeks = rounds * roundWeeks;
    const span  = `${rounds} round${rounds === 1 ? '' : 's'} of ${roundWeeks === 1 ? 'a week' : `${roundWeeks} weeks`} — ${weeks} week${weeks === 1 ? '' : 's'} in all`;
    if (!startDate) return `${span}. Give it a start date and the rounds will lay themselves out.`;
    return `${span}, finishing ${shortDate(addDays(startDate, weeks * 7 - 1))}.`;
  })();

  /**
   * A repeat that has been asked for but cannot be built yet.
   *
   * Blocks finishing rather than silently dropping the answer: someone who
   * picked "Weekly" and left would get a one-off event, having told us
   * otherwise, and nothing on screen would have said so.
   */
  const repeatIncomplete = timeline === 'one-day' && repeats !== 'none' && !recurrence;

  /**
   * Create the pack, and the generated day unless it was skipped.
   *
   * The schedule is a separate insert that is allowed to fail on its own: a
   * pack that exists without its rounds is recoverable in the editor, whereas
   * losing the pack because the schedule failed is not.
   */
  async function finish({ withSchedule }: { withSchedule: boolean }) {
    if (!step1Valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      // The dates go to day one's SEGMENT, which createPack does — the pack's
      // own date columns are a cache the database recomputes from the days.
      const pack = await createPack({
        name, gameId, locationId, description, format, timeline,
        startsOn: startDate || null,
        // A league keeps no clock: players arrange their own games inside a
        // round, so there is no time of day for one to start at.
        startsAt: league ? null : startTime || null,
        recurrence,
        // The count IS the fact for both — nothing stores "three-day event".
        ...(timeline === 'multi-day' ? { days: dayCount } : {}),
        ...(league ? { rounds, roundLengthWeeks: roundWeeks } : {}),
        // EVERY DAY GETS IT, which is the point of asking once. A league gets
        // none: its rounds are weeks, not a timetable.
        schedule: withSchedule && !league ? preview : [],
      });
      // Same bargain as the schedule: the upload can only run now that there is
      // a pack id for the storage path, and losing the pack because an image
      // failed would be the worse outcome. Re-uploadable from Event Basics.
      if (banner) {
        await savePackBanner(pack.id, banner).catch(() => {});
      }

      onCreated(pack.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the pack.');
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={saving ? () => {} : onClose} className="max-w-xl">
      <div className="flex flex-col gap-4 p-5">

        <h2 className="font-heading text-3xl leading-9 text-white text-center">Create New Event</h2>

        <StepProgress
          step={step}
          total={3}
          label={step === 1 ? 'Event Basics' : 'Event Rounds'}
        />

        {step === 1 ? (
          <div className="flex flex-col gap-1.5">
            <h3 className="font-heading text-xl leading-7 text-white">Basic Details</h3>

            <Input
              label="Event Name"
              required
              placeholder={'e.g. "July RTT", "Learn to Play Warmachine!", etc.'}
              helperText="You don't need to include the Game or Location here."
              value={name}
              onChange={e => setName(e.target.value)}
              rightElement={
                name
                  ? (
                    <button
                      type="button"
                      onClick={() => setName('')}
                      aria-label="Clear event name"
                      className="text-gray-500 hover:text-white cursor-pointer"
                    >
                      <CloseCircle className="w-4 h-4" />
                    </button>
                  )
                  : undefined
              }
            />

            <SearchSelect
              label="Game"
              required
              placeholder="Choose a game"
              searchPlaceholder="Search games…"
              emptyLabel="No games match that."
              value={gameId}
              onChange={setGameId}
              options={gameOpts}
              helperText="This cannot be changed later — it decides which categories your pack starts with."
            />

            <SearchSelect
              label="Location"
              required
              placeholder="Choose a location"
              searchPlaceholder="Search venues…"
              emptyLabel="No venues match that."
              value={locationId}
              onChange={setLocationId}
              /* Only stores this user administers — anything else would be an
                 option the database refuses. */
              options={venueOpts}
              helperText="Only the stores you administer. Every admin of this store will be able to edit the pack."
            />

            {/* Sits with the other facts rather than after the blurb: it is the
                same kind of answer as the game and the venue, and Key Info shows
                all three together. */}
            <Input
              label="Format"
              placeholder="e.g. 2000 Points, Matched Play"
              helperText="Shown beside the game, and in Key Info."
              value={format}
              onChange={e => setFormat(e.target.value)}
            />

            {/* The same field as Event Basics, so it is the same editor and the
                same markdown. Nothing is written until the flow finishes, so no
                debounce is needed here — it is plain local state. */}
            <div className="flex flex-col gap-1">
              <span className="block font-body text-sm font-medium text-neutral-100">
                Brief Description
              </span>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder={'e.g. "After an epic RTT last month, we\'re back for another clash! Show your strategic acumen and dominate the battlefield to claim victory."'}
              />
              <p className="font-body text-sm text-neutral-400">
                Use this to add flavour to your event. You don't need to mention rules
                or format details here, as we'll add that later.
              </p>
            </div>

            {/* Cropped now, uploaded at the end. The bucket path is keyed on the
                pack id and there is no pack yet, so the Blob waits in state with
                everything else — which is also what keeps a cancelled flow from
                leaving an orphaned object behind. */}
            <BannerPicker
              label="Event Banner"
              minAspect={BANNER_MIN_ASPECT}
              hint="Optional. Shown across the top of your pack, in place of the game's artwork."
              onChange={setBanner}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-5">

            <div className="flex flex-col gap-1.5">
              <h3 className="font-heading text-xl leading-7 text-white">Timeline</h3>

              <div role="radiogroup" aria-label="Event timeline" className="flex items-stretch gap-1.5">
                {TIMELINES.map(t => (
                  <PickerTile
                    key={t.id}
                    title={t.title}
                    description={t.description}
                    selected={timeline === t.id}
                    disabled={!t.enabled}
                    disabledHint="Not available yet — rounds spread across several dates are still to come."
                    onSelect={() => setTimeline(t.id)}
                  />
                ))}
              </div>

              {/* Input renders its own label/wrapper, so the flex sizing has to
                  go on a div around it rather than on the <input>.

                  ALIGNED AT THE TOP, NOT THE BOTTOM. Each field is a label, a
                  box and sometimes a line of helper text, and aligning the
                  bottoms makes the tallest field's helper push its own box —
                  and its label — above the others. Tops line the LABELS up,
                  which is the row a reader actually reads across, and lets the
                  helper hang below where it belongs. Round Defaults underneath
                  has always done it this way.

                  Wrapping, because three fields across a max-w-xl modal leaves
                  each about 130px and "dd/mm/yyyy" beside a calendar icon does
                  not fit in it. The day count takes only what a two-digit
                  number needs and drops to its own line when it has to. */}
              <div className="flex flex-wrap items-start gap-1.5">
                <div className="flex-1 min-w-[10rem]">
                  <Input
                    label={league ? 'League Starts' : 'Start Date'}
                    type="date"
                    leftIcon={<Calendar className="w-4 h-4" />}
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>

                {/* A LEAGUE KEEPS NO CLOCK. Players arrange their own games
                    inside a round, so there is no time of day for one to
                    start at — and asking would be asking for a time nobody
                    keeps. A multi-day event asks once and gives it to every
                    day; where they differ is settled in the editor. */}
                {!league && (
                  <div className="flex-1 min-w-[8rem]">
                    <Input
                      label={timeline === 'multi-day' ? 'Each Day Starts' : 'Start Time'}
                      type="time"
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                    />
                  </div>
                )}

                {/* CONSECUTIVE FROM THE FIRST, so the count is the whole
                    question. Nothing stores "this is a three-day event" —
                    three days is three days. */}
                {timeline === 'multi-day' && (
                  <div className="w-28 shrink-0">
                    <Input
                      label="Number of Days"
                      type="number"
                      min={2}
                      max={14}
                      value={dayCount}
                      onChange={e => setDayCount(Math.max(2, Math.min(14, Number(e.target.value) || 2)))}
                      helperText="Consecutive"
                    />
                  </div>
                )}
              </div>

              {/* Not a fourth card, on purpose: "multi-day" and "repeats
                  monthly" answer different questions, and a monthly weekender
                  has to be able to give both. Absent for a league, whose
                  rounds ARE its schedule — the database refuses that pairing.  */}
              {timeline === 'one-day' && (
                <div className="flex flex-wrap items-start gap-1.5">
                  <div className="flex-1 min-w-0">
                    <Select
                      label="Repeats"
                      value={repeats}
                      onChange={e => setRepeats(e.target.value as PackRecurrence)}
                    >
                      <option value="none">Does not repeat</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </Select>
                  </div>
                  {repeats !== 'none' && (
                    <div className="flex-1 min-w-0">
                      {/* REQUIRED, and the only thing here that cannot be
                          derived. A bounded series is what lets the pack's end
                          date hold its last occurrence. */}
                      <Input
                        label="Repeats Until"
                        type="date"
                        leftIcon={<Calendar className="w-4 h-4" />}
                        min={startDate || undefined}
                        value={untilDate}
                        onChange={e => setUntilDate(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* What those two answers produce, counted. The pattern and the
                  end date are each easy to read and impossible to multiply in
                  your head — "every second Friday until 18 December" is either
                  five events or six. */}
              {timeline === 'one-day' && repeats !== 'none' && (
                repeatIncomplete ? (
                  <Callout flavour="warning">
                    {!startDate
                      ? 'Give it a start date — a repeat takes its day of the week from there.'
                      : 'Choose when it ends. A repeating event needs a last date.'}
                  </Callout>
                ) : (
                  <p className="font-body text-sm text-neutral-400">
                    {describeRecurrence(startDate, recurrence!)}
                    {' '}You can add more days, or repeat fortnightly, in Event Basics.
                  </p>
                )
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <h3 className="font-heading text-xl leading-7 text-white">
                {league ? 'Rounds' : 'Round Defaults'}
              </h3>

              <div className="flex items-start gap-1.5">
                <div className="flex-1 min-w-0">
                  <Input
                    label="Number of Rounds"
                    type="number"
                    min={0}
                    max={20}
                    value={rounds}
                    onChange={e => setRounds(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
                  />
                </div>
                {/* A LEAGUE HAS NO GAPS TO SIZE. Its rounds run end to end —
                    week one, then week two — so "time between rounds" is a
                    question about a timetable it does not have. A break is
                    added as an Event in the editor, which pushes the rounds
                    after it later. */}
                {!league && (
                  <div className="flex-1 min-w-0">
                    <Input
                      label="Time Between"
                      type="number"
                      min={0}
                      step={5}
                      value={breakMinutes}
                      onChange={e => setBreakMinutes(Math.max(0, Number(e.target.value) || 0))}
                      helperText="Minutes"
                    />
                  </div>
                )}
              </div>

              {/* WEEKS FOR A LEAGUE, HOURS FOR A DAY, and they are not the
                  same question wearing different units: a league round is a
                  stretch of the calendar players arrange their own games in,
                  and a tournament round is a slot in a timetable. Every round
                  in a league is the same length, and changing it later re-dates
                  all of them. */}
              {league ? (
                <Select
                  label="Round Length"
                  value={String(roundWeeks)}
                  onChange={e => setRoundWeeks(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={String(i + 1)}>
                      {i === 0 ? '1 week' : `${i + 1} weeks`}
                    </option>
                  ))}
                </Select>
              ) : (
              <div className="flex flex-col gap-1.5">
                <span className="block font-body text-sm font-medium text-neutral-100">
                  Round Length
                </span>
                <div className="flex items-start gap-1.5">
                  <div className="flex-1 min-w-0">
                    <Input
                      type="number"
                      min={0}
                      max={24}
                      aria-label="Round length, hours"
                      value={roundHours}
                      onChange={e => setRoundHours(Math.max(0, Math.min(24, Number(e.target.value) || 0)))}
                      helperText="Hours"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      step={5}
                      aria-label="Round length, minutes"
                      value={roundMins}
                      onChange={e => setRoundMins(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                      helperText="Minutes"
                    />
                  </div>
                </div>
              </div>
              )}

              {/* What those numbers actually produce. Cheaper to read than to
                  picture, and it is the whole point of the step. */}
              <p className="font-body text-sm text-neutral-400">
                {league
                  ? leagueSummary
                  : preview.length === 0
                    ? 'No rounds will be added — you can build the day yourself in the editor.'
                    : `Creates ${rounds} round${rounds === 1 ? '' : 's'} from ${startTime}${timeline === 'multi-day' ? ' on each of the ' + dayCount + ' days' : ''}, finishing at ${finishTime}.`}
              </p>
            </div>
          </div>
        )}

        {error && <Callout flavour="bad" onDismiss={() => setError(null)}>{error}</Callout>}

        <div className="flex flex-wrap items-center justify-between gap-y-1">
          <Button
            variant="ghost"
            color="danger"
            leftIcon={<CloseCircle className="w-4 h-4" />}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>

          <div className="flex items-center gap-1">
            {step === 2 && (
              <>
                <Button
                  variant="ghost"
                  color="secondary"
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                  onClick={() => setStep(1)}
                  disabled={saving}
                >
                  Back
                </Button>
                {/* Skipping skips the ROUNDS, not the answers above them — so
                    an unfinished repeat blocks this door too, or the answer
                    would be dropped on the way through it. */}
                <Button
                  variant="ghost"
                  onClick={() => finish({ withSchedule: false })}
                  disabled={saving || repeatIncomplete}
                >
                  Skip for Now
                </Button>
              </>
            )}

            <Button
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => (step === 1 ? setStep(2) : finish({ withSchedule: true }))}
              disabled={!step1Valid || saving || (step === 2 && repeatIncomplete)}
            >
              {saving ? 'Creating…' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default NewPackModal;
