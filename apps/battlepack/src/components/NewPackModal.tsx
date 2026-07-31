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
  Modal, Input, SearchSelect, Button, Callout, StepProgress, PickerTile, RichTextEditor,
  BannerPicker, ArrowRight, ArrowLeft, Calendar, CloseCircle,
} from '@battleplans/ui';
import {
  buildSchedule, createPack, insertSchedule, listGames, listPacks,
  recentIdsFrom, updatePack, minutesToTime, savePackBanner,
} from '../lib/packs';
import { BANNER_ASPECT } from './PackDocument';
import { gameOptions, venueOptions } from '../lib/pickerOptions';
import type { GameOption, LocationOption } from '../lib/packs';

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
 * The shape of the event. Only one-day is buildable today — the other two need
 * a schedule spread across dates, which the schedule table models per-time and
 * not per-day, so they are shown (the choice is real and worth signalling) but
 * cannot be picked.
 */
const TIMELINES = [
  { id: 'one-day',   title: 'One-Day Tournament',   description: 'Event starts and finishes on the same day.', enabled: true },
  { id: 'multi-day', title: 'Multi-Day Tournament', description: 'Multiple Rounds over Multiple Days.',        enabled: false },
  { id: 'league',    title: 'League',               description: 'Rounds happen across many days.',            enabled: false },
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
  const [banner, setBanner] = useState<Blob | null | undefined>(undefined);

  // Step 2 — defaults are the design's, and are what most one-day events run.
  const [timeline,     setTimeline]     = useState('one-day');
  const [startDate,    setStartDate]    = useState('');
  const [startTime,    setStartTime]    = useState('10:00');
  const [rounds,       setRounds]       = useState(3);
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
    setRounds(3); setRoundHours(2); setRoundMins(0); setBreakMinutes(10);
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

  const step1Valid = name.trim().length > 0 && gameId !== '' && locationId !== '';

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
      const pack = await createPack({ name, gameId, locationId, description, format });

      if (startDate || startTime) {
        await updatePack(pack.id, {
          ...(startDate ? { starts_on: startDate } : {}),
          ...(startTime ? { starts_at: startTime } : {}),
        });
      }
      if (withSchedule && preview.length > 0) {
        await insertSchedule(pack.id, preview).catch(() => {
          // Non-fatal: the pack is made, and Rounds & Breaks can be filled in.
        });
      }
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
              aspect={BANNER_ASPECT}
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
                  go on a div around it rather than on the <input>. */}
              <div className="flex items-end gap-1.5">
                <div className="flex-1 min-w-0">
                  <Input
                    label="Start Date"
                    type="date"
                    leftIcon={<Calendar className="w-4 h-4" />}
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <Input
                    label="Start Time"
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <h3 className="font-heading text-xl leading-7 text-white">Round Defaults</h3>

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
              </div>

              {/* Two inputs rather than one box of minutes: a round is hours
                  long, and "120" is a number you have to convert in your head
                  before you can check it. Its own row because four fields
                  across a max-w-xl modal leaves each about 130px. */}
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

              {/* What those three numbers actually produce. Cheaper to read than
                  to picture, and it is the whole point of the step. */}
              <p className="font-body text-sm text-neutral-400">
                {preview.length === 0
                  ? 'No rounds will be added — you can build the day yourself in the editor.'
                  : `Creates ${rounds} round${rounds === 1 ? '' : 's'} from ${startTime}, finishing at ${finishTime}.`}
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
                <Button variant="ghost" onClick={() => finish({ withSchedule: false })} disabled={saving}>
                  Skip for Now
                </Button>
              </>
            )}

            <Button
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => (step === 1 ? setStep(2) : finish({ withSchedule: true }))}
              disabled={!step1Valid || saving}
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
