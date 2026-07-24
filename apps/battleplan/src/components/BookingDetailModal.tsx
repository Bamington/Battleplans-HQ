/**
 * BookingDetailModal.tsx — the modal that opens when you tap a booking.
 *
 * Two shapes, chosen by your relationship to the booking:
 *
 *   • Owner  — <BookingDetailModal>. Tabbed: Details, and Invite Friends
 *     (share the booking by @username; manage who you've invited).
 *   • Invitee — <BookingInvitationModal>. The booking's details, plus
 *     Accept / Decline for the invitation.
 *
 * NAMING, as across this feature: an invitee is shown by their @handle. Their
 * real name appears ONLY where you're already friends — the Pending Invitations
 * list cross-references your friends to decide, since booking_shares itself
 * never carries the private name.
 */

import { useMemo, useState } from 'react';
import {
  Modal, Button, Input, Dropdown, DropdownItem,
  MapPin, Calendar, Notebook, InfoCircle, UserRounded, UserPlusRounded,
  CheckCircle, CloseCircle, ArrowRight, TrashBinMinimalistic, MenuDots,
  useBookingShares, useFriends,
  normaliseHandle, validateHandle,
  supabase,
  type IncomingBookingShare, type OutgoingBookingShare,
} from '@battleplans/ui';
import { GAME_ICONS } from './gameIcons';
import { formatBookingTime, type Booking } from '../hooks/useBookingData';

// ── Shared bits ──────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatBookingDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAY_NAMES[dt.getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(y).slice(2)}`;
}

function GameThumb({ slug, name }: { slug: string | null; name: string }) {
  const icon = slug ? GAME_ICONS[slug] : undefined;
  return (
    <div className="w-16 h-16 rounded-sm overflow-hidden shrink-0 bg-neutral-700 flex items-center justify-center self-stretch">
      {icon
        ? <img src={icon} alt="" className="w-full h-full object-cover" />
        : <span className="font-heading text-white text-xs text-center px-1 leading-tight">{name}</span>}
    </div>
  );
}

