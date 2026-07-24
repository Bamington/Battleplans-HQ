/**
 * AddFriendModal.tsx — "Add Friends" dialog
 *
 * One way in: a @username.
 *
 * Inviting by email address was tried and removed. Doing it without turning the
 * box into an account-lookup oracle meant the invitation could never touch
 * `friendships` until it was accepted, a declined invitation had to go on
 * looking pending forever, and one sent to an address that never signed up had
 * nowhere to go. The dialog deliberately makes no promise about it returning.
 *
 * Validation is FORMAT ONLY, deliberately. Checking whether the value matches a
 * real account before sending would turn this box into a directory: type
 * handles, watch the button light up, learn who has an account. The send itself
 * is the only thing that touches real records.
 *
 * Takes `onSend` rather than calling the RPC itself so it shares one useFriends
 * instance with whatever rendered it. That matters: sending to someone who had
 * already requested YOU auto-accepts, and the friends list must update.
 */

import { useEffect, useState } from 'react';
import { normaliseHandle, validateHandle } from '../lib/handles';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import ArrowRight from '../icons/ArrowRight';

export interface AddFriendModalProps {
  open: boolean;
  onClose: () => void;
  /** Sends a request by @username. Resolves true on success. */
  onSend: (handle: string) => Promise<boolean>;
  /** True while a send is in flight. */
  busy?: boolean;
  /** Failure from the last attempt, safe to display. */
  error?: string | null;
}

export default function AddFriendModal({
  open, onClose, onSend, busy = false, error = null,
}: AddFriendModalProps) {
  const [handle, setHandle] = useState('');

  // Start clean each time it opens, so a previous attempt isn't still sitting
  // in the field.
  useEffect(() => {
    if (open) setHandle('');
  }, [open]);

  const canSend = validateHandle(handle) === null && !busy;

  async function handleSubmit() {
    if (!canSend) return;
    if (await onSend(handle)) onClose();
  }

  if (!open) return null;

  return (
    <Modal open onClose={busy ? () => {} : onClose} className="max-w-md">
      {/* p-5 / gap-4 and the heading+blurb pair match ProfileModal and
          WelcomeModal, so all three dialogs sit on the same rhythm. */}
      <form
        className="p-5 flex flex-col gap-4"
        onSubmit={e => { e.preventDefault(); handleSubmit(); }}
      >
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-white text-[19.8px] leading-7 tracking-[-0.5px]">
            Add Friends
          </h2>
          <p className="font-body text-base text-gray-300 leading-6">
            Add a friend by entering their BattlePlan username.
          </p>
        </div>

        <Input
          label="Friend’s BattlePlan Username"
          placeholder="e.g. captainamerica"
          value={handle}
          // Coerced to the legal alphabet as it's typed, so a pasted "@name"
          // becomes "name" rather than failing validation for the leading @.
          onChange={e => setHandle(normaliseHandle(e.target.value))}
          // The @ is shown rather than typed — normaliseHandle strips it anyway,
          // so a user who types one would watch it vanish.
          leftIcon={<span className="font-body text-sm text-neutral-400">@</span>}
          disabled={busy}
          state={error ? 'error' : 'default'}
          // The error REPLACES the hint rather than appearing under it. Input
          // colours helperText from `state`, so keeping both would render two
          // red lines — the hint looking like part of the failure.
          helperText={error ?? 'They’ll see the invitation on their BattlePlan dashboard.'}
        />

        <div className="flex gap-3 items-center justify-end">
          <Button type="button" variant="ghost" color="danger" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            color="primary"
            rightIcon={<ArrowRight className="w-4 h-4" />}
            disabled={!canSend}
            loading={busy}
          >
            Send Friend Request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
