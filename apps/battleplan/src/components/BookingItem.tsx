import { useState } from 'react';
import { supabase, Button, Modal, Dropdown, DropdownItem, TrashBinMinimalistic, ArrowRight } from '@battleplans/ui';

const MenuDotsIcon = () => (
  <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="3" r="1.2"/>
    <circle cx="8" cy="8" r="1.2"/>
    <circle cx="8" cy="13" r="1.2"/>
  </svg>
);

export function BookingItem({ bookingId, gameIcon, gameName, location, date, time, customerName, onDeleted }: {
  bookingId: string;
  gameIcon?: string;
  gameName: string;
  location: string;
  date: string;
  time: string;
  customerName?: string;
  onDeleted?: () => void;
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
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] flex gap-1.5 items-center shadow-md">

        {/* Game thumbnail */}
        <div className="w-16 h-16 rounded-sm overflow-hidden shrink-0 bg-neutral-700 flex items-center justify-center">
          {gameIcon
            ? <img src={gameIcon} alt={gameName} className="w-full h-full object-cover" />
            : <span className="font-heading text-white text-xs text-center px-1 leading-tight">{gameName}</span>
          }
        </div>

        {/* Text block */}
        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-heading text-lg text-white leading-6">{gameName}</span>
          {customerName && <span className="font-body text-xs text-primary-300 leading-4">{customerName}</span>}
          <span className="font-body text-xs text-neutral-300 leading-4">{location}</span>
          <span className="font-body text-xs text-neutral-300 leading-4">{date}</span>
          <span className="font-body text-xs text-neutral-300 leading-4">{time}</span>
        </div>

        {/* 3-dot menu */}
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
