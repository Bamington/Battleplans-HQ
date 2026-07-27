/**
 * EventBasicsForm.tsx — the right panel for the Event Basics category.
 *
 * The first of the three write paths: this category's storage is `core`, so
 * every field here is a real typed column on `battlepacks` rather than jsonb.
 *
 * Saving is on blur, matching the rest of the platform (see BattleBench's
 * ModelDetailModal). There is no save button: the editor is a place you return
 * to rather than a form you submit, and a published pack stays editable, so an
 * explicit submit step would be in the way on every visit.
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
import { HR, Input, SearchSelect, MapPin, Notebook, UserRounded } from '@battleplans/ui';
import type { CategoryFormProps } from '../../registry/categories';

/** Section heading inside the panel, matching "Basic Details" in the design. */
const FieldGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-col gap-1">
      <h3 className="font-body text-sm font-bold text-white">{title}</h3>
      <HR />
    </div>
    {children}
  </div>
);

const EventBasicsForm = ({ pack, games, venues, onChange }: CategoryFormProps) => {
  // Local copies so typing is not fighting a round trip on every keystroke.
  // Re-synced whenever the row changes underneath — a rename from the left
  // panel's inline editor has to show up here too.
  const [name,        setName]        = useState(pack.name);
  const [description, setDescription] = useState(pack.description ?? '');

  useEffect(() => { setName(pack.name); }, [pack.name]);
  useEffect(() => { setDescription(pack.description ?? ''); }, [pack.description]);

  const game  = games.find(g => g.id === pack.game_id) ?? null;

  const commitName = () => {
    const next = name.trim();
    // The name is the one required field in this category, so an empty one is
    // reverted rather than saved — otherwise the pack loses its only label and
    // the left nav, the document heading and the home row all go blank.
    if (!next) { setName(pack.name); return; }
    if (next !== pack.name) onChange({ name: next });
  };

  const commitDescription = () => {
    const next = description.trim();
    if (next !== (pack.description ?? '')) onChange({ description: next || null });
  };

  return (
    <FieldGroup title="Basic Details">
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
          {game?.icon
            ? <img src={game.icon} alt="" className="w-4 h-4 rounded object-cover shrink-0" />
            : <Notebook className="w-4 h-4 text-gray-500 shrink-0" />}
          <span className="font-body text-sm text-gray-300 truncate">{game?.name ?? 'Unknown game'}</span>
        </div>
        <p className="font-body text-xs text-gray-500">
          The game is set when a pack is created and cannot be changed — it decides
          which categories the pack has.
        </p>
      </div>

      <SearchSelect
        label="Location"
        placeholder="Choose a location"
        searchPlaceholder="Search venues…"
        emptyLabel="No venues match that."
        value={pack.location_id ?? ''}
        onChange={id => onChange({ location_id: id || null })}
        options={venues.map(v => ({
          value: v.id,
          label: v.name,
          icon: <MapPin className="w-4 h-4" />,
        }))}
        helperText="Optional — not every event runs at a venue on the platform."
      />

      <div className="flex flex-col gap-1.5">
        <label className="block font-body text-sm font-medium text-white" htmlFor="pack-description">
          Brief Description
        </label>
        <textarea
          id="pack-description"
          rows={6}
          placeholder={'e.g. "After an epic RTT last month, we\'re back for another clash! Show your strategic acumen and dominate the battlefield to claim victory."'}
          value={description}
          onChange={e => setDescription(e.target.value)}
          onBlur={commitDescription}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 font-body text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <p className="font-body text-xs text-gray-500">
          Use this to add flavour to your event. You don't need to mention rules or
          format details here — those get their own categories.
        </p>
      </div>
    </FieldGroup>
  );
};

export default EventBasicsForm;
