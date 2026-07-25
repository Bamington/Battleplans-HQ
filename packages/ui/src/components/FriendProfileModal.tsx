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
 * "Favourite Games" — per-game played/won counts — shows ONLY in the friends
 * state, because that data is friends-only: friend_top_games returns nothing to
 * anyone who isn't an accepted friend. When user opt-in public profiles arrive,
 * the same section can render for a non-friend the target chose to expose.
 */

import { useEffect, useState } from 'react';
import { friendTopGames, type FriendGameStat } from '../lib/friends';
import Modal from './Modal';
import Button from './Button';
import Badge from './Badge';
import ArrowRight from '../icons/ArrowRight';
import UserRounded from '../icons/UserRounded';
import Play from '../icons/Play';
import Star from '../icons/Star';

/** How the signed-in user is related to the person being viewed. */
export type FriendProfileState =
  | { kind: 'none' }
  | { kind: 'outgoing'; friendshipId: string }
  | { kind: 'incoming'; friendshipId: string }
  | { kind: 'friends';  friendshipId: string; username: string | null };

export interface FriendProfileModalProps {
  open: boolean;
  onClose: () => void;
  /** The friend's user id — needed to load their game stats. */
  userId?: string;
  /** Public @username, without the @. */
  handle: string;
  avatarUrl?: string | null;
  state: FriendProfileState;
  /**
   * Resolve a game slug to an icon URL. Optional — the game-icon map is
   * app-specific (it globs each app's assets), so the app supplies it. Without
   * it, or on a miss, the game's initials stand in.
   */
  resolveGameIcon?: (slug: string) => string | undefined;
  onSendRequest?: () => void;
  onRespond?: (accept: boolean) => void;
  /** Withdraw a request you sent. */
  onWithdraw?: () => void;
  busy?: boolean;
  error?: string | null;
}

export default function FriendProfileModal({
  open, onClose, userId, handle, avatarUrl, state, resolveGameIcon,
  onSendRequest, onRespond, onWithdraw, busy = false, error = null,
}: FriendProfileModalProps) {
  const isFriend = state.kind === 'friends';
  const [games, setGames] = useState<FriendGameStat[]>([]);

  // Only friends have readable stats. Loading for anyone else would just get an
  // empty list back, but there's no reason to make the round-trip.
  useEffect(() => {
    if (!open || !isFriend || !userId) { setGames([]); return; }
    let cancelled = false;
    friendTopGames(userId)
      .then(g => { if (!cancelled) setGames(g); })
      .catch(() => { if (!cancelled) setGames([]); });
    return () => { cancelled = true; };
  }, [open, isFriend, userId]);

  if (!open) return null;

  const name = state.kind === 'friends' ? state.username : null;

  return (
    <Modal open onClose={busy ? () => {} : onClose} className="max-w-md">
      <div className="p-5 flex flex-col gap-3 items-start">

        <div className="flex items-center justify-center w-full">
          {/* Square, like every other avatar surface — the cropper frames a
              square, so a circle here would hide corners the user kept. */}
          <div className="w-[120px] h-[120px] rounded-lg overflow-hidden bg-neutral-700 flex items-center justify-center shrink-0">
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

        {/* Favourite Games — friends only, and only when they've logged any.
            An empty section would read as "this person doesn't play", which
            isn't what no data means. */}
        {isFriend && games.length > 0 && (
          <div className="flex flex-col gap-1.5 w-full">
            <p className="font-body font-bold text-sm leading-5 text-neutral-300 text-center">
              Favourite Games
            </p>
            {games.map(game => {
              const icon = resolveGameIcon?.(game.slug);
              return (
                <div
                  key={game.gameId}
                  className="bg-neutral-800 border border-neutral-700 rounded-lg p-px flex gap-1.5 items-center shadow-md overflow-hidden w-full"
                >
                  <div className="w-9 h-9 rounded-sm overflow-hidden shrink-0 bg-neutral-700 flex items-center justify-center">
                    {icon
                      ? <img src={icon} alt="" className="w-full h-full object-cover" />
                      : <span className="font-heading text-white text-xs uppercase">{game.name.slice(0, 2)}</span>}
                  </div>
                  <p className="font-heading text-white text-lg leading-6 truncate flex-1 min-w-0">
                    {game.name}
                  </p>
                  <Badge color="purple" icon={<Play className="w-3 h-3" />}>
                    {game.played} Played
                  </Badge>
                  <Badge color="success" icon={<Star className="w-3 h-3" />}>
                    {game.won} Won
                  </Badge>
                </div>
              );
            })}
          </div>
        )}

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
