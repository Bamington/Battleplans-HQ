import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, AppFooter, Button } from '@battleplans/ui';
import AppNavbar from '../components/AppNavbar';
import {
  useAdminLocations, useBlockedDates, useStoreTables, useLocationTimeslots, useBookingsByDate,
  formatDateLabel, formatBookingTime,
} from '../hooks/useBookingData';
import type { StoreTable } from '../hooks/useBookingData';
import { BlockedDateItem, BlockNewDateModal } from '../components/BlockedDates';
import { StoreTableItem, TableFormModal } from '../components/StoreTables';
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

  const { adminLocations, loading } = useAdminLocations(userId ?? null);
  const [selectedId, setSelectedId] = useState('');
  const [addOpen,    setAddOpen]    = useState(false);

  // Default the selection to the first store once locations load.
  useEffect(() => {
    if (adminLocations.length > 0 && !adminLocations.some(l => l.id === selectedId)) {
      setSelectedId(adminLocations[0].id);
    }
  }, [adminLocations, selectedId]);

  // Only store admins may see this page — send everyone else home.
  useEffect(() => {
    if (userId === undefined) return;            // still resolving the session
    if (userId === null) { navigate('/app', { replace: true }); return; }
    if (!loading && adminLocations.length === 0) navigate('/app', { replace: true });
  }, [userId, loading, adminLocations, navigate]);

  const selectedStore = adminLocations.find(l => l.id === selectedId);
  const { blockedDates, loading: bdLoading, refetch } = useBlockedDates(selectedId ? [selectedId] : []);

  const { timeslots }                                          = useLocationTimeslots(selectedId || null);
  const { tables, loading: tablesLoading, refetch: refetchTables } = useStoreTables(selectedId || null);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [editingTable,   setEditingTable]   = useState<StoreTable | null>(null);

  const openAddTable  = () => { setEditingTable(null); setTableModalOpen(true); };
  const openEditTable = (t: StoreTable) => { setEditingTable(t); setTableModalOpen(true); };

  // Bookings by date — defaults to today (local), any date pickable.
  const [bookingsDate, setBookingsDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const { bookings: dateBookings, loading: dateBookingsLoading, refetch: refetchDateBookings } =
    useBookingsByDate(selectedId || null, bookingsDate);

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">

      <AppNavbar fixed={false} logo={<BattlePlanLogo />}>
        {selectedStore && (
          <StoreSelector locations={adminLocations} selectedId={selectedId} onSelect={setSelectedId} />
        )}
      </AppNavbar>

      <main className="flex flex-1 items-stretch pt-3 md:pt-9 lg:px-9 w-full">
        <div className="flex flex-1 items-stretch gap-2.5 overflow-x-auto snap-x snap-mandatory lg:overflow-x-visible lg:snap-none lg:justify-center px-3 md:px-9 py-2 scroll-px-3 md:scroll-px-9 lg:p-0">

          {/* Blocked Dates column */}
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-px shrink-0 snap-start snap-always w-[90vw] max-w-[90vw] md:w-[40vw] md:max-w-[40vw] lg:w-auto lg:flex-1 lg:max-w-sm flex flex-col shadow-md overflow-hidden">
            <div className="flex flex-col gap-4 items-center p-5 flex-1">

              <CalendarIcon />

              <h2 className="font-heading text-xl text-white">Blocked Dates</h2>

              <p className="font-body text-base text-neutral-300 text-center">
                Dates when tables can't be booked at {selectedStore?.name ?? 'your venue'}.
              </p>

              <div className="flex flex-col gap-1.5 w-full flex-1">
                {bdLoading ? (
                  <p className="font-body text-sm text-neutral-500 text-center py-4">Loading…</p>
                ) : blockedDates.length === 0 ? (
                  <p className="font-body text-sm text-neutral-500 text-center py-4">No blocked dates yet.</p>
                ) : blockedDates.map(bd => (
                  <BlockedDateItem
                    key={bd.id}
                    blocked={bd}
                    locations={adminLocations}
                    onChanged={refetch}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                color="primary"
                className="w-full justify-center"
                onClick={() => setAddOpen(true)}
              >
                Add New Block
              </Button>

            </div>
          </div>

          {/* Tables column */}
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-px shrink-0 snap-start snap-always w-[90vw] max-w-[90vw] md:w-[40vw] md:max-w-[40vw] lg:w-auto lg:flex-1 lg:max-w-sm flex flex-col shadow-md overflow-hidden">
            <div className="flex flex-col gap-4 items-center p-5 flex-1">

              <TablesIcon />

              <h2 className="font-heading text-xl text-white">Tables</h2>

              <p className="font-body text-base text-neutral-300 text-center">
                The tables players can book at {selectedStore?.name ?? 'your venue'}.
              </p>

              <div className="flex flex-col gap-1.5 w-full flex-1">
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
                className="w-full justify-center"
                onClick={openAddTable}
              >
                Add Table
              </Button>

            </div>
          </div>

          {/* Bookings by Date column */}
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-px shrink-0 snap-start snap-always w-[90vw] max-w-[90vw] md:w-[40vw] md:max-w-[40vw] lg:w-auto lg:flex-1 lg:max-w-sm flex flex-col shadow-md overflow-hidden">
            <div className="flex flex-col gap-4 items-center p-5 flex-1">

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

              <div className="flex flex-col gap-1.5 w-full flex-1">
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

        </div>
      </main>

      <AppFooter appName="BattlePlan" version={__APP_VERSION__} buildDate={__APP_BUILD_DATE__} />

      <BlockNewDateModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        locations={adminLocations}
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

    </div>
  );
}
