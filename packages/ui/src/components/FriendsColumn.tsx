/**
 * FriendsColumn.tsx — the "My Friends" home-screen column
 *
 * Two sections in one list: incoming friend requests, then accepted friends.
 * Each section (and its divider) appears ONLY when it has something in it, so a
 * user with no pending requests never sees an empty "Friend Requests" heading.
 *
 * NAMING, as everywhere in this feature: the public @handle is labelled
 * "Username" to users, and `username` is their private "Your Name". A request
 * card deliberately shows only the handle — you haven't accepted them yet, so
 * their real name is not yours to see. See the note at the top of lib/handles.ts.
 */

import { useState } from 'react';
import type { Friend, FriendRequest } from '../lib/friends';
import { useFriends } from '../hooks/useFriends';
import ColumnHeader from './ColumnHeader';
import { ColumnShell } from './Column';
import Button from './Button';
import Modal from './Modal';
import HR from './HR';
import Dropdown, { DropdownItem } from './Dropdown';
import AddFriendModal from './AddFriendModal';
import FriendProfileModal from './FriendProfileModal';
import UserHandUp from '../icons/UserHandUp';
import MenuDots from '../icons/MenuDots';
import AddCircle from '../icons/AddCircle';
import CheckCircle from '../icons/CheckCircle';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';

// ── Shared bits ──────────────────────────────────────────────────────────────

/** 64px avatar, matching the game-icon block on BookingItem. */
function CardAvatar({ url, handle }: { url: string | null; handle: string }) {
  return (
    <div className="w-16 h-16 rounded-sm overflow-hidden shrink-0 bg-neutral-700 flex items-center justify-center self-stretch">
      {url
        ? <img src={url} alt="" className="w-full h-full object-cover" />
        : <span className="font-heading text-white text-lg uppercase">{handle.slice(0, 2)}</span>}
    </div>
  );
}

/* Gap is deliberately not baked in — two classes setting `gap` on one element
   resolve by stylesheet order, not the order written here, so each card sets
   its own. All three currently use gap-3 (12px) so adjacent cards line up. */
const CARD = 'bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] flex gap-3 shadow-md overflow-hidden w-full';

// ── Request card ─────────────────────────────────────────────────────────────

