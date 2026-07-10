import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, AppFooter, Button, Modal, Input, Select, SearchSelect, ArrowRight, UserRounded, Widget2, UpdateModal, useUpdates, MarkdownBody, Pagination, useAutoPageSize, Shield, RichTextEditor } from '@battleplans/ui';
import type { AppUpdate } from '@battleplans/ui';
import { BattleItem } from '../components/BattleItem';
import { useBattles } from '../hooks/useBattles';
import AppNavbar from '../components/AppNavbar';
import DatePickerInput from '../components/DatePickerInput';
import { StoreSelector } from '../components/StoreSelector';
import { BookingItem } from '../components/BookingItem';
import { GAME_ICONS } from '../components/gameIcons';
import {
  useGames, useAllGames, useLocations, useTimeslots, useUserBookings, useTableAvailability,
  useAdminLocations, useUpcomingBookings, useUserProfile,
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
  const { username, preferredLocationId }        = useUserProfile(userId);
  const { timeslots, loading: timeslotsLoading } = useTimeslots(locationId || null, date || null);
  const { available, loading: availLoading }     = useTableAvailability(locationId || null, date || null, timeslotId || null);

  const today = new Date().toISOString().slice(0, 10);

  // Pre-fill the name with the user's username when the modal opens, unless
  // they've already typed something.
  useEffect(() => {
    if (!open || name || !username) return;
    setName(username);
  }, [open, name, username]);

  // Pre-select the user's preferred location when the modal opens, unless they've
  // already picked one. Guarded on the location still existing in the list.
  useEffect(() => {
    if (!open || locationId || !preferredLocationId) return;
    if (!locations.some(l => l.id === preferredLocationId)) return;
    setLocationId(preferredLocationId);
  }, [open, locationId, preferredLocationId, locations]);

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
    // Snapshot the location + timeslot details as they are now, so later edits to
    // either don't rewrite what this booking shows.
    const loc = locations.find(l => l.id === locationId);
    const ts  = timeslots.find(t => t.id === timeslotId);
    const { error: err } = await supabase.from('bookings').insert({
      user_id:    userId,
      user_name:  name.trim(),
      game_id:    gameId || null,
      location_id: locationId,
      timeslot_id: timeslotId,
      date,
      location_name:       loc?.name       ?? null,
      timeslot_name:       ts?.name         ?? null,
      timeslot_start_time: ts?.start_time   ?? null,
      timeslot_end_time:   ts?.end_time     ?? null,
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

// Row heights, in px. The columns fill the viewport and derive their page size
// from the space left over (see useAutoPageSize), so these must match the rows'
// rendered height. If you change a row's design, change the constant with it.
//
// BookingItem = 2 border + 26 padding (p-[13px]) + max(64 thumbnail, text).
// Both variants are four lines — heading 24 + muted 20 + date 20 + time 20 = 84
// — so My Bookings and Upcoming Bookings share a row height.
const BOOKING_ITEM_H  = 112;
const UPCOMING_ITEM_H = 112;
// BattleItem: heading 24 + opponent 20 + date/venue 20 = 64 = thumbnail -> 92
const BATTLE_ITEM_H   = 92;
// NewsItem = 2 border + 26 padding + title 24 + rule 1 + clamped body 116
//            (5 lines of SM Regular, measured) + button ~38 + three 6px gaps.
//            Rounded up: a slightly high value costs a little whitespace, a low
//            one clips the last row.
const NEWS_ITEM_H     = 230;
/** Vertical gap between rows in every column list (gap-1.5). */
const ROW_GAP = 6;

function BookingCard({ userId }: { userId: string | null }) {
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const { bookings, loading, refetch } = useUserBookings(userId);

  const listRef  = useRef<HTMLDivElement>(null);
  const pageSize = useAutoPageSize(listRef, BOOKING_ITEM_H, ROW_GAP);
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(bookings.length / pageSize));
  const safePage   = Math.min(page, totalPages - 1);
  const paginated  = bookings.slice(safePage * pageSize, (safePage + 1) * pageSize);

  // Snap back into range when the list shrinks or the viewport resizes.
  useEffect(() => { if (page > totalPages - 1) setPage(totalPages - 1); }, [totalPages, page]);

  return (
    <>
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-px shrink-0 snap-start snap-always w-[90vw] max-w-[90vw] md:w-[40vw] md:max-w-[40vw] lg:w-auto lg:flex-1 lg:max-w-sm flex flex-col min-h-0 shadow-md overflow-hidden">
        <div className="flex flex-col gap-4 items-center p-5 flex-1 min-h-0">

          <BoxIcon />

          <h2 className="font-heading text-xl text-white">My Bookings</h2>

          <p className="font-body text-base text-neutral-300 text-center">
            Tables you've booked at your favorite local game stores.
          </p>

          <div ref={listRef} className="flex flex-col gap-1.5 w-full flex-1 min-h-0 overflow-hidden">
            {loading ? (
              <p className="font-body text-sm text-neutral-500 text-center py-4">Loading…</p>
            ) : bookings.length === 0 ? (
              <p className="font-body text-sm text-neutral-500 text-center py-4">No upcoming bookings.</p>
            ) : paginated.map(b => {
              const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
              const [y,m,d] = b.date.split('-').map(Number);
              const dt = new Date(y, m-1, d);
              const dateLabel = `${DAY_NAMES[dt.getDay()]} ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${String(y).slice(2)}`;
              return (
                <BookingItem
                  key={b.id}
                  bookingId={b.id}
                  gameIcon={b.game?.slug ? GAME_ICONS[b.game.slug] : undefined}
                  gameName={b.game?.name ?? 'No game'}
                  location={b.location.name}
                  date={dateLabel}
                  time={formatBookingTime(b.timeslot)}
                  variant="user"
                  onDeleted={refetch}
                />
              );
            })}
          </div>

          <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />

          <Button variant="outline" color="primary" leftIcon={<AddCircleIcon />} className="w-full justify-center shrink-0" onClick={() => setNewBookingOpen(true)}>
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

/** Sentinel for "a venue that isn't one of ours" in the venue picker. */
const OTHER_VENUE = '__other__';

const RESULT_OPTIONS = [
  { value: '',     label: 'Select a result…' },
  { value: 'won',  label: 'Victory' },
  { value: 'lost', label: 'Defeat'  },
  { value: 'drew', label: 'Draw'    },
];

function NewBattleModal({
  open, onClose, userId, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  onCreated: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [gameId,      setGameId]      = useState('');
  const [oppName,     setOppName]     = useState('');
  const [date,        setDate]        = useState(today);
  const [result,      setResult]      = useState('');
  const [venue,       setVenue]       = useState('');   // '' | location id | OTHER_VENUE
  const [customVenue, setCustomVenue] = useState('');
  const [notes,       setNotes]       = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Battles can be against any game, not just the booking-enabled ones.
  const { games,     loading: gamesLoading }     = useAllGames();
  const { locations, loading: locationsLoading } = useLocations();

  const canSubmit = gameId && oppName.trim() && date && result && !saving;

  const handleClose = () => {
    if (saving) return;
    setGameId(''); setOppName(''); setDate(today); setResult('');
    setVenue(''); setCustomVenue(''); setNotes(''); setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!canSubmit || !userId) return;
    setSaving(true);
    setError(null);

    // Known venue -> snapshot its name AND link it. Free text -> name only.
    const known = locations.find(l => l.id === venue);
    const location_id   = known ? known.id : null;
    const location_name = known
      ? known.name
      : (venue === OTHER_VENUE ? (customVenue.trim() || null) : null);

    const { error: err } = await supabase.from('battles').insert({
      user_id:       userId,
      game_id:       gameId,
      date_played:   date,
      opp_name:      oppName.trim(),
      result,
      // The CHECK constraint allows a winner only on a loss. With one opponent
      // field, the winner is necessarily the opponent.
      winner:        result === 'lost' ? oppName.trim() : null,
      location_name,
      location_id,
      battle_notes:  notes.trim() || null,
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
          <h2 className="font-heading text-xl text-white">New Battle</h2>
          <p className="font-body text-base text-neutral-300">Record a game you've played.</p>
        </div>

        <SearchSelect
          label="Game"
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

        <Input
          label="Opponent"
          type="text"
          placeholder="Who did you play?"
          leftIcon={<UserRounded className="w-4 h-4" />}
          value={oppName}
          onChange={e => setOppName(e.target.value)}
        />

        <DatePickerInput label="Date Played" value={date} onChange={setDate} />

        <Select
          label="Result"
          value={result}
          onChange={e => setResult(e.target.value)}
          options={RESULT_OPTIONS}
        />

        <Select
          label="Venue (Optional)"
          value={venue}
          onChange={e => setVenue(e.target.value)}
          disabled={locationsLoading}
          options={[
            { value: '', label: 'No venue' },
            ...locations.map(l => ({ value: l.id, label: l.name })),
            { value: OTHER_VENUE, label: 'Somewhere else…' },
          ]}
        />

        {venue === OTHER_VENUE && (
          <Input
            label="Venue Name"
            type="text"
            placeholder="e.g. Paris' House"
            helperText="Saved as text — it won't link to one of your venues."
            value={customVenue}
            onChange={e => setCustomVenue(e.target.value)}
          />
        )}

        <div className="flex flex-col gap-2">
          <label className="block text-sm font-medium font-body text-white">Notes (Optional)</label>
          <RichTextEditor value={notes} onChange={setNotes} placeholder="How did it go?" />
        </div>

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
            Save Battle
          </Button>
        </div>

      </div>
    </Modal>
  );
}

function MyBattlesCard({ userId }: { userId: string | null }) {
  const { battles, loading, refetch } = useBattles(userId);
  const [newBattleOpen, setNewBattleOpen] = useState(false);
  const [page, setPage] = useState(0);

  const listRef  = useRef<HTMLDivElement>(null);
  const pageSize = useAutoPageSize(listRef, BATTLE_ITEM_H, ROW_GAP);

  const totalPages = Math.max(1, Math.ceil(battles.length / pageSize));
  const safePage   = Math.min(page, totalPages - 1);
  const paginated  = battles.slice(safePage * pageSize, (safePage + 1) * pageSize);

  // Snap back into range when the list shrinks or the viewport resizes.
  useEffect(() => { if (page > totalPages - 1) setPage(totalPages - 1); }, [totalPages, page]);

  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-px shrink-0 snap-start snap-always w-[90vw] max-w-[90vw] md:w-[40vw] md:max-w-[40vw] lg:w-auto lg:flex-1 lg:max-w-sm flex flex-col min-h-0 shadow-md overflow-hidden">
      <div className="flex flex-col gap-4 items-center p-5 flex-1 min-h-0">

        <Shield className="w-12 h-12 text-primary-500" />

        <h2 className="font-heading text-xl text-white">My Battles</h2>

        <p className="font-body text-base text-neutral-300 text-center">
          The games you've played, and how they went.
        </p>

        <div ref={listRef} className="flex flex-col gap-1.5 w-full flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <p className="font-body text-sm text-neutral-500 text-center py-4">Loading…</p>
          ) : battles.length === 0 ? (
            <p className="font-body text-sm text-neutral-500 text-center py-4">No battles recorded yet.</p>
          ) : paginated.map(b => (
            <BattleItem
              key={b.id}
              gameIcon={b.game?.slug ? GAME_ICONS[b.game.slug] : undefined}
              gameName={b.game?.name ?? 'No game'}
              oppName={b.opp_name}
              datePlayed={b.date_played}
              locationName={b.location_name}
              result={b.result}
            />
          ))}
        </div>

        <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />

        <Button
          variant="outline"
          color="primary"
          leftIcon={<AddCircleIcon />}
          className="w-full justify-center shrink-0"
          onClick={() => setNewBattleOpen(true)}
        >
          Add Battle
        </Button>

      </div>

      <NewBattleModal
        open={newBattleOpen}
        onClose={() => setNewBattleOpen(false)}
        userId={userId}
        onCreated={refetch}
      />
    </div>
  );
}

function NewsCard() {
  const { updates, loading } = useUpdates('battleplan');
  const [selected, setSelected] = useState<AppUpdate | null>(null);
  const [page,     setPage]     = useState(0);

  const listRef  = useRef<HTMLDivElement>(null);
  const pageSize = useAutoPageSize(listRef, NEWS_ITEM_H, ROW_GAP);

  const totalPages = Math.max(1, Math.ceil(updates.length / pageSize));
  const safePage   = Math.min(page, totalPages - 1);
  const paginated  = updates.slice(safePage * pageSize, (safePage + 1) * pageSize);

  // Snap back into range if the list shrinks under us.
  useEffect(() => { if (page > totalPages - 1) setPage(totalPages - 1); }, [totalPages, page]);

  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-px shrink-0 snap-start snap-always w-[90vw] max-w-[90vw] md:w-[40vw] md:max-w-[40vw] lg:w-auto lg:flex-1 lg:max-w-sm flex flex-col min-h-0 shadow-md overflow-hidden">
      <div className="flex flex-col gap-4 items-center p-5 flex-1 min-h-0">

        <InfoCircleIcon />

        <h2 className="font-heading text-xl text-white">News &amp; Updates</h2>

        <p className="font-body text-base text-neutral-300 text-center">
          Find out what's happening with BattlePlan.
        </p>

        <div ref={listRef} className="flex flex-col gap-1.5 w-full flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <p className="font-body text-sm text-neutral-500 text-center py-4">Loading…</p>
          ) : updates.length === 0 ? (
            <p className="font-body text-sm text-neutral-500 text-center py-4">
              No updates yet. Check back soon.
            </p>
          ) : paginated.map(u => (
            <NewsItem key={u.id} update={u} onRead={() => setSelected(u)} />
          ))}
        </div>

        <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />

      </div>

      <UpdateModal open={!!selected} onClose={() => setSelected(null)} update={selected} />
    </div>
  );
}

