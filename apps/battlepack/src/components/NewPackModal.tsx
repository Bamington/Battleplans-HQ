/**
 * NewPackModal.tsx — the create-pack step.
 *
 * Name and game, and nothing else.
 *
 * The game is here rather than in Event Basics because it is FIXED AT CREATION.
 * The mandatory category set cannot resolve without it, and allowing a change
 * afterwards would mean reconciling game-specific categories on every change —
 * the old game's are orphaned, possibly with content typed into them, and none
 * of block / silently-drop / keep-and-flag is free. Fixing the game removes the
 * problem rather than managing it, and Event Basics shows it read-only.
 *
 * (The Figma for Event Basics does show Game as a dropdown. That is a leftover
 * from the BattleCards artboard the frame was duplicated from; §4 of the design
 * doc calls it out as one of two changes the decisions force on the design.)
 *
 * Composed entirely from existing components — Modal, Input, SearchSelect,
 * ButtonPair — so there is nothing new here to add to the gallery.
 */

import { useEffect, useState } from 'react';
import { Modal, Input, SearchSelect, Button, ButtonPair, Callout, Text } from '@battleplans/ui';
import { createPack, listGames } from '../lib/packs';
import type { GameOption } from '../lib/packs';

export interface NewPackModalProps {
  open: boolean;
  onClose: () => void;
  /** Fires with the new pack's id once it exists. */
  onCreated: (packId: string) => void;
}

const NewPackModal = ({ open, onClose, onCreated }: NewPackModalProps) => {
  const [games,   setGames]   = useState<GameOption[]>([]);
  const [name,    setName]    = useState('');
  const [gameId,  setGameId]  = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Reset on every open so a cancelled attempt doesn't prefill the next one.
  useEffect(() => {
    if (!open) return;
    setName('');
    setGameId('');
    setError(null);
    listGames().then(setGames).catch(e => setError(e.message));
  }, [open]);

  const canSubmit = name.trim().length > 0 && gameId !== '' && !saving;

  async function handleCreate() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const pack = await createPack(name, gameId);
      onCreated(pack.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the pack.');
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <div className="flex flex-col gap-4 p-5">
        <Text variant="h5">New BattlePack</Text>

        <Input
          label="Event Name"
          placeholder='e.g. "July RTT", "Learn to Play Warmachine!"'
          helperText="You don't need to include the game or location here."
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />

        <SearchSelect
          label="Game"
          required
          placeholder="Choose a game"
          searchPlaceholder="Search games…"
          value={gameId}
          onChange={setGameId}
          options={games.map(g => ({
            value: g.id,
            label: g.name,
            icon: g.icon ? <img src={g.icon} alt="" className="w-4 h-4 rounded object-cover" /> : undefined,
          }))}
          helperText="This cannot be changed later — it decides which categories your pack starts with."
        />

        {error && <Callout flavour="bad">{error}</Callout>}

        <ButtonPair>
          <Button onClick={handleCreate} disabled={!canSubmit}>
            {saving ? 'Creating…' : 'Create Pack'}
          </Button>
          <Button variant="outline" color="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </ButtonPair>
      </div>
    </Modal>
  );
};

export default NewPackModal;