function RequestCard({
  request, busy, onAccept,
}: {
  request: FriendRequest;
  busy: boolean;
  onAccept: () => void;
}) {
  return (
    <div className={`${CARD} items-start`}>
      <CardAvatar url={request.avatarUrl} handle={request.handle} />
      {/* Back beside the handle now the button is icon-only — at that width it
          no longer squeezes the handle down to a few characters. */}
      <div className="flex flex-1 min-w-0 gap-2 items-center justify-between self-stretch">
        <p className="font-heading text-white text-lg leading-6 truncate">@{request.handle}</p>
        <Button
          variant="outline"
          color="primary"
          size="sm"
          aria-label={`Accept friend request from @${request.handle}`}
          disabled={busy}
          onClick={onAccept}
          className="shrink-0"
        >
          <CheckCircle className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Pending (outgoing) card ──────────────────────────────────────────────────

/**
 * A request you've sent that hasn't been answered. Handle and picture only —
 * they haven't accepted, so their real name still isn't yours to see.
 *
 * Withdrawing skips the confirm step that removing a friend gets: nothing is
 * lost, the other person may never have seen it, and you can simply ask again.
 */
function PendingCard({
  request, busy, onWithdraw,
}: {
  request: FriendRequest;
  busy: boolean;
  onWithdraw: () => void;
}) {
  return (
    <div className={`${CARD} items-center`}>
      <CardAvatar url={request.avatarUrl} handle={request.handle} />
      <div className="flex flex-col flex-1 min-w-0 justify-center">
        <p className="font-heading text-white text-lg leading-6 truncate">@{request.handle}</p>
      </div>
      <Dropdown
        align="right"
        trigger={
          <button
            type="button"
            aria-label={`Options for the request to @${request.handle}`}
            className="p-1 opacity-50 hover:opacity-100 transition-opacity shrink-0"
          >
            <MenuDots className="w-4 h-4 text-white" />
          </button>
        }
      >
        <DropdownItem
          icon={<TrashBinMinimalistic className="w-4 h-4 text-red-400" />}
          disabled={busy}
          onClick={onWithdraw}
        >
          <span className="text-red-400">Remove Friend Request</span>
        </DropdownItem>
      </Dropdown>
    </div>
  );
}

// ── Friend card ──────────────────────────────────────────────────────────────

function FriendCard({
  friend, busy, onOpen, onRemove,
}: {
  friend: Friend;
  busy: boolean;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`${CARD} items-start cursor-pointer hover:border-neutral-600 transition-colors`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
    >
      <CardAvatar url={friend.avatarUrl} handle={friend.handle} />
      <div className="flex flex-col flex-1 min-w-0 self-stretch justify-center">
        <p className="font-heading text-white text-lg leading-6 truncate">@{friend.handle}</p>
        {friend.username && (
          <p className="font-body font-bold text-sm leading-5 text-neutral-300 opacity-50 truncate">
            {friend.username}
          </p>
        )}
      </div>
      {/* stopPropagation so opening the menu doesn't also open the profile. */}
      <div onClick={e => e.stopPropagation()}>
        <Dropdown
          align="right"
          trigger={
            <button
              type="button"
              aria-label={`Options for @${friend.handle}`}
              className="p-1 opacity-50 hover:opacity-100 transition-opacity shrink-0"
            >
              <MenuDots className="w-4 h-4 text-white" />
            </button>
          }
        >
          <DropdownItem
            icon={<TrashBinMinimalistic className="w-4 h-4 text-red-400" />}
            disabled={busy}
            onClick={onRemove}
          >
            <span className="text-red-400">Remove Friend</span>
          </DropdownItem>
        </Dropdown>
      </div>
    </div>
  );
}

// ── Column ───────────────────────────────────────────────────────────────────

export interface FriendsColumnProps {
  /**
   * Override opening the Add Friends dialog. Omit and the column renders its
   * own, which is usually what you want — it shares this column's hook, so a
   * mutual request that auto-accepts appears in the list straight away.
   */
  onAddFriends?: () => void;
  /** Override opening a friend's profile. Omit to use the built-in modal. */
  onOpenFriend?: (friend: Friend) => void;
  className?: string;
}

export default function FriendsColumn({ onAddFriends, onOpenFriend, className }: FriendsColumnProps) {
  const { friends, incoming, outgoing, loading, busy, error, clearError, respond, remove, sendRequest } = useFriends();
  const [pendingRemoval, setPendingRemoval] = useState<Friend | null>(null);
  const [addOpen,        setAddOpen]        = useState(false);
  const [viewing,        setViewing]        = useState<Friend | null>(null);

  const isEmpty = friends.length === 0 && incoming.length === 0 && outgoing.length === 0;

  return (
    <>
      <ColumnShell className={className}>
        <ColumnHeader
          icon={<UserHandUp className="w-12 h-12 text-primary-400" />}
          title="My Friends"
          description="Users who you’ve connected with on Battleplan. Invite them to your games!"
        />

        <div className="flex-1 min-h-0 w-full overflow-y-auto flex flex-col gap-3">
          {loading ? (
            <p className="font-body text-sm text-neutral-500 text-center py-4">Loading…</p>
          ) : (
            <>
              {/* No error line here on purpose. Every action that can fail is
                  started from a dialog, and that dialog shows the reason —
                  repeating it in the column just says the same thing twice. */}
              {incoming.length > 0 && (
                <>
                  <HR variant="text" label="Friend Requests" />
                  {incoming.map(r => (
                    <RequestCard
                      key={r.friendshipId}
                      request={r}
                      busy={busy}
                      onAccept={() => respond(r.friendshipId, true)}
                    />
                  ))}
                </>
              )}

              {/* Sits between the two: requests waiting on YOU come first
                  because they're actionable, then ones waiting on them. */}
              {outgoing.length > 0 && (
                <>
                  <HR variant="text" label="Pending Friend Requests" />
                  {outgoing.map(r => (
                    <PendingCard
                      key={r.friendshipId}
                      request={r}
                      busy={busy}
                      onWithdraw={() => remove(r.friendshipId)}
                    />
                  ))}
                </>
              )}

              {friends.length > 0 && (
                <>
                  <HR variant="text" label="Your Friends" />
                  {friends.map(f => (
                    <FriendCard
                      key={f.friendshipId}
                      friend={f}
                      busy={busy}
                      onOpen={() => (onOpenFriend ? onOpenFriend(f) : setViewing(f))}
                      onRemove={() => setPendingRemoval(f)}
                    />
                  ))}
                </>
              )}

              {isEmpty && (
                <p className="font-body text-sm text-neutral-500 text-center py-4">
                  No friends yet. Add someone to get started.
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex gap-3 items-center w-full">
          <Button
            variant="outline"
            color="primary"
            className="flex-1"
            leftIcon={<AddCircle className="w-4 h-4" />}
            onClick={() => {
              if (onAddFriends) { onAddFriends(); return; }
              clearError();
              setAddOpen(true);
            }}
          >
            Add Friends
          </Button>
        </div>
      </ColumnShell>

      {/* Both dialogs share this column's hook, so accepting or auto-accepting
          updates the list without a second round of fetching. */}
      {/* Cleared on open and close so a previous failure isn't still showing
          the next time the dialog is opened. */}
      <AddFriendModal
        open={addOpen}
        onClose={() => { clearError(); setAddOpen(false); }}
        onSend={sendRequest}
        busy={busy}
        error={error}
      />

      <FriendProfileModal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        handle={viewing?.handle ?? ''}
        avatarUrl={viewing?.avatarUrl}
        state={
          viewing
            ? { kind: 'friends', friendshipId: viewing.friendshipId, username: viewing.username }
            : { kind: 'none' }
        }
        busy={busy}
        error={error}
      />

      {/* Removing a friend is destructive and silent on their side, so it asks
          first — the same confirm step used elsewhere for deletes. */}
      <Modal
        open={pendingRemoval !== null}
        onClose={() => setPendingRemoval(null)}
        className="max-w-sm"
      >
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-white text-[19.8px] leading-7 tracking-[-0.5px]">
              Remove friend
            </h2>
            <p className="font-body text-base text-gray-300 leading-6">
              Remove @{pendingRemoval?.handle} from your friends? You’ll each stop
              seeing the other’s name, and you can add them again later.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              color="secondary"
              className="flex-1"
              disabled={busy}
              onClick={() => setPendingRemoval(null)}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              className="flex-1"
              loading={busy}
              onClick={async () => {
                if (!pendingRemoval) return;
                await remove(pendingRemoval.friendshipId);
                setPendingRemoval(null);
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
