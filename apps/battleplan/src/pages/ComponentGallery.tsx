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
import { BookingFeeItem, BookingFeeFormModal } from '../components/BookingFees';
import { StaffItem, AddStaffModal } from '../components/LocationStaff';
import { PersonItem, AddMemberModal } from '../components/ClubMembers';
import type { Battle } from '../hooks/useBattles';
import type { Booking, Location, LocationTimeslot, StoreTable, BlockedDate, BookingFee, StaffMember, ClubPerson } from '../hooks/useBookingData';
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
  { id: 'ts-1', name: 'Morning',   start_time: '10:00', end_time: '13:00', availability: ['Saturday', 'Sunday'], interval_weeks: 1, anchor_date: null, audience: 'anyone' },
  { id: 'ts-2', name: 'Afternoon', start_time: '13:00', end_time: '17:00', availability: ['Saturday', 'Sunday'], interval_weeks: 1, anchor_date: null, audience: 'anyone' },
  { id: 'ts-3', name: 'Evening',   start_time: '18:00', end_time: '22:00', availability: ['Tuesday', 'Wednesday', 'Thursday'], interval_weeks: 1, anchor_date: null, audience: 'anyone' },
  // A club night rather than a shop's opening hours — the one row that shows
  // the repeat line, which only appears when a slot isn't weekly, and the one
  // that is members only, which is the only other line a row can grow.
  { id: 'ts-4', name: 'Club Night', start_time: '18:00', end_time: '22:00', availability: ['Friday'], interval_weeks: 2, anchor_date: '2026-08-21', audience: 'members' },
];

const DEMO_TABLES: StoreTable[] = [
  { id: 'tb-1', name: 'Table 1', label: 'Wargaming', notes: null, enabled: true,  timeslotIds: ['ts-1', 'ts-2'] },
  { id: 'tb-2', name: 'Table 2', label: 'TCG',       notes: 'No power socket on this side', enabled: false, timeslotIds: ['ts-3'] },
  // No label at all — the chip is absent rather than defaulted, which is the
  // whole point of the field being free text.
  { id: 'tb-3', name: 'Table 3', label: null,        notes: null, enabled: true,  timeslotIds: ['ts-1'] },
];

const DEMO_FEES: BookingFee[] = [
  { id: 'fee-1', scope: 'default',  day_of_week: null,     timeslot_id: null,
    amount_cents: 1000,
    message: 'Table booking at this store is $10 for 3 hours. If there is no other reservation, you can keep your table longer at no additional cost.' },
  { id: 'fee-2', scope: 'day',      day_of_week: 'Saturday', timeslot_id: null,
    amount_cents: 1500, message: 'Saturdays are busy — $15 holds your table for the full session.' },
  { id: 'fee-3', scope: 'timeslot', day_of_week: null,     timeslot_id: 'ts-1',
    amount_cents: 500,
    message: 'Morning tables are $5 for the three-hour slot. Pay at the counter when you arrive.' },
];

const DEMO_STAFF: StaffMember[] = [
  { userId: 'u-1', handle: 'marcus-w', username: 'Marcus Webb', avatarPath: null, createdAt: null, role: 'staff' },
  // No real name set — the row falls back to the @handle, with no duplicate
  // line beneath it.
  { userId: 'u-2', handle: 'priya-n',  username: null,          avatarPath: null, createdAt: null, role: 'staff' },
  // An organiser: runs events here, and cannot see the venue's bookings. The
  // role line is the only thing distinguishing them at a glance.
  { userId: 'u-3', handle: 'jo-tanaka', username: 'Jo Tanaka',  avatarPath: null, createdAt: null, role: 'organiser' },
];

/**
 * A club's whole roster, strongest role first — which is the order the
 * `club_people` RPC returns and the reason the list needs no grouping.
 */
const DEMO_PEOPLE: ClubPerson[] = [
  // The viewer. Marked "(you)", and with no remove menu.
  { userId: 'p-1', handle: 'bamington', username: 'Bam Harrison', avatarPath: null, role: 'admin' },
  { userId: 'p-2', handle: 'jo-tanaka', username: 'Jo Tanaka',    avatarPath: null, role: 'organiser' },
  { userId: 'p-3', handle: 'marcus-w',  username: 'Marcus Webb',  avatarPath: null, role: 'member' },
  // No display name — falls back to the @handle, with no duplicate line under it.
  { userId: 'p-4', handle: 'priya-n',   username: null,           avatarPath: null, role: 'member' },
];

