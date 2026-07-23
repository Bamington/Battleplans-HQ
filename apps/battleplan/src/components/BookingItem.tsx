import { useState } from 'react';
import { supabase, Button, Modal, Dropdown, DropdownItem, TrashBinMinimalistic, ArrowRight } from '@battleplans/ui';

const MenuDotsIcon = () => (
  <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="3" r="1.2"/>
    <circle cx="8" cy="8" r="1.2"/>
    <circle cx="8" cy="13" r="1.2"/>
  </svg>
);

/**
 * Which booking card layout to render (Figma "Card / Booking", 1005:17885).
 *
 * Both variants are four lines: a heading, one muted bold line, then date and
 * time. Only the first two lines differ — the muted line carries whichever of
 * game/venue the heading didn't.
 *
 *   'user'  — My Bookings. Heading is the game; muted line is the venue.
 *   'store' — Store Admin. Heading is the customer; muted line is the game.
 *             The venue is omitted: the admin is already looking at it.
 */
export type BookingItemVariant = 'user' | 'store';

export function BookingItem({ bookingId, gameIcon, gameName, location, date, time, customerName, variant = 'user', onDeleted, onClick }: {
  bookingId: string;
  gameIcon?: string;
  gameName: string;
  /** Venue name. Shown only in the 'user' variant. */
  location: string;
  date: string;
  time: string;
  customerName?: string;
  variant?: BookingItemVariant;
  onDeleted?: () => void;
  /** Makes the card tappable (opens the booking modal). The menu stops propagation. */
  onClick?: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  const handleRemove = async () => {
    setDeleting(true);
    const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
    setDeleting(false);
    if (!error) { setConfirmOpen(false); onDeleted?.(); }
  };

  return (
    <>
      <div
        className={`bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] flex gap-1.5 items-start shadow-md overflow-hidden ${onClick ? 'cursor-pointer hover:border-neutral-600 transition-colors' : ''}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }) : undefined}
      >

        {/* Game thumbnail */}
        <div className="w-16 h-16 rounded-sm overflow-hidden shrink-0 bg-neutral-700 flex items-center justify-center">
          {gameIcon
            ? <img src={gameIcon} alt={gameName} className="w-full h-full object-cover" />
            : <span className="font-heading text-white text-xs text-center px-1 leading-tight">{gameName}</span>
          }
        </div>

        {/* Text block — truncated so the row stays a fixed height, which the
            home screen's auto page-size calculation depends on. */}
        <div className="flex flex-col flex-1 min-w-0 self-stretch justify-center">
          <span className="font-heading text-lg text-white leading-6 truncate">
            {variant === 'store' ? (customerName ?? 'Guest') : gameName}
          </span>
          <span className="font-body text-sm font-bold text-neutral-300 leading-5 opacity-50 truncate">
            {variant === 'store' ? gameName : location}
          </span>
          <span className="font-body text-sm text-neutral-50 leading-5 truncate">{date}</span>
          <span className="font-body text-sm text-neutral-50 leading-5 truncate">{time}</span>
        </div>

        {/* 3-dot menu — stops propagation so it doesn't also open the card. */}
        <div onClick={e => e.stopPropagation()}>
          <Dropdown
            align="right"
            trigger={
              <button type="button" className="p-1 opacity-50 hover:opacity-100 transition-opacity shrink-0">
                <MenuDotsIcon />
              </button>
            }
          >
            <DropdownItem
              icon={<TrashBinMinimalistic className="w-4 h-4 text-red-400" />}
              onClick={() => setConfirmOpen(true)}
            >
              <span className="text-red-400">Cancel Booking</span>
            </DropdownItem>
          </Dropdown>
        </div>

      </div>

      {/* Delete confirmation modal */}
      <Modal
        open={confirmOpen}
        onClose={() => !deleting && setConfirmOpen(false)}
      >
        <div className="flex flex-col gap-3 p-5">
          <TrashBinMinimalistic className="w-8 h-8 text-primary-500" />
          <h2 className="font-heading text-xl text-white">Cancel Booking</h2>
          <p className="font-body text-base text-neutral-300">This table will be available for others to book. We'll let the venue know you've cancelled this booking.</p>
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button variant="ghost" size="sm" disabled={deleting} onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              color="danger"
              size="sm"
              loading={deleting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={handleRemove}
            >
              Yes, Cancel my Booking
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