function NewsItem({ update, onRead }: { update: AppUpdate; onRead: () => void }) {
  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] flex flex-col gap-1.5 shadow-md w-full">
      <h3 className="font-heading text-lg text-white leading-6">{update.title}</h3>

      <hr className="border-neutral-700" />

      <MarkdownBody className="text-sm leading-5 text-white line-clamp-5 overflow-hidden">
        {update.body ?? ''}
      </MarkdownBody>

      <div className="flex justify-end">
        <Button variant="ghost" color="primary" size="sm" rightIcon={<ArrowRightIcon />} onClick={onRead}>
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

  const listRef  = useRef<HTMLDivElement>(null);
  const pageSize = useAutoPageSize(listRef, UPCOMING_ITEM_H, ROW_GAP);

  const totalPages = Math.max(1, Math.ceil(bookings.length / pageSize));
  const safePage   = Math.min(page, totalPages - 1);
  const paginated  = bookings.slice(safePage * pageSize, (safePage + 1) * pageSize);

  // Snap back into range whenever the list shrinks (e.g. after a deletion)
  useEffect(() => { if (page > totalPages - 1) setPage(totalPages - 1); }, [totalPages, page]);

  // Jump back to the first page when switching which venue is shown
  useEffect(() => { setPage(0); }, [selectedId]);

  const navigate = useNavigate();

  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-px shrink-0 snap-start snap-always w-[90vw] max-w-[90vw] md:w-[40vw] md:max-w-[40vw] lg:w-auto lg:flex-1 lg:max-w-sm flex flex-col min-h-0 shadow-md overflow-hidden">
      <div className="flex flex-col gap-4 items-center p-5 flex-1 min-h-0">

        <CalendarIcon />

        <h2 className="font-heading text-xl text-white">Upcoming Bookings</h2>

        <p className="font-body text-base text-neutral-300 text-center">
          All upcoming table bookings at your venues.
        </p>

        <div ref={listRef} className="flex flex-col gap-1.5 w-full flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <p className="font-body text-sm text-neutral-500 text-center py-4">Loading…</p>
          ) : bookings.length === 0 ? (
            <p className="font-body text-sm text-neutral-500 text-center py-4">No upcoming bookings.</p>
          ) : paginated.map(b => (
            <BookingItem
              key={b.id}
              bookingId={b.id}
              gameIcon={b.game?.slug ? GAME_ICONS[b.game.slug] : undefined}
              gameName={b.game?.name ?? 'No game'}
              location={b.location.name}
              date={formatBookingDate(b.date)}
              time={formatBookingTime(b.timeslot)}
              customerName={b.user_name ?? undefined}
              variant="store"
              onDeleted={refetch}
            />
          ))}
        </div>

        <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />

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

  // What the navbar picker is pointed at. '' = "Your Profile" (the personal
  // view); anything else is one of the venues this user administers.
  const [selectedVenueId, setSelectedVenueId] = useState('');

  // Store admins open on their first venue rather than their profile. This runs
  // once, when the venues first arrive — a ref rather than a `selectedVenueId`
  // check, so that later choosing "Your Profile" (which sets '') isn't
  // immediately undone by this effect.
  const venueDefaulted = useRef(false);
  useEffect(() => {
    if (venueDefaulted.current || adminLocations.length === 0) return;
    venueDefaulted.current = true;
    setSelectedVenueId(adminLocations[0].id);
  }, [adminLocations]);

  // Store admins can switch between their personal view and a single venue.
  // Everyone else only ever has the personal view.
  const viewingStore = isLocationAdmin && selectedVenueId !== '';

  return (
    <div className="h-dvh overflow-hidden flex flex-col bg-neutral-950">

      <AppNavbar fixed={false} logo={<BattlePlanLogo />}>
        {/* Shown to every store admin, even single-venue ones, because the
            picker is also how they get back to their personal view. */}
        {isLocationAdmin && (
          <StoreSelector
            locations={adminLocations}
            selectedId={selectedVenueId}
            onSelect={setSelectedVenueId}
            emptyOption
            emptyLabel="Your Profile"
            headerLabel="Viewing"
          />
        )}
      </AppNavbar>

      <main className="flex flex-1 min-h-0 items-stretch pt-3 md:pt-9 lg:px-9 w-full">
        <div className="flex flex-1 min-h-0 items-stretch gap-2.5 overflow-x-auto snap-x snap-mandatory lg:overflow-x-visible lg:snap-none lg:justify-center px-3 md:px-9 py-2 scroll-px-3 md:scroll-px-9 lg:p-0">
          {viewingStore ? (
            <UpcomingBookingsCard locations={adminLocations} selectedId={selectedVenueId} />
          ) : (
            <>
              <BookingCard userId={userId} />
              <MyBattlesCard userId={userId} />
            </>
          )}
          <NewsCard />
        </div>
      </main>

      <AppFooter className="shrink-0" appName="BattlePlan" version={__APP_VERSION__} buildDate={__APP_BUILD_DATE__} />

    </div>
  );
}
