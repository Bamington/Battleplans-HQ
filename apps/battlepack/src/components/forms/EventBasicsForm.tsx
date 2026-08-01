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
  BannerPicker, GAME_ICONS, PanelSection, Input, RichTextEditor, SearchSelect, Notebook, UserRounded,
} from '@battleplans/ui';
import type { PendingBanner } from '@battleplans/ui';
import type { CategoryFormProps } from '../../registry/categories';
import { venueOptions } from '../../lib/pickerOptions';
import { useDebouncedSave } from '../../hooks/useDebouncedSave';
import { bannerUrl, uploadPackBanner, deleteBannerObject } from '../../lib/packs';
import { BANNER_MIN_ASPECT } from '../PackDocument';

const EventBasicsForm = ({ pack, games, venues, onChange }: CategoryFormProps) => {
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
          in the panel. */}
      <Input
        label="Start Date"
        type="date"
        value={pack.starts_on ?? ''}
        onChange={e => onChange({ starts_on: e.target.value || null })}
      />

      {/* A one-day event has no end date, so it is not offered. An empty field
          under "leave blank for a single day" asks the organiser to answer a
          question the flow has already answered — and invites them to fill it
          in wrongly. Shown for the other two, which by definition span dates. */}
      {pack.timeline !== 'one-day' && (
        <Input
          label="End Date"
          type="date"
          value={pack.ends_on ?? ''}
          min={pack.starts_on ?? undefined}
          onChange={e => onChange({ ends_on: e.target.value || null })}
        />
      )}

      <Input
        label="Start Time"
        type="time"
        value={(pack.starts_at ?? '').slice(0, 5)}
        onChange={e => onChange({ starts_at: e.target.value || null })}
      />

      <Input
        label="Format"
        placeholder="e.g. 2000 Points, Matched Play"
        value={pack.format ?? ''}
        onChange={e => setFormat(e.target.value)}
        onBlur={commitFormat}
      />

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
