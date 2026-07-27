/**
 * NewPackModal.tsx — "Create New Event", step 1 of 3.
 *
 * Matches the Figma card (node 1069:17848): title, step caption and progress
 * bar, then Basic Details — name, game, location, brief description — with
 * Cancel and Next.
 *
 * STEPS 2 AND 3 DO NOT EXIST YET. The bar says 1/3 because that is the shape of
 * the finished flow, but Next currently creates the pack and opens the editor,
 * where everything else is filled in anyway. When the later steps land they slot
 * in between.
 *
 * The game is collected HERE rather than in Event Basics because it is fixed at
 * creation: the game-specific mandatory category set resolves exactly once, from
 * it, and allowing a change later would mean reconciling categories that may
 * already have content typed into them.
 *
 * Composed from existing components — Modal, StepProgress, Input, SearchSelect,
 * Button — so the only new part is the stepper, which lives in packages/ui.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Modal, Input, SearchSelect, Button, Callout, StepProgress,
  ArrowRight, CloseCircle,
} from '@battleplans/ui';
import { createPack, listGames, listLocations, listPacks, recentIdsFrom } from '../lib/packs';
import { gameOptions, venueOptions } from '../lib/pickerOptions';
import type { GameOption, LocationOption } from '../lib/packs';

export interface NewPackModalProps {
  open: boolean;
  onClose: () => void;
  /** Fires with the new pack's id once it exists. */
  onCreated: (packId: string) => void;
}

const NewPackModal = ({ open, onClose, onCreated }: NewPackModalProps) => {
  const [games,  setGames]  = useState<GameOption[]>([]);
  const [venues, setVenues] = useState<LocationOption[]>([]);
  const [recent, setRecent] = useState<{ games: string[]; venues: string[] }>({ games: [], venues: [] });

  const [name,        setName]        = useState('');
  const [gameId,      setGameId]      = useState('');
  const [locationId,  setLocationId]  = useState('');
  const [description, setDescription] = useState('');

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  // Reset on every open so a cancelled attempt doesn't prefill the next one.
  useEffect(() => {
    if (!open) return;
    setName(''); setGameId(''); setLocationId(''); setDescription(''); setError(null);

    Promise.all([listGames(), listLocations(), listPacks()])
      .then(([g, l, packs]) => {
        setGames(g);
        setVenues(l);
        setRecent(recentIdsFrom(packs));
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load games and venues.'));
  }, [open]);

  const gameOpts  = useMemo(() => gameOptions(games, recent.games),   [games, recent.games]);
  const venueOpts = useMemo(() => venueOptions(venues, recent.venues), [venues, recent.venues]);

  const canSubmit = name.trim().length > 0 && gameId !== '' && !saving;

  async function handleNext() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const pack = await createPack({ name, gameId, locationId, description });
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

        <StepProgress step={1} total={3} label="Event Basics" />

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
            placeholder="Choose a location"
            searchPlaceholder="Search venues…"
            emptyLabel="No venues match that."
            value={locationId}
            onChange={setLocationId}
            options={venueOpts}
          />

          <div className="flex flex-col gap-1">
            <label className="block font-body text-sm font-medium text-neutral-100" htmlFor="new-pack-description">
              Brief Description
            </label>
            <textarea
              id="new-pack-description"
              rows={5}
              placeholder={'e.g. "After an epic RTT last month, we\'re back for another clash! Show your strategic acumen and dominate the battlefield to claim victory."'}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 font-body text-sm text-white placeholder-neutral-500 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="font-body text-sm text-neutral-400">
              Use this to add flavour to your event. You don't need to mention rules
              or format details here, as we'll add that later.
            </p>
          </div>
        </div>

        {error && <Callout flavour="bad" onDismiss={() => setError(null)}>{error}</Callout>}

        <div className="flex flex-wrap items-center justify-end gap-1">
          <Button
            variant="ghost"
            color="danger"
            leftIcon={<CloseCircle className="w-4 h-4" />}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={handleNext}
            disabled={!canSubmit}
          >
            {saving ? 'Creating…' : 'Next'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default NewPackModal;
