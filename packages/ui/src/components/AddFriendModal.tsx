/**
 * AddFriendModal.tsx — "Add Friends" dialog
 *
 * Two ways in: an email invitation, or a @username. Only one is used per send.
 *
 * Validation is FORMAT ONLY, deliberately. Checking whether the value matches a
 * real account before sending would turn this box into a directory: type
 * addresses or handles, watch the button light up, learn who has an account.
 * The send itself is the only thing that touches real records.
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
import HR from './HR';
import ArrowRight from '../icons/ArrowRight';

/** Good enough to catch typos; the real test is whether the mail arrives. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AddFriendModalProps {
  open: boolean;
  onClose: () => void;
  /** Sends a request by @username. Resolves true on success. */
  onSend: (handle: string) => Promise<boolean>;
  /** Sends an email invitation. Omit while that half isn't built. */
  onInvite?: (email: string) => Promise<boolean>;
  /** True while a send is in flight. */
  busy?: boolean;
  /** Failure from the last attempt, safe to display. */
  error?: string | null;
}

export default function AddFriendModal({
  open, onClose, onSend, onInvite, busy = false, error = null,
}: AddFriendModalProps) {
  const [email,  setEmail]  = useState('');
  const [handle, setHandle] = useState('');

  // Start clean each time it opens, so a previous attempt isn't still sitting
  // in the fields.
  useEffect(() => {
    if (open) { setEmail(''); setHandle(''); }
  }, [open]);

  const emailReady  = EMAIL_PATTERN.test(email.trim());
  const handleReady = validateHandle(handle) === null;
  const canSend     = (handleReady || (emailReady && !!onInvite)) && !busy;

  async function handleSubmit() {
    if (!canSend) return;
    // The username is the actionable path, so it wins if somehow both are set.
    const ok = handleReady
      ? await onSend(handle)
      : onInvite ? await onInvite(email.trim()) : false;
    if (ok) onClose();
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
            You can add a friend by sending them an Email invitation, or by entering
            their BattlePlan username.
          </p>
        </div>

        <Input
          label="Friend’s Email Address"
          type="email"
          placeholder="e.g. steverogers@avengermail.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={!onInvite || busy}
          helperText={
            onInvite
              ? 'We’ll send them an invite on Battleplan if they have an account. If not, they’ll receive an Email invitation.'
              : 'Email invitations are coming soon — for now, add a friend by their username.'
          }
        />

        <HR variant="text" label="OR" spacing="none" />

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
