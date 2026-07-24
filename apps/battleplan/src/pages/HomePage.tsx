import { useState, useEffect, useMemo, useRef, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, AppFooter, Button, Modal, Input, Select, SearchSelect, ArrowRight, UserRounded, Widget2, UpdateModal, useUpdates, MarkdownBody, PaginatedColumn, ScrollColumn, ColumnShell, ColumnHeader, HR, Shield, RichTextEditor, ListCheck, Gallery, CheckCircle as CheckCircleIcon, CloseCircle, FriendsColumn, useBookingShares } from '@battleplans/ui';
import type { IncomingBookingShare } from '@battleplans/ui';
import type { AppUpdate } from '@battleplans/ui';
import { BattleItem } from '../components/BattleItem';
import { BattleGridItem } from '../components/BattleGridItem';
import { BattleDetailsModal } from '../components/BattleDetailsModal';
import { OpponentPicker } from '../components/OpponentPicker';
import { useBattles } from '../hooks/useBattles';
import { useOpponents, resolveOpponentIds, setBattleOpponents, type SelectedOpponent } from '../hooks/useOpponents';
import AppNavbar from '../components/AppNavbar';
import DatePickerInput from '../components/DatePickerInput';
import { StoreSelector } from '../components/StoreSelector';
import { BookingItem } from '../components/BookingItem';
import { BookingDetailModal, BookingInvitationModal } from '../components/BookingDetailModal';
import { GAME_ICONS } from '../components/gameIcons';
import {
  useGames, useAllGames, useLocations, useTimeslots, useUserBookings, useTableAvailability,
  useAdminLocations, useUpcomingBookings, useUserProfile, useSuggestedBattles,
  useRecentBookedGames,
  formatTimeslotLabel, formatBookingTime,
} from '../hooks/useBookingData';
import type { Location, BattleSuggestion, UpcomingBooking, Booking } from '../hooks/useBookingData';

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