const DEMO_BLOCKED: BlockedDate = {
  id: 'bd-1',
  date: '2026-08-15',
  description: 'Store closed for a tournament',
  blocked_tables: null,
  recurrence: 'none',
  interval_weeks: 1,
  days_of_week: [],
  until_date: null,
  table_scope: 'all',
  tableIds: [],
  location: { id: 'loc-1', name: 'Battleground North', icon: '' },
};

/** A repeating rule naming the tables it covers: every second Friday, until year end. */
const DEMO_BLOCKED_RECURRING: BlockedDate = {
  id: 'bd-3',
  date: '2026-08-07',
  description: 'Regular club night',
  blocked_tables: 2,           // legacy mirror of tableIds.length
  recurrence: 'weekly',
  interval_weeks: 2,
  days_of_week: ['Friday'],
  until_date: '2026-12-31',
  table_scope: 'selected',
  tableIds: ['tb-1', 'tb-2'],
  location: { id: 'loc-1', name: 'Battleground North', icon: '' },
};

const DEMO_BOOKING: Booking = {
  id: 'bk-1',
  date: '2026-08-01',
  user_name: 'Chris Harrison',
  user_id: 'u-1',
  // Booked by whoever owns it, so the store view reads "Booked by Chris
  // Harrison". Set created_by_user_id to a DIFFERENT id to see the counter
  // variant, "Booked by {staff} on behalf of Chris Harrison".
  created_by_user_id: 'u-1',
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
  { href: '#nav-booking-fees',      label: 'Booking Fees',       icon: <ListCheck className="w-5 h-5" /> },
  { href: '#nav-location-staff',    label: 'Location Staff',     icon: <UsersGroupRounded className="w-5 h-5" /> },
  { href: '#nav-club-people',       label: 'Club People',        icon: <UsersGroupRounded className="w-5 h-5" /> },
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
  const [feeOpen,        setFeeOpen]        = useState(false);
  const [staffOpen,      setStaffOpen]      = useState(false);
  const [peopleOpen,     setPeopleOpen]     = useState(false);
  const [date,           setDate]           = useState('2026-08-01');
  const [opponents,      setOpponents]      = useState<SelectedOpponent[]>([{ id: 'op-1', name: 'Marcus' }]);
  const [selectedStore,  setSelectedStore]  = useState('loc-1');
  const [emptyStore,     setEmptyStore]     = useState('');

  return (
    <GalleryShell appName="BattlePlan" nav={[...SHARED_GALLERY_NAV, ...LOCAL_NAV]} backTo="/app">

      {/* Every @battleplans/ui component — see packages/ui/src/gallery/SharedSections.tsx */}
      <SharedGallerySections appName="BattlePlan" />

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
          <BlockedDateItem
            blocked={DEMO_BLOCKED}
            locations={DEMO_LOCATIONS}
            tables={DEMO_TABLES}
            onChanged={() => {}}
          />
          <BlockedDateItem
            blocked={{
              ...DEMO_BLOCKED, id: 'bd-2', description: null,
              table_scope: 'selected', tableIds: ['tb-2'], blocked_tables: 1,
            }}
            locations={DEMO_LOCATIONS}
            tables={DEMO_TABLES}
            onChanged={() => {}}
          />
          <BlockedDateItem
            blocked={DEMO_BLOCKED_RECURRING}
            locations={DEMO_LOCATIONS}
            tables={DEMO_TABLES}
            onChanged={() => {}}
          />
          <div className="mt-2">
            <Button onClick={() => setBlockOpen(true)}>Open Block Date Form</Button>
          </div>
          <GalleryNote>
            <code>table_scope: 'all'</code> shuts the venue, covering tables added
            later (first row); <code>'selected'</code> names the tables it covers
            (second and third), so a block only reduces capacity in the timeslots
            those tables actually serve. The third also repeats — a rule, not
            expanded rows, so editing it moves every future occurrence. Intervals
            count in whole weeks from the start date's week, so "every 2nd Friday"
            stays on the same Fridays whatever day it was created.
          </GalleryNote>
          <BlockNewDateModal
            open={blockOpen}
            onClose={() => setBlockOpen(false)}
            locations={DEMO_LOCATIONS}
            tables={DEMO_TABLES}
            defaultLocationId="loc-1"
            onSaved={() => setBlockOpen(false)}
          />
        </div>
      </GallerySection>

      <GallerySection id="nav-booking-fees" title="Booking Fees">
        <div className="w-full max-w-2xl flex flex-col gap-2">
          {DEMO_FEES.map(f => (
            <BookingFeeItem
              key={f.id}
              fee={f}
              timeslots={DEMO_TIMESLOTS}
              hasDefault
              onEdit={() => setFeeOpen(true)}
              onChanged={() => {}}
            />
          ))}
          <div className="mt-2">
            <Button onClick={() => setFeeOpen(true)}>Open Booking Fee Form</Button>
          </div>
          <GalleryNote>
            Rules resolve most-specific-first: a <code>timeslot</code> fee beats a{' '}
            <code>day</code> fee, which beats the venue <code>default</code>. Every rule
            carries its own message — the form won't save without one, so a $15 Saturday
            can never inherit wording that says $10.
          </GalleryNote>
          <BookingFeeFormModal
            open={feeOpen}
            onClose={() => setFeeOpen(false)}
            locationId="loc-1"
            timeslots={DEMO_TIMESLOTS}
            fees={DEMO_FEES}
            onSaved={() => setFeeOpen(false)}
          />
        </div>
      </GallerySection>

      <GallerySection id="nav-location-staff" title="Location Staff">
        <div className="w-full max-w-2xl flex flex-col gap-2">
          {DEMO_STAFF.map(m => (
            <StaffItem
              key={m.userId}
              member={m}
              locationId="loc-1"
              locationName="Battleground North"
              onChanged={() => {}}
            />
          ))}
          <div className="mt-2">
            <Button onClick={() => setStaffOpen(true)}>Open Add Staff Form</Button>
          </div>
          <GalleryNote>
            Staff read bookings at their venues and nothing else — they can't reach
            venue settings, and the roster itself is admin-only to write. The second
            row has no display name set, so it falls back to the @handle. Adding
            someone resolves them by exact @handle or exact email through the{' '}
            <code>lookup_user_for_venue</code> RPC.
          </GalleryNote>
          <AddStaffModal
            open={staffOpen}
            onClose={() => setStaffOpen(false)}
            locationId="loc-1"
            locationName="Battleground North"
            existingIds={DEMO_STAFF.map(m => m.userId)}
            adminIds={[]}
            onSaved={() => setStaffOpen(false)}
          />
        </div>
      </GallerySection>

      <GallerySection id="nav-club-people" title="Club People">
        <div className="w-full max-w-2xl flex flex-col gap-2">
          {DEMO_PEOPLE.map(p => (
            <PersonItem
              key={p.userId}
              person={p}
              locationId="loc-1"
              clubName="Fitzroy Wargamers"
              isYou={p.userId === 'p-1'}
              onChanged={() => {}}
            />
          ))}
          <div className="mt-2">
            <Button onClick={() => setPeopleOpen(true)}>Open Add Member Form</Button>
          </div>
          <GalleryNote>
            A club's whole roster in one list, strongest role first — admin, then
            organiser, then member. Every row is here on purpose: the viewer's own
            row is marked <em>(you)</em> and has no remove menu, and neither does an
            admin, because their access comes from <code>locations.admins</code>
            rather than this screen. Removing anyone else clears both their member
            and organiser rows, since the organiser tick adds one on top of the
            other. The last row has no display name, so it falls back to the @handle.
          </GalleryNote>
          <AddMemberModal
            open={peopleOpen}
            onClose={() => setPeopleOpen(false)}
            locationId="loc-1"
            clubName="Fitzroy Wargamers"
            existingIds={DEMO_PEOPLE.map(p => p.userId)}
            onSaved={() => setPeopleOpen(false)}
          />
        </div>
      </GallerySection>

    </GalleryShell>
  );
};

export default ComponentGallery;
