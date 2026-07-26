/**
 * ComponentGallery.tsx — BattlePlan Component Gallery
 *
 * A living reference for every UI component in the app.
 * This page is a development tool only — not a screen users will see.
 *
 * HOW IT IS PUT TOGETHER:
 * The chrome (<GalleryShell>) and every demo for a shared @battleplans/ui
 * component (<SharedGallerySections>) live in packages/ui, so all three apps
 * show the same thing. This file only holds the sections for components that
 * live in apps/battleplan/src/components.
 *
 * ADDING A COMPONENT: when you create a component in this app, add a
 * <GallerySection> for it below showing every meaningful variant and state, and
 * add a matching entry to LOCAL_NAV. If the component belongs in packages/ui
 * instead, add its demo to packages/ui/src/gallery/SharedSections.tsx.
 *
 * A NOTE ON STUBBED DATA: most of these components own their writes — they call
 * Supabase directly from an action handler and then ask the parent to refetch.
 * The demos below hand them literal rows so they render truthfully, but a save
 * or delete will fail without a session. Each section says so where it matters.
 *
 * Navigate to this page at: http://localhost:5173/gallery
 */

import { useState } from 'react';
import {
  GalleryShell,
  GallerySection,
  GalleryNote,
  SharedGallerySections,
  SHARED_GALLERY_NAV,
  Button,
  type GalleryNavItem,
} from '@battleplans/ui';
import { Widget2, Gallery, ListCheck, Shield, Bookmark, UsersGroupRounded, Home, Clipboard } from '@battleplans/ui';

import AppNavbar from '../components/AppNavbar';
import { BattleItem, BattleCardBody } from '../components/BattleItem';
import { BattleGridItem } from '../components/BattleGridItem';
import { BattleDetailsModal } from '../components/BattleDetailsModal';
import { BlockedDateItem, BlockNewDateModal } from '../components/BlockedDates';
import { BookingDetailModal, BookingInvitationModal } from '../components/BookingDetailModal';
import { BookingItem } from '../components/BookingItem';
import DatePickerInput from '../components/DatePickerInput';
import { OpponentPicker } from '../components/OpponentPicker';
import { StoreSelector, StoreIcon } from '../components/StoreSelector';
import { StoreTableItem, TableFormModal } from '../components/StoreTables';
import { TimeslotItem, TimeslotFormModal } from '../components/Timeslots';
import type { Battle } from '../hooks/useBattles';
import type { Booking, Location, LocationTimeslot, StoreTable, BlockedDate } from '../hooks/useBookingData';
import type { Opponent, SelectedOpponent } from '../hooks/useOpponents';
import type { IncomingBookingShare } from '@battleplans/ui';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — path contains spaces, TS path resolver struggles but Vite handles fine
import iconBloodBowl from '../../../../packages/ui/src/assets/games/icons/blood-bowl.png';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import iconHalo from '../../../../packages/ui/src/assets/games/icons/halo.png';

// ── Demo data ────────────────────────────────────────────────────────────────

const DEMO_LOCATIONS: Location[] = [
  { id: 'loc-1', name: 'Battleground North', icon: '' },
  { id: 'loc-2', name: 'Battleground South', icon: '' },
];

const DEMO_TIMESLOTS: LocationTimeslot[] = [
  { id: 'ts-1', name: 'Morning',   start_time: '10:00', end_time: '13:00', availability: ['Saturday', 'Sunday'] },
  { id: 'ts-2', name: 'Afternoon', start_time: '13:00', end_time: '17:00', availability: ['Saturday', 'Sunday'] },
  { id: 'ts-3', name: 'Evening',   start_time: '18:00', end_time: '22:00', availability: ['Tuesday', 'Wednesday', 'Thursday'] },
];

const DEMO_TABLES: StoreTable[] = [
  { id: 'tb-1', name: 'Table 1', size: 'wargaming', enabled: true,  timeslotIds: ['ts-1', 'ts-2'] },
  { id: 'tb-2', name: 'Table 2', size: 'tcg',       enabled: false, timeslotIds: ['ts-3'] },
];

const DEMO_BLOCKED: BlockedDate = {
  id: 'bd-1',
  date: '2026-08-15',
  description: 'Store closed for a tournament',
  blocked_tables: null,
  location: { id: 'loc-1', name: 'Battleground North', icon: '' },
};

