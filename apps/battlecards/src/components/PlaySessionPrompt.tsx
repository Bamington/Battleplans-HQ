/**
 * PlaySessionPrompt.tsx — "you have a game from another day" modal
 *
 * Shown when a player starts Play mode on a deck whose game in progress was
 * last touched on an earlier day. Resuming a three-week-old board is rarely
 * what they meant, but neither is silently binning it — so it asks.
 *
 * A game from TODAY never reaches this: the deck opens straight into Play and
 * the board is simply there. This exists only for the ambiguous case.
 *
 * Composed from the shared Modal / Button / Text primitives.
 *
 * USAGE:
 *   <PlaySessionPrompt
 *     open={entry.promptOpen}
 *     lastPlayed={entry.lastPlayed}
 *     onContinue={entry.continueGame}
 *     onStartFresh={() => { void entry.startFresh(); }}
 *     onClose={entry.cancel}
 *   />
 */

import { Modal, Button, Text } from '@battleplans/ui';

// ── Type definitions ──────────────────────────────────────────────────────────

export interface PlaySessionPromptProps {
  /** Whether the prompt is visible. */
  open: boolean;
  /** When the older game was last played. Null renders the generic wording. */
  lastPlayed: Date | null;
  /** Resume the older game, board and turn intact. */
  onContinue: () => void;
  /** Discard it and start a new game from full strength. */
  onStartFresh: () => void;
  /** Dismissed without choosing — the deck stays in Edit mode. */
  onClose: () => void;
}

/**
 * "yesterday", "3 days ago", or a date once it's far enough back to be worth
 * naming. Relative wording is easier to judge at a glance than a bare date,
 * which is the whole question being asked here: is this still my game?
 */
function describeWhen(when: Date, now: Date = new Date()): string {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThen  = new Date(when.getFullYear(), when.getMonth(), when.getDate());
  const days = Math.round((startOfToday.getTime() - startOfThen.getTime()) / 86_400_000);

  if (days <= 0) return 'earlier today';
  if (days === 1) return 'yesterday';
  if (days < 7)  return `${days} days ago`;
  return when.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

// ── Component ─────────────────────────────────────────────────────────────────

const PlaySessionPrompt = ({
  open,
  lastPlayed,
  onContinue,
  onStartFresh,
  onClose,
}: PlaySessionPromptProps) => (
  <Modal open={open} onClose={onClose} className="max-w-md">
    <div className="flex flex-col gap-4 p-4">

      <div className="flex flex-col gap-1">
        <Text variant="h5">Pick up where you left off?</Text>
        <Text variant="paragraph" size="sm" color="secondary">
          {lastPlayed
            ? `This deck has a game you last played ${describeWhen(lastPlayed)} — wounds, tokens and turn count are all still saved.`
            : 'This deck has a game in progress — wounds, tokens and turn count are all still saved.'}
        </Text>
      </div>

      <div className="flex flex-col gap-2">
        <Button color="primary" onClick={onContinue}>
          Continue that game
        </Button>
        <Button variant="outline" color="secondary" onClick={onStartFresh}>
          Start a new game
        </Button>
      </div>

      <Text variant="paragraph" size="xs" color="secondary">
        Starting a new game clears every token back to full and resets the turn
        counter. The old game can't be recovered.
      </Text>
    </div>
  </Modal>
);

export default PlaySessionPrompt;
