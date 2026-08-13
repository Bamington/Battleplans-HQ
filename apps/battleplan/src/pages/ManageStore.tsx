import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, AppFooter, Button, Layers } from '@battleplans/ui';
import AppNavbar from '../components/AppNavbar';
import {
  useAdminLocations, useBlockedDates, useStoreTables, useLocationTimeslots, useBookingsByDate,
  useLocationBookingFees, useLocationStaff, useLocationAdminIds,
  formatDateLabel, formatBookingTime,
} from '../hooks/useBookingData';
import type { StoreTable, LocationTimeslot, BookingFee } from '../hooks/useBookingData';
import { BlockedDateItem, BlockNewDateModal } from '../components/BlockedDates';
import { StoreTableItem, TableFormModal } from '../components/StoreTables';
import { TimeslotItem, TimeslotFormModal } from '../components/Timeslots';
import { BookingFeeItem, BookingFeeFormModal, FeeIcon, sortFees } from '../components/BookingFees';
import { StaffItem, AddStaffModal, StaffIcon } from '../components/LocationStaff';
import { StoreSelector } from '../components/StoreSelector';
import { BookingItem } from '../components/BookingItem';
import { GAME_ICONS } from '../components/gameIcons';
import DatePickerInput from '../components/DatePickerInput';

declare const __APP_VERSION__: string;
declare const __APP_BUILD_DATE__: string;

// ── Bits ──────────────────────────────────────────────────────────────────────

const BattlePlanLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattlePlan</span>
);

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

const TablesIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="9" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
    <rect x="26" y="9" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
    <rect x="6" y="27" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
    <rect x="26" y="27" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
  </svg>
);

const BookingsIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="9" y="8" width="30" height="34" rx="3" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="M17 6v6M31 6v6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M16 22h16M16 30h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ManageStore() {
  const navigate = useNavigate();
  // undefined = session not resolved yet, null = signed out, string = user id
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  // Every column on this page edits venue settings, which is exactly what the
  // staff role withholds — so the page is venue admins only. Staff get their
  // venue's bookings on the home screen instead.
  const { adminLocations, loading } = useAdminLocations(userId ?? null);
  const [selectedId, setSelectedId] = useState('');
  const [addOpen,    setAddOpen]    = useState(false);

  // Default the selection to the first store once locations load.
  useEffect(() => {
    if (adminLocations.length > 0 && !adminLocations.some(l => l.id === selectedId)) {
      setSelectedId(adminLocations[0].id);
    }
  }, [adminLocations, selectedId]);

  // Only venue admins may see this page — send everyone else home. Staff who
  // reach the URL directly land back on their bookings.
  useEffect(() => {
    if (userId === undefined) return;            // still resolving the session
    if (userId === null) { navigate('/app', { replace: true }); return; }
    if (!loading && adminLocations.length === 0) navigate('/app', { replace: true });
  }, [userId, loading, adminLocations, navigate]);

  const selectedStore = adminLocations.find(l => l.id === selectedId);
  const { blockedDates, loading: bdLoading, refetch } = useBlockedDates(selectedId ? [selectedId] : []);

  const { timeslots, loading: timeslotsLoading, refetch: refetchTimeslots } = useLocationTimeslots(selectedId || null);
  const { tables, loading: tablesLoading, refetch: refetchTables } = useStoreTables(selectedId || null);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [editingTable,   setEditingTable]   = useState<StoreTable | null>(null);

  const openAddTable  = () => { setEditingTable(null); setTableModalOpen(true); };
  const openEditTable = (t: StoreTable) => { setEditingTable(t); setTableModalOpen(true); };

  const [timeslotModalOpen, setTimeslotModalOpen] = useState(false);
  const [editingTimeslot,   setEditingTimeslot]   = useState<LocationTimeslot | null>(null);

  const openAddTimeslot  = () => { setEditingTimeslot(null); setTimeslotModalOpen(true); };
  const openEditTimeslot = (t: LocationTimeslot) => { setEditingTimeslot(t); setTimeslotModalOpen(true); };

  const { fees, loading: feesLoading, refetch: refetchFees } = useLocationBookingFees(selectedId || null);
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [editingFee,   setEditingFee]   = useState<BookingFee | null>(null);

  const openAddFee  = () => { setEditingFee(null); setFeeModalOpen(true); };
  const openEditFee = (f: BookingFee) => { setEditingFee(f); setFeeModalOpen(true); };

  const sortedFees = sortFees(fees, timeslots);
  const hasDefaultFee = fees.some(f => f.scope === 'default');

  const { staff, loading: staffLoading, refetch: refetchStaff } = useLocationStaff(selectedId || null);
  const venueAdminIds = useLocationAdminIds(selectedId || null);
  const [staffModalOpen, setStaffModalOpen] = useState(false);

  // Bookings by date — defaults to today (local), any date pickable.
  const [bookingsDate, setBookingsDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const { bookings: dateBookings, loading: dateBookingsLoading, refetch: refetchDateBookings } =
    useBookingsByDate(selectedId || null, bookingsDate);

  return (
    <div className="h-dvh overflow-hidden flex flex-col bg-neutral-950">

      <AppNavbar fixed={false} logo={<BattlePlanLogo />}>
        {selectedStore && (
          <StoreSelector locations={adminLocations} selectedId={selectedId} onSelect={setSelectedId} />
        )}
      </AppNavbar>

      <main className="flex flex-1 min-h-0 items-stretch pt-3 md:pt-9 lg:px-9 w-full">
        <div className="flex flex-1 min-h-0 items-stretch gap-2.5 overflow-x-auto snap-x snap-mandatory lg:overflow-x-visible lg:snap-none lg:justify-center px-3 md:px-9 py-2 scroll-px-3 md:scroll-px-9 lg:p-0">

          {/* Blocked Dates column */}
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-px shrink-0 snap-start snap-always w-[90vw] max-w-[90vw] md:w-[40vw] md:max-w-[40vw] lg:w-auto lg:flex-1 lg:max-w-sm flex flex-col min-h-0 shadow-md overflow-hidden">
            <div className="flex flex-col gap-4 items-center p-5 flex-1 min-h-0">

              <CalendarIcon />

              <h2 className="font-heading text-xl text-white">Blocked Dates</h2>

              <p className="font-body text-base text-neutral-300 text-center">
                Dates when tables can't be booked at {selectedStore?.name ?? 'your venue'}.
              </p>

              <div className="flex flex-col gap-1.5 w-full flex-1 min-h-0 overflow-y-auto">
                {bdLoading ? (
                  <p className="font-body text-sm text-neutral-500 text-center py-4">Loading…</p>
                ) : blockedDates.length === 0 ? (
                  <p className="font-body text-sm text-neutral-500 text-center py-4">No blocked dates yet.</p>
                ) : blockedDates.map(bd => (
                  <BlockedDateItem
                    key={bd.id}
                    blocked={bd}
                    locations={adminLocations}
                    tables={tables}
                    onChanged={refetch}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                color="primary"
                className="w-full justify-center shrink-0"
                onClick={() => setAddOpen(true)}
              >
                Add New Block
              </Button>

            </div>
          </div>

          {/* Tables column */}
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-px shrink-0 snap-start snap-always w-[90vw] max-w-[90vw] md:w-[40vw] md:max-w-[40vw] lg:w-auto lg:flex-1 lg:max-w-sm flex flex-col min-h-0 shadow-md overflow-hidden">
            <div className="flex flex-col gap-4 items-center p-5 flex-1 min-h-0">

              <TablesIcon />

              <h2 className="font-heading text-xl text-white">Tables</h2>

              <p className="font-body text-base text-neutral-300 text-center">
                The tables players can book at {selectedStore?.name ?? 'your venue'}.
              </p>

              <div className="flex flex-col gap-1.5 w-full flex-1 min-h-0 overflow-y-auto">
                {tablesLoading ? (
                  <p className="font-body text-sm text-neutral-500 text-center py-4">Loading…</p>
                ) : tables.length === 0 ? (
                  <p className="font-body text-sm text-neutral-500 text-center py-4">No tables yet.</p>
                ) : tables.map(t => (
                  <StoreTableItem
                    key={t.id}
                    table={t}
                    allTables={tables}
                    timeslots={timeslots}
                    locationId={selectedId}
                    onEdit={() => openEditTable(t)}
                    onChanged={refetchTables}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                color="primary"
                className="w-full justify-center shrink-0"
                onClick={openAddTable}
              >
                Add Table
              </Button>

            </div>
          </div>

          {/* Bookings by Date column — the one thing staff can see. */}
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-px shrink-0 snap-start snap-always w-[90vw] max-w-[90vw] md:w-[40vw] md:max-w-[40vw] lg:w-auto lg:flex-1 lg:max-w-sm flex flex-col min-h-0 shadow-md overflow-hidden">
            <div className="flex flex-col gap-4 items-center p-5 flex-1 min-h-0">

              <BookingsIcon />

              <h2 className="font-heading text-xl text-white">Bookings by Date</h2>

              <p className="font-body text-base text-neutral-300 text-center">
                Bookings at {selectedStore?.name ?? 'your venue'} on the chosen date.
              </p>

              <DatePickerInput
                label="Date"
                value={bookingsDate}
                onChange={setBookingsDate}
              />

              <div className="flex flex-col gap-1.5 w-full flex-1 min-h-0 overflow-y-auto">
                {dateBookingsLoading ? (
                  <p className="font-body text-sm text-neutral-500 text-center py-4">Loading…</p>
                ) : dateBookings.length === 0 ? (
                  <p className="font-body text-sm text-neutral-500 text-center py-4">No bookings on this date.</p>
                ) : dateBookings.map(b => (
                  <BookingItem
                    key={b.id}
                    bookingId={b.id}
                    gameIcon={b.game?.slug ? GAME_ICONS[b.game.slug] : undefined}
                    gameName={b.game?.name ?? 'No game'}
                    location={b.location.name}
                    date={formatDateLabel(b.date)}
                    time={formatBookingTime(b.timeslot)}
                    customerName={b.user_name ?? undefined}
                    variant="store"
                    onDeleted={refetchDateBookings}
                  />
                ))}
              </div>

            </div>
          </div>

          {/* Timeslots column */}
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-px shrink-0 snap-start snap-always w-[90vw] max-w-[90vw] md:w-[40vw] md:max-w-[40vw] lg:w-auto lg:flex-1 lg:max-w-sm flex flex-col min-h-0 shadow-md overflow-hidden">
            <div className="flex flex-col gap-4 items-center p-5 flex-1 min-h-0">

              <Layers className="w-12 h-12 text-primary-500" />

              <h2 className="font-heading text-xl text-white">Timeslots</h2>

              <p className="font-body text-base text-neutral-300 text-center">
                When tables are available to be booked at {selectedStore?.name ?? 'your venue'}.
              </p>

              <div className="flex flex-col gap-1.5 w-full flex-1 min-h-0 overflow-y-auto">
                {timeslotsLoading ? (
                  <p className="font-body text-sm text-neutral-500 text-center py-4">Loading…</p>
                ) : timeslots.length === 0 ? (
                  <p className="font-body text-sm text-neutral-500 text-center py-4">No timeslots yet.</p>
                ) : timeslots.map(t => (
                  <TimeslotItem
                    key={t.id}
                    timeslot={t}
                    onEdit={() => openEditTimeslot(t)}
                    onChanged={refetchTimeslots}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                color="primary"
                className="w-full justify-center shrink-0"
                onClick={openAddTimeslot}
              >
                Add Timeslot
              </Button>

            </div>
          </div>

          {/* Booking Fees column */}
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-px shrink-0 snap-start snap-always w-[90vw] max-w-[90vw] md:w-[40vw] md:max-w-[40vw] lg:w-auto lg:flex-1 lg:max-w-sm flex flex-col min-h-0 shadow-md overflow-hidden">
            <div className="flex flex-col gap-4 items-center p-5 flex-1 min-h-0">

              <FeeIcon />

              <h2 className="font-heading text-xl text-white">Booking Fees</h2>

              <p className="font-body text-base text-neutral-300 text-center">
                What players are told they'll pay to book at {selectedStore?.name ?? 'your venue'}.
              </p>

              <div className="flex flex-col gap-1.5 w-full flex-1 min-h-0 overflow-y-auto">
                {feesLoading ? (
                  <p className="font-body text-sm text-neutral-500 text-center py-4">Loading…</p>
                ) : sortedFees.length === 0 ? (
                  <p className="font-body text-sm text-neutral-500 text-center py-4">
                    No fees yet — booking here is free.
                  </p>
                ) : sortedFees.map(f => (
                  <BookingFeeItem
                    key={f.id}
                    fee={f}
                    timeslots={timeslots}
                    hasDefault={hasDefaultFee}
                    onEdit={() => openEditFee(f)}
                    onChanged={refetchFees}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                color="primary"
                className="w-full justify-center shrink-0"
                onClick={openAddFee}
              >
                {hasDefaultFee ? 'Add Fee' : 'Set Booking Fee'}
              </Button>

            </div>
          </div>

          {/* Staff column. Reaching this page at all means you're a venue
              admin, and the RLS on location_staff enforces the same thing. */}
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-px shrink-0 snap-start snap-always w-[90vw] max-w-[90vw] md:w-[40vw] md:max-w-[40vw] lg:w-auto lg:flex-1 lg:max-w-sm flex flex-col min-h-0 shadow-md overflow-hidden">
            <div className="flex flex-col gap-4 items-center p-5 flex-1 min-h-0">

              <StaffIcon />

              <h2 className="font-heading text-xl text-white">Staff</h2>

              <p className="font-body text-base text-neutral-300 text-center">
                People who can see bookings at {selectedStore?.name ?? 'your venue'}, without
                being able to change its settings.
              </p>

              <div className="flex flex-col gap-1.5 w-full flex-1 min-h-0 overflow-y-auto">
                {staffLoading ? (
                  <p className="font-body text-sm text-neutral-500 text-center py-4">Loading…</p>
                ) : staff.length === 0 ? (
                  <p className="font-body text-sm text-neutral-500 text-center py-4">
                    No staff yet — only venue admins can see your bookings.
                  </p>
                ) : staff.map(m => (
                  <StaffItem
                    key={m.userId}
                    member={m}
                    locationId={selectedId}
                    locationName={selectedStore?.name ?? 'this venue'}
                    onChanged={refetchStaff}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                color="primary"
                className="w-full justify-center shrink-0"
                onClick={() => setStaffModalOpen(true)}
              >
                Add Staff Member
              </Button>

            </div>
          </div>

        </div>
      </main>

      <AppFooter className="shrink-0" appName="BattlePlan" version={__APP_VERSION__} buildDate={__APP_BUILD_DATE__} />

      <BlockNewDateModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        locations={adminLocations}
        tables={tables}
        defaultLocationId={selectedId}
        onSaved={() => { setAddOpen(false); refetch(); }}
      />

      <TableFormModal
        open={tableModalOpen}
        onClose={() => setTableModalOpen(false)}
        locationId={selectedId}
        timeslots={timeslots}
        allTables={tables}
        editing={editingTable}
        defaultName={`Table ${tables.length + 1}`}
        onSaved={() => { setTableModalOpen(false); refetchTables(); }}
      />

      <TimeslotFormModal
        open={timeslotModalOpen}
        onClose={() => setTimeslotModalOpen(false)}
        locationId={selectedId}
        editing={editingTimeslot}
        onSaved={() => { setTimeslotModalOpen(false); refetchTimeslots(); }}
      />

      <BookingFeeFormModal
        open={feeModalOpen}
        onClose={() => setFeeModalOpen(false)}
        locationId={selectedId}
        timeslots={timeslots}
        fees={fees}
        editing={editingFee}
        onSaved={() => { setFeeModalOpen(false); refetchFees(); }}
      />

      <AddStaffModal
        open={staffModalOpen}
        onClose={() => setStaffModalOpen(false)}
        locationId={selectedId}
        locationName={selectedStore?.name ?? 'this venue'}
        existingIds={staff.map(m => m.userId)}
        adminIds={venueAdminIds}
        onSaved={() => { setStaffModalOpen(false); refetchStaff(); }}
      />

    </div>
  );
}