const DEMO_BOOKING: Booking = {
  id: 'bk-1',
  date: '2026-08-01',
  user_name: 'Chris Harrison',
  game:     { id: 'g-1', name: 'Blood Bowl', slug: 'blood-bowl' },
  location: { id: 'loc-1', name: 'Battleground North', address: '12 Guild Street, Sheffield' },
  timeslot: { id: 'ts-2', name: 'Afternoon', start_time: '13:00', end_time: '17:00' },
};

const DEMO_BATTLE: Battle = {
  id: 1,
  date_played: '2026-07-18',
  opp_name: 'Marcus',
  result: 'won',
  location_name: 'Battleground North',
  location_id: 'loc-1',
  battle_notes: '**Turn 3** was the swing — a blitz off the line of scrimmage opened the cage and the ball never came back.',
  game: { id: 'g-1', name: 'Blood Bowl', slug: 'blood-bowl' },
  opponents: [{ id: 'op-1', name: 'Marcus' }],
  photos: [],
  photoUrl: null,
};

const DEMO_SHARE: IncomingBookingShare = {
  shareId: 'sh-1',
  status: 'pending',
  createdAt: '2026-07-24T09:00:00.000Z',
  respondedAt: null,
  bookingId: 'bk-1',
  date: '2026-08-01',
  locationId: 'loc-1',
  locationName: 'Battleground North',
  locationAddress: '12 Guild Street, Sheffield',
  timeslotName: 'Afternoon',
  timeslotStart: '13:00',
  timeslotEnd: '17:00',
  gameId: 'g-1',
  gameName: 'Blood Bowl',
  gameSlug: 'blood-bowl',
  // Public identity only — a sharer's real name is never exposed here.
  sharer: { id: 'u-1', handle: 'bamington', avatarUrl: null },
};

const DEMO_OPPONENTS: Opponent[] = [
  { id: 'op-1', name: 'Marcus' },
  { id: 'op-2', name: 'Priya' },
  { id: 'op-3', name: 'Sam' },
];

// ── Local nav ────────────────────────────────────────────────────────────────

