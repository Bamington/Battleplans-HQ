/**
 * AddEnemyModal.tsx — pick an enemy from a pack, or start a blank one
 *
 * Opened by "Add Enemy" in the RYG builder's card list. Most enemies come from
 * the book, so the pack list leads; writing one from scratch is the escape
 * hatch rather than the default.
 *
 * Enemies are grouped by pack and labelled with their type and AI, since a
 * bestiary of nineteen is long enough that "Champion · Hunter" is what tells
 * them apart at a glance.
 *
 * Composed from the shared Modal / Select / Button primitives.
 *
 * USAGE:
 *   <AddEnemyModal
 *     open={addEnemyOpen}
 *     packEnemies={packEnemies}
 *     onClose={() => setAddEnemyOpen(false)}
 *     onChoose={id => { void addFromPack(id); }}
 *     onCreateCustom={() => createBlank()}
 *   />
 */

import { useEffect, useState } from 'react';
import { Modal, Button, Select, Text } from '@battleplans/ui';
import type { PackEnemy } from '../hooks/useRygEnemies';

// ── Type definitions ──────────────────────────────────────────────────────────

export interface AddEnemyModalProps {
  /** Whether the modal is visible. */
  open: boolean;
  /** Enemies available from packs. Empty is a valid state — see below. */
  packEnemies: PackEnemy[];
  /** Dismissed without adding anything. */
  onClose: () => void;
  /** Add the chosen pack enemy (cards.id of the pack template). */
  onChoose: (templateId: string) => void;
  /** Start a blank enemy instead. */
  onCreateCustom: () => void;
}

/** "Champion · Hunter AI", skipping whichever half is missing. */
const describe = (e: PackEnemy) =>
  [e.enemyType, e.aiType && `${e.aiType} AI`].filter(Boolean).join(' · ');

// ── Component ─────────────────────────────────────────────────────────────────

const AddEnemyModal = ({
  open, packEnemies, onClose, onChoose, onCreateCustom,
}: AddEnemyModalProps) => {
  const [selected, setSelected] = useState('');
  const [adding,   setAdding]   = useState(false);

  // Default to the first enemy each time it opens, so the primary action is
  // always live rather than starting on an empty select.
  useEffect(() => {
    if (open) {
      setSelected(packEnemies[0]?.id ?? '');
      setAdding(false);
    }
  }, [open, packEnemies]);

  const hasPackEnemies = packEnemies.length > 0;

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <div className="flex flex-col gap-4 p-4">

        <div className="flex flex-col gap-1">
          <Text variant="h5">Add an enemy</Text>
          <Text variant="paragraph" size="sm" color="secondary">
            {hasPackEnemies
              ? 'Choose one from a pack, or build your own from scratch.'
              : 'No packs with enemies are available yet — you can still build one from scratch.'}
          </Text>
        </div>

        {hasPackEnemies && (
          <>
            <Select
              label="From a pack"
              value={selected}
              onChange={e => setSelected(e.target.value)}
              options={packEnemies.map(e => ({
                value: e.id,
                label: `${e.name} — ${describe(e)}`,
              }))}
            />

            <Button
              color="primary"
              loading={adding}
              disabled={!selected}
              onClick={() => { setAdding(true); onChoose(selected); }}
            >
              Add to deck
            </Button>

            <div className="flex items-center gap-3">
              <span className="flex-1 h-px bg-gray-700" />
              <Text variant="paragraph" size="xs" color="secondary">or</Text>
              <span className="flex-1 h-px bg-gray-700" />
            </div>
          </>
        )}

        <Button
          variant={hasPackEnemies ? 'outline' : 'filled'}
          color={hasPackEnemies ? 'secondary' : 'primary'}
          onClick={onCreateCustom}
        >
          Create a custom enemy
        </Button>

        {hasPackEnemies && (
          <Text variant="paragraph" size="xs" color="secondary">
            A pack enemy is copied into your deck — editing it here won't change
            the pack, or any other deck using it.
          </Text>
        )}
      </div>
    </Modal>
  );
};

export default AddEnemyModal;
