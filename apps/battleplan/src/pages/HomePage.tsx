import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, AppFooter, Button, Modal, Input, Select, SearchSelect, ArrowRight, AltArrowLeft, AltArrowRight, UserRounded, Widget2 } from '@battleplans/ui';
import AppNavbar from '../components/AppNavbar';
import DatePickerInput from '../components/DatePickerInput';
import { StoreSelector } from '../components/StoreSelector';
import { BookingItem } from '../components/BookingItem';
import { GAME_ICONS } from '../components/gameIcons';
import {
  useGames, useLocations, useTimeslots, useUserBookings, useTableAvailability,
  useAdminLocations, useUpcomingBookings,
  formatTimeslotLabel, formatBookingTime,
} from '../hooks/useBookingData';
import type { Location } from '../hooks/useBookingData';

declare const __APP_VERSION__: string;
declare const __APP_BUILD_DATE__: string;

// ── Icons ─────────────────────────────────────────────────────────────────────

const BoxIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="14" width="36" height="28" rx="3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 20h36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M2 14l6-8h32l6 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M19 20v6h10v-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const InfoCircleIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2.5"/>
    <path d="M24 22v10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="24" cy="16" r="1.5" fill="currentColor"/>
  </svg>
);

const AddCircleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ── Logo ──────────────────────────────────────────────────────────────────────

const BattlePlanLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattlePlan</span>
);

// ── New Booking Modal ─────────────────────────────────────────────────────────