/** Sidebar entries for this app's own sections, appended after the shared ones. */
const LOCAL_NAV: GalleryNavItem[] = [
  { href: '#nav-navbar',            label: 'Navbar',             icon: <Widget2 className="w-5 h-5" /> },
  { href: '#nav-battle-item',       label: 'Battle Item',        icon: <Shield className="w-5 h-5" /> },
  { href: '#nav-battle-grid-item',  label: 'Battle Grid Item',   icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-battle-details',    label: 'Battle Details',     icon: <Bookmark className="w-5 h-5" /> },
  { href: '#nav-booking-item',      label: 'Booking Item',       icon: <ListCheck className="w-5 h-5" /> },
  { href: '#nav-booking-detail',    label: 'Booking Detail',     icon: <Bookmark className="w-5 h-5" /> },
  { href: '#nav-booking-invite',    label: 'Booking Invitation', icon: <UsersGroupRounded className="w-5 h-5" /> },
  { href: '#nav-date-picker',       label: 'Date Picker Input',  icon: <Clipboard className="w-5 h-5" /> },
  { href: '#nav-opponent-picker',   label: 'Opponent Picker',    icon: <UsersGroupRounded className="w-5 h-5" /> },
  { href: '#nav-store-selector',    label: 'Store Selector',     icon: <Home className="w-5 h-5" /> },
  { href: '#nav-timeslots',         label: 'Timeslots',          icon: <ListCheck className="w-5 h-5" /> },
  { href: '#nav-store-tables',      label: 'Store Tables',       icon: <ListCheck className="w-5 h-5" /> },
  { href: '#nav-blocked-dates',     label: 'Blocked Dates',      icon: <Clipboard className="w-5 h-5" /> },
];

// ── Gallery page ─────────────────────────────────────────────────────────────

const ComponentGallery = () => {
  const [battleOpen,     setBattleOpen]     = useState(false);
  const [bookingOpen,    setBookingOpen]    = useState(false);
  const [bookingMode,    setBookingMode]    = useState<'owner' | 'store'>('owner');
  const [inviteOpen,     setInviteOpen]     = useState(false);
  const [blockOpen,      setBlockOpen]      = useState(false);
  const [tableOpen,      setTableOpen]      = useState(false);
  const [timeslotOpen,   setTimeslotOpen]   = useState(false);
  const [date,           setDate]           = useState('2026-08-01');
  const [opponents,      setOpponents]      = useState<SelectedOpponent[]>([{ id: 'op-1', name: 'Marcus' }]);
  const [selectedStore,  setSelectedStore]  = useState('loc-1');
  const [emptyStore,     setEmptyStore]     = useState('');

  return (
    <GalleryShell appName="BattlePlan" nav={[...SHARED_GALLERY_NAV, ...LOCAL_NAV]} backTo="/app">

      {/* Every @battleplans/ui component — see packages/ui/src/gallery/SharedSections.tsx */}
      <SharedGallerySections />

      {/* ════════════════════════════════════════════════════════════════
          Everything below is a BattlePlan-only component.
      ════════════════════════════════════════════════════════════════ */}

      {/* ════════════════════════════════════════════════════════════════
          NAVBAR
          Thin wrapper over the shared <Navbar> that supplies BattlePlan's
          breadcrumb trail. Fixed in production; bounded here.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-navbar" title="Navbar / Default">
        <div className="w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <AppNavbar fixed={false} />
          <div className="h-24 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
            <p className="font-body text-sm text-gray-400">Page content sits beneath the navbar</p>
          </div>
        </div>
        <GalleryNote>
          The breadcrumb trail is derived from the current route, so in the gallery
          it shows the trail for /gallery — i.e. none. The platform switcher loads
          the apps this user may access from the database.
        </GalleryNote>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          BATTLE ITEM
          A logged battle in the home-screen list. BattleCardBody is the
          shared inner layout, reused by the grid variant.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-battle-item" title="Battle Item / Results">
        <div className="w-full max-w-xl flex flex-col gap-2">
          <BattleItem
            gameIcon={iconBloodBowl}
            gameName="Blood Bowl"
            oppName="Marcus"
            datePlayed="2026-07-18"
            locationName="Battleground North"
            result="won"
            onClick={() => alert('Open battle')}
          />
          <BattleItem
            gameIcon={iconHalo}
            gameName="Halo: Flashpoint"
            oppName="Priya"
            datePlayed="2026-07-11"
            locationName="Battleground South"
            result="lost"
            onClick={() => alert('Open battle')}
          />
          <BattleItem
            gameName="Kill Team"
            oppName="Sam"
            datePlayed="2026-07-04"
            locationName={null}
            result="drew"
          />
        </div>
        <GalleryNote>
          Result drives the label and colour (victory / defeat / draw). The third
          row has no game icon and no venue — the common case, since most battles
          aren't played at one of our venues. Without <code>onClick</code> the row
          is not interactive.
        </GalleryNote>
      </GallerySection>

      <GallerySection title="Battle Item / With Photo & Card Body">
        <div className="w-full flex flex-wrap gap-6 items-start">
          <div className="w-full max-w-xl">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">
              With a background photo
            </p>
            <BattleItem
              gameIcon={iconBloodBowl}
              gameName="Blood Bowl"
              oppName="Marcus"
              datePlayed="2026-07-18"
              locationName="Battleground North"
              result="won"
              photoUrl="https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800"
              onClick={() => alert('Open battle')}
            />
          </div>
          <div className="w-full max-w-xl rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">
              BattleCardBody on its own — the shared inner layout
            </p>
            <BattleCardBody
              gameIcon={iconHalo}
              gameName="Halo: Flashpoint"
              oppName="Priya"
              datePlayed="2026-07-11"
              locationName="Battleground South"
              result="lost"
            />
          </div>
        </div>
        <GalleryNote>
          BattleCardBody is exported so the list row and the grid tile can share one
          layout; you rarely mount it directly.
        </GalleryNote>
      </GallerySection>

      <GallerySection id="nav-battle-grid-item" title="Battle Grid Item">
        <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl">
          <BattleGridItem
            gameIcon={iconBloodBowl}
            gameName="Blood Bowl"
            oppName="Marcus"
            datePlayed="2026-07-18"
            locationName="Battleground North"
            result="won"
            photoUrl="https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800"
            onClick={() => alert('Open battle')}
          />
          <BattleGridItem
            gameIcon={iconHalo}
            gameName="Halo: Flashpoint"
            oppName="Priya"
            datePlayed="2026-07-11"
            locationName="Battleground South"
            result="lost"
            onClick={() => alert('Open battle')}
          />
          <BattleGridItem
            gameName="Kill Team"
            oppName="Sam"
            datePlayed="2026-07-04"
            locationName={null}
            result="drew"
          />
        </div>
        <GalleryNote>
          The gallery-view tile for the My Battles column. Same fields as
          BattleItem; the photo becomes the tile background, and the middle tile
          shows the no-photo fallback.
        </GalleryNote>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          BATTLE DETAILS MODAL
          Read + edit a logged battle, including its photo carousel.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-battle-details" title="Battle Details Modal">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setBattleOpen(true)}>Open Battle Details</Button>
          <GalleryNote>
            Driven by a literal battle row, so the read view is fully truthful —
            including the markdown notes. Editing, deleting and photo upload all
            write to Supabase, so they need a signed-in session; this demo's battle
            id does not exist, so saves will fail.
          </GalleryNote>
          <BattleDetailsModal
            battle={DEMO_BATTLE}
            open={battleOpen}
            onClose={() => setBattleOpen(false)}
            onChanged={() => {}}
            userId={null}
          />
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          BOOKING ITEM
          A booking row. The 'store' variant shows the customer's name,
          which the 'user' variant deliberately does not.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-booking-item" title="Booking Item / User & Store">
        <div className="w-full max-w-xl flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              variant="user" — your own booking
            </p>
            <BookingItem
              bookingId="bk-1"
              gameIcon={iconBloodBowl}
              gameName="Blood Bowl"
              location="Battleground North"
              date="2026-08-01"
              time="13:00 – 17:00"
              onClick={() => alert('Open booking')}
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              variant="store" — the venue's view, with the customer's name
            </p>
            <BookingItem
              bookingId="bk-2"
              gameIcon={iconHalo}
              gameName="Halo: Flashpoint"
              location="Battleground South"
              date="2026-08-02"
              time="18:00 – 22:00"
              customerName="Chris Harrison"
              variant="store"
              onClick={() => alert('Open booking')}
            />
          </div>
        </div>
        <GalleryNote>
          <code>customerName</code> is free text a customer typed at booking time —
          it is not an identity, and the store variant is the only place it
          surfaces. Deleting calls Supabase and then fires{' '}
          <code>onDeleted</code>; it will fail here.
        </GalleryNote>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          BOOKING DETAIL & INVITATION MODALS
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-booking-detail" title="Booking Detail Modal">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => { setBookingMode('owner'); setBookingOpen(true); }}>
            Owner view
          </Button>
          <Button variant="outline" color="secondary" onClick={() => { setBookingMode('store'); setBookingOpen(true); }}>
            Store view
          </Button>
          <GalleryNote>
            The owner view can share the booking with a friend and cancel it; the
            store view shows the customer instead. The sharing panel reads and
            writes booking_shares, so it needs a session — signed out you get its
            empty state.
          </GalleryNote>
          <BookingDetailModal
            open={bookingOpen}
            onClose={() => setBookingOpen(false)}
            booking={DEMO_BOOKING}
            mode={bookingMode}
            customerName={bookingMode === 'store' ? 'Chris Harrison' : undefined}
            onCancelled={() => setBookingOpen(false)}
          />
        </div>
      </GallerySection>

      <GallerySection id="nav-booking-invite" title="Booking Invitation Modal">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setInviteOpen(true)}>Open Invitation</Button>
          <GalleryNote>
            Shown when a friend shares a booking with you — accept and it appears in
            your own bookings list. Driven by a literal share row here, so accept and
            decline are fully clickable; they just close the modal instead of
            writing. Note the sharer is public identity only — @handle and avatar,
            never their real name.
          </GalleryNote>
          <BookingInvitationModal
            open={inviteOpen}
            onClose={() => setInviteOpen(false)}
            share={DEMO_SHARE}
            busy={false}
            onRespond={() => setInviteOpen(false)}
          />
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          FORM CONTROLS
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-date-picker" title="Date Picker Input">
        <div className="w-full flex flex-wrap gap-6 items-start">
          <div className="w-64">
            <DatePickerInput label="Date" value={date} onChange={setDate} />
          </div>
          <div className="w-64">
            <DatePickerInput label="Date (no past dates)" value={date} min="2026-07-26" onChange={setDate} />
          </div>
          <GalleryNote>
            Selected: {date}. <code>min</code> is how the booking flow stops you
            picking a date that has already passed.
          </GalleryNote>
        </div>
      </GallerySection>

      <GallerySection id="nav-opponent-picker" title="Opponent Picker">
        <div className="w-full max-w-md flex flex-col gap-3">
          <OpponentPicker
            value={opponents}
            onChange={setOpponents}
            options={DEMO_OPPONENTS}
          />
          <GalleryNote>
            Picked: {opponents.length ? opponents.map(o => o.name).join(', ') : '(none)'}.
            Typing a name that isn't in the roster offers to create it — those come
            back with <code>id: null</code> and are created when the battle saves.
          </GalleryNote>
        </div>
      </GallerySection>

      <GallerySection id="nav-store-selector" title="Store Selector">
        <div className="w-full flex flex-wrap gap-8 items-start">
          <div className="w-72">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">Default</p>
            <StoreSelector
              locations={DEMO_LOCATIONS}
              selectedId={selectedStore}
              onSelect={setSelectedStore}
            />
          </div>
          <div className="w-72">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">
              With an empty option and a header
            </p>
            <StoreSelector
              locations={DEMO_LOCATIONS}
              selectedId={emptyStore}
              onSelect={setEmptyStore}
              emptyOption
              emptyLabel="All venues"
              headerLabel="Venue"
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              StoreIcon — the per-venue badge, used inside the selector
            </p>
            <div className="flex gap-3">
              {DEMO_LOCATIONS.map(l => <StoreIcon key={l.id} location={l} />)}
            </div>
          </div>
          <GalleryNote>
            Selected: {selectedStore || '(none)'}. The demo venues carry no icon, so
            StoreIcon shows its initials fallback.
          </GalleryNote>
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          MANAGE STORE
          The venue-management rows and their edit modals. All three write
          to Supabase on save and then call onChanged/onSaved to refetch.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-timeslots" title="Timeslots">
        <div className="w-full max-w-2xl flex flex-col gap-2">
          {DEMO_TIMESLOTS.map(ts => (
            <TimeslotItem key={ts.id} timeslot={ts} onEdit={() => setTimeslotOpen(true)} onChanged={() => {}} />
          ))}
          <div className="mt-2">
            <Button onClick={() => setTimeslotOpen(true)}>Open Timeslot Form</Button>
          </div>
          <GalleryNote>
            A slot's availability is the set of full day names it runs on — the third
            row here is a weekday-evening slot. Saving and deleting write to
            Supabase, so they need a session.
          </GalleryNote>
          <TimeslotFormModal
            open={timeslotOpen}
            onClose={() => setTimeslotOpen(false)}
            locationId="loc-1"
            onSaved={() => setTimeslotOpen(false)}
          />
        </div>
      </GallerySection>

      <GallerySection id="nav-store-tables" title="Store Tables">
        <div className="w-full max-w-2xl flex flex-col gap-2">
          {DEMO_TABLES.map(t => (
            <StoreTableItem
              key={t.id}
              table={t}
              allTables={DEMO_TABLES}
              timeslots={DEMO_TIMESLOTS}
              locationId="loc-1"
              onEdit={() => setTableOpen(true)}
              onChanged={() => {}}
            />
          ))}
          <div className="mt-2">
            <Button onClick={() => setTableOpen(true)}>Open Table Form</Button>
          </div>
          <GalleryNote>
            Two sizes (Wargaming / TCG) and an enabled flag — the second table is
            disabled, which is how a venue takes a table out of service without
            losing its history. Disabling a table that already has bookings prompts
            about the slots it would impact.
          </GalleryNote>
          <TableFormModal
            open={tableOpen}
            onClose={() => setTableOpen(false)}
            locationId="loc-1"
            timeslots={DEMO_TIMESLOTS}
            allTables={DEMO_TABLES}
            onSaved={() => setTableOpen(false)}
          />
        </div>
      </GallerySection>

      <GallerySection id="nav-blocked-dates" title="Blocked Dates">
        <div className="w-full max-w-2xl flex flex-col gap-2">
          <BlockedDateItem blocked={DEMO_BLOCKED} locations={DEMO_LOCATIONS} onChanged={() => {}} />
          <BlockedDateItem
            blocked={{ ...DEMO_BLOCKED, id: 'bd-2', description: null, blocked_tables: 2 }}
            locations={DEMO_LOCATIONS}
            onChanged={() => {}}
          />
          <div className="mt-2">
            <Button onClick={() => setBlockOpen(true)}>Open Block Date Form</Button>
          </div>
          <GalleryNote>
            A null <code>blocked_tables</code> blocks the whole venue for that date
            (the first row); a number blocks only that many tables (the second).
          </GalleryNote>
          <BlockNewDateModal
            open={blockOpen}
            onClose={() => setBlockOpen(false)}
            locations={DEMO_LOCATIONS}
            defaultLocationId="loc-1"
            onSaved={() => setBlockOpen(false)}
          />
        </div>
      </GallerySection>

    </GalleryShell>
  );
};

export default ComponentGallery;
