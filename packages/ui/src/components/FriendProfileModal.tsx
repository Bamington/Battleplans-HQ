/**
 * FriendProfileModal.tsx — a user's profile, shown from the friends column
 *
 * The real name ("Your Name", the `username` column) appears ONLY once you are
 * friends. That isn't cosmetic: onboarding promises the name is private until
 * you book or accept a friend, and `public_profiles` no longer carries it, so
 * for anyone who isn't a friend there is nothing to render.
 *
 * The CTA follows the relationship, and disappears entirely once you're friends
 * — there's nothing left to ask for.
 *
 * "Favourite Games" from the design is deliberately absent: `battles` is
 * owner-only, so per-game played/won counts for another user need a cross-user
 * aggregate that doesn't exist yet.
 */

import Modal from './Modal';
import Button from './Button';
import ArrowRight from '../icons/ArrowRight';
import UserRounded from '../icons/UserRounded';

/** How the signed-in user is related to the person being viewed. */
export type FriendProfileState =
  | { kind: 'none' }
  | { kind: 'outgoing'; friendshipId: string }
  | { kind: 'incoming'; friendshipId: string }
  | { kind: 'friends';  friendshipId: string; username: string | null };

export interface FriendProfileModalProps {
  open: boolean;
  onClose: () => void;
  /** Public @username, without the @. */
  handle: string;
  avatarUrl?: string | null;
  state: FriendProfileState;
  onSendRequest?: () => void;
  onRespond?: (accept: boolean) => void;
  /** Withdraw a request you sent. */
  onWithdraw?: () => void;
  busy?: boolean;
  error?: string | null;
}

export default function FriendProfileModal({
  open, onClose, handle, avatarUrl, state,
  onSendRequest, onRespond, onWithdraw, busy = false, error = null,
}: FriendProfileModalProps) {
  if (!open) return null;

  const name = state.kind === 'friends' ? state.username : null;

  return (
    <Modal open onClose={busy ? () => {} : onClose} className="max-w-md">
      <div className="p-5 flex flex-col gap-3 items-start">

        <div className="flex items-center justify-center w-full">
          <div className="w-[120px] h-[120px] rounded-full overflow-hidden bg-neutral-700 flex items-center justify-center shrink-0">
            {avatarUrl
              ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              : <UserRounded className="w-14 h-14 text-neutral-400" />}
          </div>
        </div>

        <div className="flex flex-col w-full">
          <h2 className="font-heading text-white text-3xl leading-9 text-center [text-shadow:0px_0px_4px_rgba(255,255,255,0.1)]">
            @{handle}
          </h2>
          {name && (
            <p className="font-body text-base text-neutral-300 leading-6 text-center">{name}</p>
          )}
        </div>

        {error && <p className="font-body text-sm text-red-400 text-center w-full">{error}</p>}

        {state.kind === 'none' && (
          <div className="flex items-center justify-center w-full">
            <Button
              color="primary"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              loading={busy}
              onClick={onSendRequest}
            >
              Send Friend Request
            </Button>
          </div>
        )}

        {state.kind === 'outgoing' && (
          <div className="flex flex-col gap-2 items-center w-full">
            <p className="font-body text-sm text-neutral-400 text-center">
              Friend request sent.
            </p>
            <Button variant="ghost" color="danger" disabled={busy} onClick={onWithdraw}>
              Withdraw request
            </Button>
          </div>
        )}

        {state.kind === 'incoming' && (
          <div className="flex gap-3 items-center justify-center w-full">
            <Button
              variant="outline"
              color="secondary"
              disabled={busy}
              onClick={() => onRespond?.(false)}
            >
              Decline
            </Button>
            <Button
              color="primary"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              loading={busy}
              onClick={() => onRespond?.(true)}
            >
              Accept
            </Button>
          </div>
        )}

      </div>
    </Modal>
  );
}