function NewBookingModal({
  open, onClose, userId, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  onCreated: () => void;
}) {
  const [name,       setName]       = useState('');
  const [gameId,     setGameId]     = useState('');
  const [locationId, setLocationId] = useState('');
  const [date,       setDate]       = useState('');
  const [timeslotId, setTimeslotId] = useState('');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const { games,     loading: gamesLoading }     = useGames();
  const { locations, loading: locationsLoading } = useLocations();
  const { timeslots, loading: timeslotsLoading } = useTimeslots(locationId || null, date || null);
  const { available, loading: availLoading }     = useTableAvailability(locationId || null, date || null, timeslotId || null);

  const today = new Date().toISOString().slice(0, 10);

  // Reset downstream fields when upstream selection changes
  const handleLocationChange = (id: string) => { setLocationId(id); setDate(''); setTimeslotId(''); };
  const handleDateChange     = (d: string)  => { setDate(d); setTimeslotId(''); };

  const tablesReady = locationId && date && timeslotId && !availLoading;
  const canSubmit   = name.trim() && locationId && date && timeslotId && tablesReady && available !== null && available > 0;

  const handleClose = () => {
    if (saving) return;
    setName(''); setGameId(''); setLocationId(''); setDate(''); setTimeslotId(''); setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!canSubmit || !userId) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('bookings').insert({
      user_id:    userId,
      user_name:  name.trim(),
      game_id:    gameId || null,
      location_id: locationId,
      timeslot_id: timeslotId,
      date,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    onCreated();
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <div className="flex flex-col gap-4 p-5">

        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-xl text-white">New Booking</h2>
          <p className="font-body text-base text-neutral-300">Book a table at a nearby store.</p>
        </div>

        <Input
          label="Your Name"
          type="text"
          placeholder="Your name"
          leftIcon={<UserRounded className="w-4 h-4" />}
          helperText="The store will see this name in your booking."
          value={name}
          onChange={e => setName(e.target.value)}
        />

        <SearchSelect
          label="Game (Optional)"
          placeholder="Choose Game"
          searchPlaceholder="Search games…"
          value={gameId}
          onChange={setGameId}
          disabled={gamesLoading}
          emptyLabel="No games match your search."
          options={games.map(g => {
            const icon = GAME_ICONS[g.slug];
            return {
              value: g.id,
              label: g.name,
              icon: (
                <span className="size-6 rounded overflow-hidden bg-neutral-700 flex items-center justify-center">
                  {icon
                    ? <img src={icon} alt="" className="w-full h-full object-cover" />
                    : <Widget2 className="w-3.5 h-3.5 text-neutral-400" />}
                </span>
              ),
            };
          })}
        />

        <SearchSelect
          label="Location"
          placeholder="Choose a Venue"
          searchPlaceholder="Search venues…"
          value={locationId}
          onChange={handleLocationChange}
          disabled={locationsLoading}
          emptyLabel="No venues match your search."
          options={locations.map(l => {
            const isUrl = l.icon?.startsWith('http');
            return {
              value: l.id,
              label: l.name,
              icon: (
                <span className="size-6 rounded overflow-hidden bg-neutral-700 flex items-center justify-center">
                  {isUrl
                    ? <img src={l.icon} alt="" className="w-full h-full object-cover" />
                    : l.icon
                      ? <span className="text-base leading-none">{l.icon}</span>
                      : <span className="font-body text-xs font-bold text-primary-300 uppercase">{l.name[0]}</span>}
                </span>
              ),
            };
          })}
        />

        {locationId && (
          <DatePickerInput
            label="Date"
            value={date}
            min={today}
            onChange={handleDateChange}
          />
        )}

        {locationId && date && (
          <Select
            label="Time"
            value={timeslotId}
            onChange={e => setTimeslotId(e.target.value)}
            disabled={timeslotsLoading}
          >
            <option value="">{timeslotsLoading ? 'Loading…' : timeslots.length === 0 ? 'No timeslots available' : 'Select a timeslot'}</option>
            {timeslots.map(t => <option key={t.id} value={t.id}>{formatTimeslotLabel(t)}</option>)}
          </Select>
        )}

        {tablesReady && !availLoading && available !== null && (
          available > 0 ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-900/40 border border-green-700">
              <span className="font-body text-sm text-green-300">
                {available} {available === 1 ? 'table' : 'tables'} available for this time
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/40 border border-red-700">
              <span className="font-body text-sm text-red-300">No tables available at this time</span>
            </div>
          )
        )}

        {error && <p className="font-body text-sm text-red-400">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-1">
          <Button variant="ghost" color="danger" size="sm" disabled={saving} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            size="sm"
            loading={saving}
            disabled={!canSubmit}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={handleConfirm}
          >
            Confirm Booking
          </Button>
        </div>

      </div>
    </Modal>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BookingCard({ userId }: { userId: string | null }) {
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const { bookings, loading, refetch } = useUserBookings(userId);

  return (
    <>
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-px shrink-0 snap-start snap-always w-[90vw] max-w-[90vw] md:w-[40vw] md:max-w-[40vw] lg:w-auto lg:flex-1 lg:max-w-sm flex flex-col shadow-md overflow-hidden">
        <div className="flex flex-col gap-4 items-center p-5 flex-1">

          <BoxIcon />

          <h2 className="font-heading text-xl text-white">Your Bookings</h2>

          <p className="font-body text-base text-neutral-300 text-center">
            Tables you've booked at your favorite local game stores.
          </p>

          <div className="flex flex-col gap-1.5 w-full flex-1">
            {loading ? (
              <p className="font-body text-sm text-neutral-500 text-center py-4">Loading…</p>
            ) : bookings.length === 0 ? (
              <p className="font-body text-sm text-neutral-500 text-center py-4">No upcoming bookings.</p>
            ) : bookings.map(b => {
              const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
              const [y,m,d] = b.date.split('-').map(Number);
              const dt = new Date(y, m-1, d);
              const dateLabel = `${DAY_NAMES[dt.getDay()]} ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${String(y).slice(2)}`;
              return (
                <BookingItem
                  key={b.id}
                  bookingId={b.id}
                  gameIcon={b.game?.slug ? GAME_ICONS[b.game.slug] : undefined}
                  gameName={b.game?.name ?? 'Unknown Game'}
                  location={b.location.name}
                  date={dateLabel}
                  time={formatBookingTime(b.timeslot)}
                  onDeleted={refetch}
                />
              );
            })}
          </div>

          <Button variant="outline" color="primary" leftIcon={<AddCircleIcon />} className="w-full justify-center" onClick={() => setNewBookingOpen(true)}>
            New Booking
          </Button>

        </div>
      </div>

      <NewBookingModal
        open={newBookingOpen}
        onClose={() => setNewBookingOpen(false)}
        userId={userId}
        onCreated={refetch}
      />
    </>
  );
}

function NewsCard() {
  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-px shrink-0 snap-start snap-always w-[90vw] max-w-[90vw] md:w-[40vw] md:max-w-[40vw] lg:w-auto lg:flex-1 lg:max-w-sm flex flex-col shadow-md overflow-hidden">
      <div className="flex flex-col gap-4 items-center p-5 flex-1">

        <InfoCircleIcon />

        <h2 className="font-heading text-xl text-white">News &amp; Updates</h2>

        <p className="font-body text-base text-neutral-300 text-center">
          Find out what's happening with BattlePlan.
        </p>

        <NewsItem />

      </div>
    </div>
  );
}

function NewsItem() {
  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] flex flex-col gap-1.5 shadow-md w-full">
      <h3 className="font-heading text-lg text-white leading-6">Example Release Note</h3>

      <hr className="border-neutral-700" />

      <p className="font-body text-base text-white leading-6 line-clamp-3 overflow-hidden">
        This is a placeholder release note. It has a maximum of 3 lines, after which the text will
        be truncated. But don't worry, there's a button to view the full update!
      </p>

      <div className="flex justify-end">
        <Button variant="ghost" color="primary" size="sm" rightIcon={<ArrowRightIcon />}>
          Read Update
        </Button>
      </div>
    </div>
  );
}

// ── Today's Bookings ──────────────────────────────────────────────────────────

const CalendarIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="10" width="36" height="32" rx="3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 20h36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M16 6v8M32 6v8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="16" cy="30" r="2" fill="currentColor"/>
    <circle cx="24" cy="30" r="2" fill="currentColor"/>
    <circle cx="32" cy="30" r="2" fill="currentColor"/>
  </svg>
);