/** Header: game thumbnail, game name, venue, and an optional attribution line. */
function BookingHeader({
  gameName, gameSlug, venue, invitedByHandle, bookedBy,
}: {
  gameName: string;
  gameSlug: string | null;
  venue: string | null;
  /** Invitee view: "Invited by @handle". */
  invitedByHandle?: string;
  /** Store view: "Booked by {customer}". */
  bookedBy?: string;
}) {
  return (
    <div className="flex gap-3 items-center w-full">
      <GameThumb slug={gameSlug} name={gameName} />
      <div className="flex flex-col flex-1 min-w-0">
        <h2 className="font-heading text-white text-xl leading-7 truncate [text-shadow:0px_0px_4px_rgba(255,255,255,0.1)]">
          {gameName}
        </h2>
        {venue && (
          <p className="font-body font-bold text-base text-neutral-300 leading-6 opacity-50 truncate">{venue}</p>
        )}
        {invitedByHandle && (
          <p className="font-body text-sm text-neutral-50 leading-5 truncate">
            Invited by <span className="font-bold">@{invitedByHandle}</span>
          </p>
        )}
        {bookedBy && (
          <p className="font-body text-sm text-neutral-50 leading-5 truncate">
            Booked by <span className="font-bold">{bookedBy}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function DetailRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-neutral-900 flex gap-2 items-center px-4 py-3 w-full">
      <span className="w-4 h-4 shrink-0 text-primary-400 flex items-center justify-center">{icon}</span>
      <p className="flex-1 min-w-0 font-body font-medium text-base text-neutral-50 leading-6">{children}</p>
    </div>
  );
}

function DetailsList({
  address, date, timeslotLabel,
}: {
  address: string | null;
  date: string;
  timeslotLabel: string;
}) {
  return (
    <div className="flex flex-col rounded-xl overflow-hidden w-full divide-y divide-neutral-800">
      {address && <DetailRow icon={<MapPin className="w-full h-full" />}>{address}</DetailRow>}
      <DetailRow icon={<Calendar className="w-full h-full" />}>{formatBookingDate(date)}</DetailRow>
      <DetailRow icon={<Notebook className="w-full h-full" />}>{timeslotLabel}</DetailRow>
    </div>
  );
}

// ── Invite Friends tab (owner) ───────────────────────────────────────────────

function InviteFriendsTab({
  bookingId,
  outgoing,
  busy,
  onShare,
  onWithdraw,
}: {
  bookingId: string;
  outgoing: OutgoingBookingShare[];
  busy: boolean;
  onShare: (handle: string) => Promise<boolean>;
  onWithdraw: (shareId: string) => void;
}) {
  const [handle, setHandle] = useState('');
  const [error,  setError]  = useState<string | null>(null);
  const { friends } = useFriends();

  // A friend's real name may be shown; a non-friend invitee shows handle only.
  const friendName = useMemo(() => {
    const m = new Map<string, string | null>();
    friends.forEach(f => m.set(f.id, f.username));
    return m;
  }, [friends]);

  const canSend = validateHandle(handle) === null && !busy;
  const invites = outgoing.filter(s => s.bookingId === bookingId);

  async function submit() {
    if (!canSend) return;
    setError(null);
    const ok = await onShare(handle);
    if (ok) setHandle('');
    else setError('Could not send that invite. Check the username and try again.');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="font-heading text-white text-[19.8px] leading-7 tracking-[-0.5px]">Invite Friends</h3>
        <Input
          label="Friend’s BattlePlan Username"
          placeholder="e.g. captainamerica"
          value={handle}
          onChange={e => setHandle(normaliseHandle(e.target.value))}
          leftIcon={<span className="font-body text-sm text-neutral-400">@</span>}
          disabled={busy}
          state={error ? 'error' : 'default'}
          helperText={error ?? 'They’ll see the invitation on their BattlePlan dashboard.'}
        />
        <Button
          color="primary"
          className="w-full justify-center"
          leftIcon={<UserPlusRounded className="w-4 h-4" />}
          disabled={!canSend}
          loading={busy}
          onClick={submit}
        >
          Send Invite
        </Button>
      </div>

      {invites.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="font-heading text-white text-[19.8px] leading-7 tracking-[-0.5px]">Pending Invitations</h3>
          {invites.map(inv => (
            <div key={inv.shareId} className="bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] flex gap-1.5 items-center shadow-md overflow-hidden w-full">
              <div className="w-16 h-16 rounded-sm overflow-hidden shrink-0 bg-neutral-700 flex items-center justify-center self-stretch">
                {inv.recipient.avatarUrl
                  ? <img src={inv.recipient.avatarUrl} alt="" className="w-full h-full object-cover" />
                  : <UserRounded className="w-7 h-7 text-neutral-400" />}
              </div>
              <div className="flex flex-col flex-1 min-w-0 justify-center">
                <p className="font-heading text-white text-lg leading-6 truncate">@{inv.recipient.handle}</p>
                {friendName.get(inv.recipient.id) && (
                  <p className="font-body font-bold text-sm leading-5 text-neutral-300 opacity-50 truncate">
                    {friendName.get(inv.recipient.id)}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                color="danger"
                size="sm"
                aria-label={`Withdraw invite to @${inv.recipient.handle}`}
                disabled={busy}
                onClick={() => onWithdraw(inv.shareId)}
              >
                <CloseCircle className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Owner modal ──────────────────────────────────────────────────────────────

export function BookingDetailModal({
  open, onClose, booking, onCancelled, mode = 'owner', customerName,
}: {
  open: boolean;
  onClose: () => void;
  booking: Booking | null;
  /** Called after the booking is cancelled, so the column can refetch. */
  onCancelled?: () => void;
  /**
   * 'owner' — your own booking: tabbed, with Invite Friends.
   * 'store' — a venue admin viewing a customer's booking: Details only, no
   *           invite (it's not theirs to share), but they can still cancel it.
   */
  mode?: 'owner' | 'store';
  /** Store mode: the customer who made the booking. */
  customerName?: string;
}) {
  const [tab, setTab] = useState<'details' | 'invite'>('details');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { outgoing, busy, share, withdraw } = useBookingShares();

  if (!open || !booking) return null;

  const isStore = mode === 'store';

  const segBase = 'flex-1 flex items-center justify-center gap-2 px-3 py-2 font-body font-medium text-sm transition-colors';

  async function cancelBooking() {
    if (!booking) return;
    setCancelling(true);
    const { error } = await supabase.from('bookings').delete().eq('id', booking.id);
    setCancelling(false);
    if (!error) { setCancelOpen(false); onCancelled?.(); onClose(); }
  }

  return (
    <>
      <Modal open onClose={onClose} className="max-w-md">
        <div className="p-5 flex flex-col gap-3 relative">
          <div className="absolute top-4 right-4">
            <Dropdown
              align="right"
              trigger={
                <button type="button" aria-label="Booking options" className="p-1 opacity-50 hover:opacity-100 transition-opacity">
                  <MenuDots className="w-4 h-4 text-white" />
                </button>
              }
            >
              <DropdownItem
                icon={<TrashBinMinimalistic className="w-4 h-4 text-red-400" />}
                onClick={() => setCancelOpen(true)}
              >
                <span className="text-red-400">Cancel Booking</span>
              </DropdownItem>
            </Dropdown>
          </div>

          <BookingHeader
            gameName={booking.game?.name ?? 'No game'}
            gameSlug={booking.game?.slug ?? null}
            venue={booking.location.name}
            bookedBy={isStore ? customerName : undefined}
          />

          {/* A store admin isn't the owner, so no Invite Friends tab — just the
              booking's details (and the cancel option in the menu above). */}
          {!isStore && (
            <div className="flex h-10 w-full rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setTab('details')}
                className={`${segBase} rounded-l-lg ${tab === 'details' ? 'bg-primary-600 text-white' : 'border border-primary-500 text-white'}`}
              >
                <InfoCircle className="w-4 h-4" /> Details
              </button>
              <button
                type="button"
                onClick={() => setTab('invite')}
                className={`${segBase} rounded-r-lg ${tab === 'invite' ? 'bg-primary-600 text-white' : 'border border-primary-500 text-white'}`}
              >
                <UserRounded className="w-4 h-4" /> Invite Friends
              </button>
            </div>
          )}

          {isStore || tab === 'details' ? (
            <DetailsList
              address={booking.location.address}
              date={booking.date}
              timeslotLabel={`${booking.timeslot.name} (${formatBookingTime(booking.timeslot)})`}
            />
          ) : (
            <InviteFriendsTab
              bookingId={booking.id}
              outgoing={outgoing}
              busy={busy}
              onShare={h => share(booking.id, h)}
              onWithdraw={withdraw}
            />
          )}
        </div>
      </Modal>

      <Modal open={cancelOpen} onClose={() => !cancelling && setCancelOpen(false)} className="max-w-sm">
        <div className="flex flex-col gap-3 p-5">
          <TrashBinMinimalistic className="w-8 h-8 text-primary-500" />
          <h2 className="font-heading text-xl text-white">Cancel Booking</h2>
          <p className="font-body text-base text-neutral-300">
            This table will be available for others to book. We’ll let the venue know you’ve cancelled.
          </p>
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button variant="ghost" size="sm" disabled={cancelling} onClick={() => setCancelOpen(false)}>Keep it</Button>
            <Button color="danger" size="sm" loading={cancelling} rightIcon={<ArrowRight className="w-4 h-4" />} onClick={cancelBooking}>
              Yes, Cancel my Booking
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ── Invitee modal ────────────────────────────────────────────────────────────

export function BookingInvitationModal({
  open, onClose, share, busy, onRespond, onLeave,
}: {
  open: boolean;
  onClose: () => void;
  share: IncomingBookingShare | null;
  busy: boolean;
  onRespond: (accept: boolean) => void;
  /** Called when leaving a booking you'd already accepted. */
  onLeave?: () => void;
}) {
  if (!open || !share) return null;

  const accepted = share.status === 'accepted';

  const timeslotLabel = share.timeslotName
    ? `${share.timeslotName}${share.timeslotStart ? ` (${formatBookingTime({ start_time: share.timeslotStart, end_time: share.timeslotEnd ?? '' })})` : ''}`
    : (share.timeslotStart ? formatBookingTime({ start_time: share.timeslotStart, end_time: share.timeslotEnd ?? '' }) : '');

  return (
    <Modal open onClose={busy ? () => {} : onClose} className="max-w-md">
      <div className="p-5 flex flex-col gap-3">
        <BookingHeader
          gameName={share.gameName ?? 'No game'}
          gameSlug={share.gameSlug}
          venue={share.locationName}
          invitedByHandle={share.sharer.handle}
        />

        <DetailsList address={share.locationAddress} date={share.date} timeslotLabel={timeslotLabel} />

        {accepted ? (
          // Already accepted — the only action left is to back out.
          <div className="flex items-center justify-center w-full">
            <Button
              variant="outline"
              color="danger"
              rightIcon={<CloseCircle className="w-4 h-4" />}
              loading={busy}
              onClick={() => onLeave?.()}
            >
              Leave Booking
            </Button>
          </div>
        ) : (
          <div className="flex gap-3 items-center justify-center w-full">
            <Button
              variant="outline"
              color="danger"
              rightIcon={<CloseCircle className="w-4 h-4" />}
              disabled={busy}
              onClick={() => onRespond(false)}
            >
              Decline Invite
            </Button>
            <Button
              variant="outline"
              color="success"
              rightIcon={<CheckCircle className="w-4 h-4" />}
              loading={busy}
              onClick={() => onRespond(true)}
            >
              Accept Invite
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