// Bar-chart icon for the My Battles "Stats" button (Figma statistic-chart).
const ChartIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 14h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M4.5 14V8M8 14V3M11.5 14v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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
  const { gameIds: recentGameIds }               = useRecentBookedGames(userId, 5);
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

  // Pre-select the game they last booked, unless they've already picked one.
  // Guarded on that game still being bookable.
  useEffect(() => {
    if (!open || gameId || recentGameIds.length === 0) return;
    const last = recentGameIds[0];
    if (!games.some(g => g.id === last)) return;
    setGameId(last);
  }, [open, gameId, recentGameIds, games]);

  /**
   * Their recent games first, then a divider, then everything else A–Z — so the
   * handful of games someone actually books are always a glance away.
   */
  const gameOptions = useMemo(() => {
    const recent = recentGameIds
      .map(id => games.find(g => g.id === id))
      .filter((g): g is NonNullable<typeof g> => Boolean(g));
    const recentIds = new Set(recent.map(g => g.id));
    const rest = games
      .filter(g => !recentIds.has(g.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    return [...recent, ...rest].map((g, i) => {
      const icon = GAME_ICONS[g.slug];
      return {
        value: g.id,
        label: g.name,
        // First row after the recent block gets the divider.
        separatorBefore: recent.length > 0 && i === recent.length,
        icon: (
          <span className="size-6 rounded overflow-hidden bg-neutral-700 flex items-center justify-center">
            {icon
              ? <img src={icon} alt="" className="w-full h-full object-cover" />
              : <Widget2 className="w-3.5 h-3.5 text-neutral-400" />}
          </span>
        ),
      };
    });
  }, [games, recentGameIds]);

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
          options={gameOptions}
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
// My Battles and the two store booking columns scroll instead of paginating, so
// they need no fixed row height — the store columns carry group dividers, whose
// height a single per-row constant couldn't account for.
// NewsItem = 2 border + 26 padding + title 24 + rule 1 + clamped body 116
//            (5 lines of SM Regular, measured) + button ~38 + three 6px gaps.
//            Rounded up: a slightly high value costs a little whitespace, a low
//            one clips the last row.
const NEWS_ITEM_H     = 230;
// Suggestion card: 2 border + 26 padding + 40 icon row + 8 gap + ~34 button.
const SUGGESTION_ITEM_H = 122;

const DAY_NAMES_SHORT = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function bookingDateLabel(iso: string): string {
  const [y,m,d] = iso.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  return `${DAY_NAMES_SHORT[dt.getDay()]} ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${String(y).slice(2)}`;
}

/** A booking someone shared with you — dashed purple, with Accept / Decline. */
function InvitationCard({ share, busy, onAccept, onDecline, onOpen }: {
  share: IncomingBookingShare;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onOpen: () => void;
}) {
  const icon = share.gameSlug ? GAME_ICONS[share.gameSlug] : undefined;
  const time = share.timeslotStart
    ? formatBookingTime({ start_time: share.timeslotStart, end_time: share.timeslotEnd ?? '' })
    : '';
  return (
    <div
      className="bg-primary-950 border border-primary-600 border-dashed rounded-lg p-[13px] flex gap-3 items-start shadow-md overflow-hidden w-full cursor-pointer"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
    >
      <div className="w-16 h-16 rounded-sm overflow-hidden shrink-0 bg-neutral-700 flex items-center justify-center self-stretch">
        {icon ? <img src={icon} alt="" className="w-full h-full object-cover" /> : <span className="font-heading text-white text-xs text-center px-1">{share.gameName ?? '?'}</span>}
      </div>
      <div className="flex flex-col flex-1 min-w-0 justify-center">
        <p className="font-heading text-primary-200 text-lg leading-6 truncate">{share.gameName ?? 'Booking'} with @{share.sharer.handle}</p>
        <p className="font-body text-sm font-bold text-neutral-300 leading-5 opacity-50 truncate">{share.locationName}</p>
        <p className="font-body text-sm text-neutral-50 leading-5 truncate">{bookingDateLabel(share.date)}</p>
        <p className="font-body text-sm text-neutral-50 leading-5 truncate">{time}</p>
      </div>
      <div className="flex flex-col gap-2.5 items-end justify-center self-stretch" onClick={e => e.stopPropagation()}>
        <Button variant="outline" color="primary" size="sm" rightIcon={<CheckCircleIcon className="w-4 h-4" />} disabled={busy} onClick={onAccept}>Accept</Button>
        <Button variant="outline" color="danger" size="sm" rightIcon={<CloseCircle className="w-4 h-4" />} disabled={busy} onClick={onDecline}>Decline</Button>
      </div>
    </div>
  );
}

function BookingCard({ userId }: { userId: string | null }) {
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [viewing, setViewing] = useState<Booking | null>(null);
  const [invite,  setInvite]  = useState<IncomingBookingShare | null>(null);
  const { bookings, loading, refetch } = useUserBookings(userId);
  const { incoming, busy, respond, refresh: refreshShares } = useBookingShares();

  const pendingInvites = incoming.filter(s => s.status === 'pending');
  const isEmpty = bookings.length === 0 && pendingInvites.length === 0;

  return (
    <>
      <ColumnShell>
        <ColumnHeader
          icon={<BoxIcon />}
          title="Your Bookings"
          description="Tables you've booked at your favorite local game stores."
        />

        <div className="w-full flex-1 min-h-0 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            {loading ? (
              <p className="font-body text-sm text-neutral-500 text-center py-4">Loading…</p>
            ) : (
              <>
                {pendingInvites.length > 0 && (
                  <>
                    <HR variant="text" label="Invitations" spacing="none" />
                    {pendingInvites.map(s => (
                      <InvitationCard
                        key={s.shareId}
                        share={s}
                        busy={busy}
                        onAccept={() => respond(s.shareId, true)}
                        onDecline={() => respond(s.shareId, false)}
                        onOpen={() => setInvite(s)}
                      />
                    ))}
                  </>
                )}

                {bookings.length > 0 && (
                  <>
                    {pendingInvites.length > 0 && <HR variant="text" label="Your Bookings" spacing="none" />}
                    {bookings.map(b => (
                      <BookingItem
                        key={b.id}
                        bookingId={b.id}
                        gameIcon={b.game?.slug ? GAME_ICONS[b.game.slug] : undefined}
                        gameName={b.game?.name ?? 'No game'}
                        location={b.location.name}
                        date={bookingDateLabel(b.date)}
                        time={formatBookingTime(b.timeslot)}
                        variant="user"
                        onDeleted={refetch}
                        onClick={() => setViewing(b)}
                      />
                    ))}
                  </>
                )}

                {isEmpty && (
                  <p className="font-body text-sm text-neutral-500 text-center py-4">No upcoming bookings.</p>
                )}
              </>
            )}
          </div>
        </div>

        <Button variant="outline" color="primary" leftIcon={<AddCircleIcon />} className="w-full justify-center shrink-0" onClick={() => setNewBookingOpen(true)}>
          New Booking
        </Button>
      </ColumnShell>

      <NewBookingModal
        open={newBookingOpen}
        onClose={() => setNewBookingOpen(false)}
        userId={userId}
        onCreated={refetch}
      />

      <BookingDetailModal
        open={viewing !== null}
        booking={viewing}
        onClose={() => setViewing(null)}
        onCancelled={refetch}
      />

      <BookingInvitationModal
        open={invite !== null}
        share={invite}
        busy={busy}
        onClose={() => setInvite(null)}
        onRespond={async accept => {
          if (!invite) return;
          const ok = await respond(invite.shareId, accept);
          if (ok) { setInvite(null); refreshShares(); }
        }}
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
  open, onClose, userId, onCreated, initial,
}: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  onCreated: () => void;
  /** Prefill values when opened from a suggestion (game/venue/date). */
  initial?: { gameId?: string; venue?: string; date?: string } | null;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [gameId,      setGameId]      = useState('');
  const [opponents,   setOpponents]   = useState<SelectedOpponent[]>([]);
  const [date,        setDate]        = useState(today);
  const [result,      setResult]      = useState('');
  const [venue,       setVenue]       = useState('');   // '' | location id | OTHER_VENUE
  const [customVenue, setCustomVenue] = useState('');
  const [notes,       setNotes]       = useState('');
  const [photoFile,   setPhotoFile]   = useState<File | null>(null);
  const [photoPreview,setPhotoPreview]= useState<string | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Battles can be against any supported game, plus the user's own games.
  const { games,     loading: gamesLoading }     = useAllGames(userId);
  const { locations, loading: locationsLoading } = useLocations();
  const { opponents: roster, refetch: refetchOpponents } = useOpponents(userId);

  // When opened from a suggestion, prefill game/venue/date. Runs when the modal
  // opens so each open reflects the current suggestion (or a blank manual add).
  useEffect(() => {
    if (!open) return;
    setGameId(initial?.gameId ?? '');
    setVenue(initial?.venue ?? '');
    setDate(initial?.date ?? today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const oppNames = opponents.map(o => o.name.trim()).filter(Boolean).join(', ');
  const canSubmit = gameId && opponents.length > 0 && date && result && !saving;

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleClose = () => {
    if (saving) return;
    setGameId(''); setOpponents([]); setDate(today); setResult('');
    setVenue(''); setCustomVenue(''); setNotes(''); setError(null);
    clearPhoto();
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

    const { data: inserted, error: err } = await supabase.from('battles').insert({
      user_id:       userId,
      game_id:       gameId,
      date_played:   date,
      opp_name:      oppNames,          // denormalised cache of the opponent names
      result,
      // The CHECK constraint allows a winner only on a loss; the opponents are
      // the winners in that case.
      winner:        result === 'lost' ? oppNames : null,
      location_name,
      location_id,
      battle_notes:  notes.trim() || null,
    }).select('id').single();

    if (err || !inserted) { setSaving(false); setError(err?.message ?? 'Could not save the battle.'); return; }

    // Create/link the opponent objects. A failure here shouldn't lose the battle.
    try {
      const oppIds = await resolveOpponentIds(userId, opponents);
      await setBattleOpponents(inserted.id, oppIds);
      refetchOpponents();
    } catch { /* opp_name cache still holds the names */ }

    // Attach the photo, if one was chosen. Uploaded to the owner's folder in the
    // battle-images bucket, then linked as the battle's primary photo. A photo
    // failure doesn't undo the saved battle — surface it but keep the battle.
    if (photoFile) {
      const ext  = photoFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('battle-images')
        .upload(path, photoFile, { contentType: photoFile.type || undefined, upsert: false });
      if (upErr) {
        setSaving(false);
        setError(`Battle saved, but the photo failed to upload: ${upErr.message}`);
        onCreated();
        return;
      }
      await supabase.from('battle_images').insert({
        battle_id:  inserted.id,
        user_id:    userId,
        image_path: path,
        is_primary: true,
      });
    }

    setSaving(false);
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

        <OpponentPicker value={opponents} onChange={setOpponents} options={roster} />

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

        <div className="flex flex-col gap-2">
          <label className="block text-sm font-medium font-body text-white">Photo (Optional)</label>
          {photoPreview ? (
            <div className="relative w-full h-32 rounded-lg overflow-hidden border border-neutral-700">
              <img src={photoPreview} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={clearPhoto}
                className="absolute top-2 right-2 px-2 py-1 rounded-md bg-neutral-900/80 text-white font-body text-xs hover:bg-neutral-900"
              >
                Remove
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-1.5 w-full h-24 rounded-lg border border-dashed border-neutral-600 cursor-pointer text-neutral-400 hover:bg-neutral-800 transition-colors">
              <Gallery className="w-6 h-6" />
              <span className="font-body text-sm">Add a photo of the battle</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
          )}
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

function MyBattlesCard({ userId, refreshSignal = 0 }: { userId: string | null; refreshSignal?: number }) {
  const navigate = useNavigate();
  const { battles, loading, loadingMore, hasMore, loadMore, refetch } = useBattles(userId);
  const [newBattleOpen, setNewBattleOpen] = useState(false);

  // Refetch when a battle is logged elsewhere (e.g. from a Suggested Battle).
  useEffect(() => {
    if (refreshSignal === 0) return;
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);
  // View switch in the header: compact list rows vs. photo-hero gallery cards.
  const [view, setView] = useState<'list' | 'gallery'>('list');
  // Which battle's details modal is open. Derived from the list by id so it
  // stays fresh after edits refetch.
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // My Battles scrolls rather than paginating (unlike the booking/news columns);
  // ScrollColumn's infinite scroll loads a page at a time via loadMore/hasMore.
  const gallery = view === 'gallery';

  return (
    <>
      <ScrollColumn
        icon={<Shield className="w-12 h-12 text-primary-500" />}
        title="Your Battles"
        description="The games you've played, and how they went."
        toggle={{
          value: view,
          onChange: (v) => setView(v as 'list' | 'gallery'),
          options: [
            { id: 'list',    icon: <ListCheck className="w-4 h-4" />, label: 'List view' },
            { id: 'gallery', icon: <Gallery className="w-4 h-4" />,   label: 'Gallery view' },
          ],
        }}
        wide={gallery}
        items={battles}
        loading={loading}
        empty="No battles recorded yet."
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
        listClassName={gallery ? 'grid grid-cols-1 lg:grid-cols-2 gap-2.5' : 'flex flex-col gap-1.5'}
        getKey={b => b.id}
        renderItem={b => {
          const cardProps = {
            gameIcon:     b.game?.slug ? GAME_ICONS[b.game.slug] : undefined,
            gameName:     b.game?.name ?? 'No game',
            oppName:      b.opp_name,
            datePlayed:   b.date_played,
            locationName: b.location_name,
            result:       b.result,
            photoUrl:     b.photoUrl,
            onClick:      () => setSelectedId(b.id),
          };
          return gallery ? <BattleGridItem {...cardProps} /> : <BattleItem {...cardProps} />;
        }}
        footer={
          // Add Battle + Stats sit side by side (Figma 1014:22867). Stats is a
          // placeholder — its behaviour is still to be specified (V1.1).
          <div className="flex gap-3 w-full shrink-0">
            <Button variant="outline" color="primary" leftIcon={<AddCircleIcon />} className="flex-1 justify-center" onClick={() => setNewBattleOpen(true)}>
              Add Battle
            </Button>
            <Button variant="outline" color="primary" leftIcon={<ChartIcon />} className="flex-1 justify-center" onClick={() => navigate('/app/stats')}>
              Stats
            </Button>
          </div>
        }
      />

      <NewBattleModal
        open={newBattleOpen}
        onClose={() => setNewBattleOpen(false)}
        userId={userId}
        onCreated={refetch}
      />

      <BattleDetailsModal
        battle={battles.find(b => b.id === selectedId) ?? null}
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        onChanged={refetch}
        userId={userId}
      />
    </>
  );
}

// ── Suggested Battles ─────────────────────────────────────────────────────────

const LightbulbIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 6a14 14 0 0 0-9 24.7c1.6 1.3 2.5 3.2 2.5 5.3H30.5c0-2.1.9-4 2.5-5.3A14 14 0 0 0 24 6Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="M19 40h10M21 44h6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

function SuggestionItem({ suggestion, onLog, onDismiss }: {
  suggestion: BattleSuggestion;
  onLog:      () => void;
  onDismiss:  () => void;
}) {
  const icon = suggestion.game?.slug ? GAME_ICONS[suggestion.game.slug] : undefined;
  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] flex flex-col gap-2 shadow-md w-full">
      <div className="flex items-start gap-2.5">
        <div className="w-10 h-10 shrink-0 rounded-md bg-neutral-700 flex items-center justify-center overflow-hidden">
          {icon
            ? <img src={icon} alt="" className="w-full h-full object-cover" />
            : <Shield className="w-5 h-5 text-neutral-400" />}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-heading text-white leading-5 truncate">{suggestion.game?.name ?? 'A game'}</span>
          <span className="text-sm text-neutral-400 truncate">{suggestion.location.name || 'Unknown venue'}</span>
          <span className="text-xs text-neutral-500">{formatBookingDate(suggestion.date)}</span>
        </div>
        <button
          type="button"
          aria-label="Dismiss suggestion"
          onClick={onDismiss}
          className="text-neutral-500 hover:text-white shrink-0"
        >
          <CloseCircle className="w-5 h-5" />
        </button>
      </div>
      <Button variant="outline" color="primary" size="sm" className="w-full justify-center" leftIcon={<AddCircleIcon />} onClick={onLog}>
        Log this battle
      </Button>
    </div>
  );
}

function SuggestedBattlesCard({ userId, onLogged }: { userId: string | null; onLogged: () => void }) {
  const { suggestions, loading, refetch, dismiss } = useSuggestedBattles(userId);
  const [logging, setLogging] = useState<BattleSuggestion | null>(null);

  // The column only exists when there's something to suggest.
  if (loading || suggestions.length === 0) return null;

  return (
    <>
      <PaginatedColumn
        icon={<LightbulbIcon />}
        title="Suggested Battles"
        description="Games we think you played, from your bookings. Log them in a tap."
        items={suggestions}
        itemHeight={SUGGESTION_ITEM_H}
        loading={false}
        empty=""
        getKey={s => s.bookingId}
        renderItem={s => (
          <SuggestionItem
            suggestion={s}
            onLog={() => setLogging(s)}
            onDismiss={() => dismiss(s.bookingId)}
          />
        )}
      />

      <NewBattleModal
        open={logging !== null}
        onClose={() => setLogging(null)}
        userId={userId}
        initial={logging ? { gameId: logging.game?.id, venue: logging.location.id || undefined, date: logging.date } : null}
        onCreated={() => { refetch(); onLogged(); }}
      />
    </>
  );
}

function NewsCard() {
  const { updates, loading } = useUpdates('battleplan');
  const [selected, setSelected] = useState<AppUpdate | null>(null);

  return (
    <>
      <PaginatedColumn
        icon={<InfoCircleIcon />}
        title="News & Updates"
        description="Find out what's happening with BattlePlan."
        items={updates}
        itemHeight={NEWS_ITEM_H}
        loading={loading}
        empty="No updates yet. Check back soon."
        getKey={u => u.id}
        renderItem={u => <NewsItem update={u} onRead={() => setSelected(u)} />}
      />

      <UpdateModal open={!!selected} onClose={() => setSelected(null)} update={selected} />
    </>
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

const TodayIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="10" width="36" height="32" rx="3" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="M6 20h36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M16 6v8M32 6v8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="24" cy="31" r="5" fill="currentColor"/>
  </svg>
);

/** 'Monday, 20/07' — the label above a day's bookings. */
function formatDayDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  return `${DAYS[dt.getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/**
 * A booking list flattened into rows, with a divider wherever the group changes.
 *
 * These lists scroll rather than paginate: a page size derived from one fixed
 * row height can't account for dividers, and a date's bookings splitting across
 * a page boundary would defeat the grouping anyway.
 */
type BookingRow =
  | { kind: 'divider'; key: string; label: string }
  | { kind: 'booking'; key: string; booking: UpcomingBooking };

/** Assumes `bookings` is already ordered so grouped rows sit together. */
function groupRows(bookings: UpcomingBooking[], labelOf: (b: UpcomingBooking) => string): BookingRow[] {
  const rows: BookingRow[] = [];
  let current: string | null = null;
  for (const b of bookings) {
    const label = labelOf(b);
    if (label !== current) {
      rows.push({ kind: 'divider', key: `divider:${label}`, label });
      current = label;
    }
    rows.push({ kind: 'booking', key: b.id, booking: b });
  }
  return rows;
}

function BookingDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1.5 first:pt-0">
      <span className="shrink-0 font-body text-xs uppercase tracking-wider text-neutral-500">{label}</span>
      <span className="flex-1 border-t border-neutral-700" />
    </div>
  );
}

/** Shared row renderer for both store booking columns. */
function renderBookingRow(row: BookingRow, onDeleted: () => void, onOpen: (b: UpcomingBooking) => void) {
  if (row.kind === 'divider') return <BookingDivider label={row.label} />;
  const b = row.booking;
  return (
    <BookingItem
      bookingId={b.id}
      gameIcon={b.game?.slug ? GAME_ICONS[b.game.slug] : undefined}
      gameName={b.game?.name ?? 'No game'}
      location={b.location.name}
      date={formatBookingDate(b.date)}
      time={formatBookingTime(b.timeslot)}
      customerName={b.user_name ?? undefined}
      variant="store"
      onDeleted={onDeleted}
      onClick={() => onOpen(b)}
    />
  );
}

interface StoreColumnProps {
  bookings: UpcomingBooking[];
  loading:  boolean;
  refetch:  () => void;
  /** Today, as YYYY-MM-DD. Passed in so both columns split on the same day. */
  todayIso: string;
  /** Opens the booking modal for a tapped booking. */
  onOpen:   (b: UpcomingBooking) => void;
}

function TodaysBookingsCard({ bookings, loading, refetch, todayIso, onOpen }: StoreColumnProps) {
  // Grouped by timeslot, earliest first — the order a venue works through a day.
  const rows = useMemo(() => {
    const mine = bookings
      .filter(b => b.date === todayIso)
      .sort((a, b) => (a.timeslot.start_time ?? '').localeCompare(b.timeslot.start_time ?? ''));
    return groupRows(mine, b => `${b.timeslot.name} · ${formatBookingTime(b.timeslot)}`);
  }, [bookings, todayIso]);

  return (
    <ScrollColumn
      icon={<TodayIcon />}
      title="Today's Bookings"
      description={formatDayDate(todayIso)}
      items={rows}
      loading={loading}
      empty="No bookings today."
      getKey={r => r.key}
      renderItem={r => renderBookingRow(r, refetch, onOpen)}
    />
  );
}

function UpcomingBookingsCard({ bookings, loading, refetch, todayIso, onOpen }: StoreColumnProps) {
  const navigate = useNavigate();

  // Today's bookings live in their own column, so this starts from tomorrow.
  //
  // The hook orders by timeslot_id, which isn't chronological — harmless as a
  // flat list, but under a date heading an evening slot above an afternoon one
  // reads as a bug. Sort by date then start time so each day runs in order.
  const rows = useMemo(() => {
    const ordered = bookings
      .filter(b => b.date > todayIso)
      .sort((a, b) =>
        a.date.localeCompare(b.date) ||
        (a.timeslot.start_time ?? '').localeCompare(b.timeslot.start_time ?? ''));
    return groupRows(ordered, b => formatDayDate(b.date));
  }, [bookings, todayIso]);

  return (
    <ScrollColumn
      icon={<CalendarIcon />}
      title="Upcoming Bookings"
      description="Table bookings from tomorrow onwards."
      items={rows}
      loading={loading}
      empty="No upcoming bookings."
      getKey={r => r.key}
      renderItem={r => renderBookingRow(r, refetch, onOpen)}
      footer={
        <div className="flex gap-3 w-full shrink-0">
          <Button variant="outline" color="primary" className="flex-1 justify-center" onClick={() => navigate('/app/manage-store')}>
            Manage Store
          </Button>
          <Button variant="outline" color="primary" leftIcon={<ChartIcon />} className="flex-1 justify-center" onClick={() => navigate('/app/store-stats')}>
            Stats
          </Button>
        </div>
      }
    />
  );
}

/**
 * The store view's two booking columns. One fetch feeds both, so they can't
 * disagree and a change refreshes them together.
 */
function StoreBookingColumns({ locations, selectedId }: { locations: Location[]; selectedId: string }) {
  // selectedId is chosen from the navbar venue picker; '' = all of this admin's
  // venues, otherwise a single venue.
  const activeLocationIds = selectedId ? [selectedId] : locations.map(l => l.id);
  const { bookings, loading, refetch } = useUpcomingBookings(activeLocationIds);
  const [viewing, setViewing] = useState<UpcomingBooking | null>(null);

  // One definition of "today" for both columns, so a booking can never fall
  // into both (or neither) if the day ticks over between two renders.
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const shared = { bookings, loading, refetch, todayIso, onOpen: setViewing };

  return (
    <>
      <TodaysBookingsCard   {...shared} />
      <UpcomingBookingsCard {...shared} />

      {/* Store mode: Details + cancel, no Invite Friends — this booking is a
          customer's, not the admin's to share. */}
      <BookingDetailModal
        open={viewing !== null}
        booking={viewing}
        mode="store"
        customerName={viewing?.user_name ?? undefined}
        onClose={() => setViewing(null)}
        onCancelled={() => { refetch(); setViewing(null); }}
      />
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [userId, setUserId] = useState<string | null>(null);
  // Bumped when a battle is logged from the Suggested Battles column, so the
  // sibling My Battles column refetches to show it.
  const [battlesVersion, setBattlesVersion] = useState(0);

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
            <StoreBookingColumns locations={adminLocations} selectedId={selectedVenueId} />
          ) : (
            <>
              <BookingCard userId={userId} />
              <SuggestedBattlesCard userId={userId} onLogged={() => setBattlesVersion(v => v + 1)} />
              <MyBattlesCard userId={userId} refreshSignal={battlesVersion} />
              {/* Personal, so it belongs with the other personal columns — a
                  store admin sees it under "Your Profile", not while they have
                  a venue selected. */}
              <FriendsColumn resolveGameIcon={slug => GAME_ICONS[slug]} />
            </>
          )}
          <NewsCard />
        </div>
      </main>

      <AppFooter className="shrink-0" appName="BattlePlan" version={__APP_VERSION__} buildDate={__APP_BUILD_DATE__} />

    </div>
  );
}
