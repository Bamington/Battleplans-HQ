/**
 * ProfileModalProvider.tsx — one profile modal, launchable from any @handle.
 *
 * Handles show up all over (booking cards, invitations, the friends column).
 * Rather than each place wiring its own FriendProfileModal, they call a shared
 * launcher: <HandleLink> renders the purple, clickable @handle, and clicking it
 * opens the single modal this provider holds.
 *
 * The provider works out the relationship to the clicked user from useFriends —
 * friend / incoming request / outgoing request / none — so the modal shows the
 * right thing (a friend's name and games, or just handle + "Send Friend
 * Request" for someone you don't know yet).
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import FriendProfileModal, { type FriendProfileState } from './FriendProfileModal';
import { useFriends } from '../hooks/useFriends';

export interface ProfileTarget {
  userId: string;
  handle: string;
  avatarUrl?: string | null;
}

const LauncherContext = createContext<(target: ProfileTarget) => void>(() => {
  if (typeof console !== 'undefined') {
    console.warn('openProfile() called with no <ProfileModalProvider> above it — nothing happens.');
  }
});

/** Returns openProfile(target). No-op (with a warning) outside the provider. */
export function useProfileLauncher() {
  return useContext(LauncherContext);
}

export interface ProfileModalProviderProps {
  children: ReactNode;
  /** Resolve a game slug to an icon URL for the modal's Favourite Games. */
  resolveGameIcon?: (slug: string) => string | undefined;
}

export function ProfileModalProvider({ children, resolveGameIcon }: ProfileModalProviderProps) {
  const [target, setTarget] = useState<ProfileTarget | null>(null);
  const { friends, incoming, outgoing, busy, error, sendRequest, respond, remove } = useFriends();

  const state = useMemo<FriendProfileState>(() => {
    if (!target) return { kind: 'none' };
    const f = friends.find(x => x.id === target.userId);
    if (f) return { kind: 'friends', friendshipId: f.friendshipId, username: f.username };
    const inc = incoming.find(x => x.id === target.userId);
    if (inc) return { kind: 'incoming', friendshipId: inc.friendshipId };
    const out = outgoing.find(x => x.id === target.userId);
    if (out) return { kind: 'outgoing', friendshipId: out.friendshipId };
    return { kind: 'none' };
  }, [target, friends, incoming, outgoing]);

  const friendshipId = state.kind === 'none' ? null : state.friendshipId;

  return (
    <LauncherContext.Provider value={setTarget}>
      {children}
      <FriendProfileModal
        open={target !== null}
        onClose={() => setTarget(null)}
        userId={target?.userId}
        handle={target?.handle ?? ''}
        avatarUrl={target?.avatarUrl}
        resolveGameIcon={resolveGameIcon}
        state={state}
        busy={busy}
        error={error}
        onSendRequest={() => { if (target) sendRequest(target.handle); }}
        onRespond={accept => { if (friendshipId) respond(friendshipId, accept); }}
        onWithdraw={async () => { if (friendshipId && await remove(friendshipId)) setTarget(null); }}
      />
    </LauncherContext.Provider>
  );
}

export interface HandleLinkProps {
  /** The user's id. Omit for an unlinked handle (rendered but not clickable). */
  userId?: string | null;
  handle: string;
  avatarUrl?: string | null;
  className?: string;
}

/**
 * An @handle in the brand colour that opens that user's profile when clicked.
 * Inline; inherits the surrounding font so it sits inside a heading cleanly.
 * stopPropagation keeps a click from also triggering a clickable parent (e.g. a
 * booking card that opens its own modal).
 */
export function HandleLink({ userId, handle, avatarUrl, className = '' }: HandleLinkProps) {
  const openProfile = useProfileLauncher();
  const clickable = !!userId;

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? (e => { e.stopPropagation(); openProfile({ userId: userId as string, handle, avatarUrl }); }) : undefined}
      className={[
        'font-[inherit] text-primary-400',
        clickable ? 'hover:text-primary-300 hover:underline cursor-pointer' : 'cursor-default',
        className,
      ].filter(Boolean).join(' ')}
    >
      @{handle}
    </button>
  );
}