const UPCOMING_PAGE_SIZE = 6;

function formatBookingDate(iso: string): string {
  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAY_NAMES[dt.getDay()]} ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${String(y).slice(2)}`;
}

function UpcomingBookingsCard({ locations, selectedId }: { locations: Location[]; selectedId: string }) {
  // selectedId is chosen from the navbar venue picker; '' = all of this admin's
  // venues, otherwise a single venue.
  const activeLocationIds = selectedId ? [selectedId] : locations.map(l => l.id);

  const { bookings, loading, refetch } = useUpcomingBookings(activeLocationIds);
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(bookings.length / UPCOMING_PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const paginated  = bookings.slice(safePage * UPCOMING_PAGE_SIZE, (safePage + 1) * UPCOMING_PAGE_SIZE);

  // Snap back into range whenever the list shrinks (e.g. after a deletion)
  useEffect(() => { if (page > totalPages - 1) setPage(totalPages - 1); }, [totalPages, page]);

  // Jump back to the first page when switching which venue is shown
  useEffect(() => { setPage(0); }, [selectedId]);

  const navigate = useNavigate();

  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-px shrink-0 snap-start snap-always w-[90vw] max-w-[90vw] md:w-[40vw] md:max-w-[40vw] lg:w-auto lg:flex-1 lg:max-w-sm flex flex-col shadow-md overflow-hidden">
      <div className="flex flex-col gap-4 items-center p-5 flex-1">

        <CalendarIcon />

        <h2 className="font-heading text-xl text-white">Upcoming Bookings</h2>

        <p className="font-body text-base text-neutral-300 text-center">
          All upcoming table bookings at your venues.
        </p>

        <div className="flex flex-col gap-1.5 w-full flex-1">
          {loading ? (
            <p className="font-body text-sm text-neutral-500 text-center py-4">Loading…</p>
          ) : bookings.length === 0 ? (
            <p className="font-body text-sm text-neutral-500 text-center py-4">No upcoming bookings.</p>
          ) : paginated.map(b => (
            <BookingItem
              key={b.id}
              bookingId={b.id}
              gameIcon={b.game?.slug ? GAME_ICONS[b.game.slug] : undefined}
              gameName={b.game?.name ?? 'Unknown Game'}
              location={b.location.name}
              date={formatBookingDate(b.date)}
              time={formatBookingTime(b.timeslot)}
              customerName={b.user_name ?? undefined}
              onDeleted={refetch}
            />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center">
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage(p => p - 1)}
              className="size-9 flex items-center justify-center
                         bg-neutral-900 border border-neutral-700 rounded-l-lg
                         text-neutral-400 hover:text-white hover:bg-neutral-800
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <AltArrowLeft className="size-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                className={[
                  'size-9 flex items-center justify-center font-body text-sm',
                  'border-y border-r border-neutral-700 transition-colors',
                  i === safePage
                    ? 'bg-neutral-800 text-neutral-50'
                    : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white',
                ].join(' ')}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="size-9 flex items-center justify-center
                         bg-neutral-900 border-y border-r border-neutral-700 rounded-r-lg
                         text-neutral-400 hover:text-white hover:bg-neutral-800
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <AltArrowRight className="size-4" />
            </button>
          </div>
        )}

        <Button
          variant="outline"
          color="primary"
          className="w-full justify-center"
          onClick={() => navigate('/app/manage-store')}
        >
          Manage Store
        </Button>

      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  const { adminLocations } = useAdminLocations(userId);
  const adminLocationIds   = adminLocations.map(l => l.id);
  const isLocationAdmin    = adminLocationIds.length > 0;

  // Which venue's bookings the Upcoming Bookings panel shows; '' = all venues.
  // Driven by the navbar venue picker (multi-venue admins only).
  const [selectedVenueId, setSelectedVenueId] = useState('');

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">

      <AppNavbar fixed={false} logo={<BattlePlanLogo />}>
        {adminLocations.length > 1 && (
          <StoreSelector
            locations={adminLocations}
            selectedId={selectedVenueId}
            onSelect={setSelectedVenueId}
            allowAll
          />
        )}
      </AppNavbar>

      <main className="flex flex-1 items-stretch pt-3 md:pt-9 lg:px-9 w-full">
        <div className="flex flex-1 items-stretch gap-2.5 overflow-x-auto snap-x snap-mandatory lg:overflow-x-visible lg:snap-none lg:justify-center px-3 md:px-9 py-2 scroll-px-3 md:scroll-px-9 lg:p-0">
          <BookingCard userId={userId} />
          {isLocationAdmin && <UpcomingBookingsCard locations={adminLocations} selectedId={selectedVenueId} />}
          <NewsCard />
        </div>
      </main>

      <AppFooter appName="BattlePlan" version={__APP_VERSION__} buildDate={__APP_BUILD_DATE__} />

    </div>
  );
}
