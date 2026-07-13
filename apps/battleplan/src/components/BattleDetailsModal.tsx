/**
 * BattleDetailsModal.tsx — View + edit a recorded battle (Figma 1016:18017 view,
 * 1016:16006 edit).
 *
 * Opens from a battle card in a read-only VIEW state: a swipeable photo carousel,
 * the game logo, "{Result} against {Opponent}", the game name, the date/venue and
 * the notes. A ⋯ menu switches to EDIT — the same fields as New Battle plus a
 * multi-photo manager (upload, remove, choose the primary) — or deletes the
 * battle. Photo operations apply immediately; Save persists the other fields.
 */

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  supabase, Modal, Button, SearchSelect, Input, Select, RichTextEditor, MarkdownBody,
  MenuDots, Pen2, TrashBinMinimalistic, UploadMinimalistic, CloseCircle, StarBold, Star,
  AltArrowLeft, AltArrowRight, CheckCircle, Widget2, UserRounded,
} from '@battleplans/ui';
import DatePickerInput from './DatePickerInput';
import { OpponentPicker } from './OpponentPicker';
import { GAME_ICONS } from './gameIcons';
import type { Battle, BattleResult } from '../hooks/useBattles';
import { useAllGames, useLocations } from '../hooks/useBookingData';
import { useOpponents, resolveOpponentIds, setBattleOpponents, type SelectedOpponent } from '../hooks/useOpponents';

// ── Constants shared with the New Battle flow ─────────────────────────────────

const OTHER_VENUE = '__other__';

const RESULT_TITLE: Record<BattleResult, string> = { won: 'Victory', lost: 'Defeat', drew: 'Draw' };

const RESULT_OPTIONS = [
  { value: '',     label: 'Select a result…' },
  { value: 'won',  label: 'Victory' },
  { value: 'lost', label: 'Defeat'  },
  { value: 'drew', label: 'Draw'    },
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "2026-06-13" -> "Saturday, 13/06/26" */
function formatBattleDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAY_NAMES[dt.getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(y).slice(2)}`;
}

// ── Photo carousel ────────────────────────────────────────────────────────────

/** Swipeable hero carousel — scroll-snap with arrows and dots. */
function PhotoCarousel({ urls }: { urls: string[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  const scrollTo = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="relative w-full aspect-[1200/903] bg-neutral-900">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex h-full w-full overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {urls.map((u, i) => (
          <img
            key={i}
            src={u}
            alt=""
            className="h-full w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>

      {urls.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => scrollTo(Math.max(0, idx - 1))}
            className="absolute left-2 top-1/2 -translate-y-1/2 grid place-items-center size-8 rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-0"
            disabled={idx === 0}
          >
            <AltArrowLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => scrollTo(Math.min(urls.length - 1, idx + 1))}
            className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center size-8 rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-0"
            disabled={idx === urls.length - 1}
          >
            <AltArrowRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {urls.map((_, i) => (
              <span
                key={i}
                className={`size-1.5 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function BattleDetailsModal({
  battle, open, onClose, onChanged, userId,
}: {
  battle:    Battle | null;
  open:      boolean;
  onClose:   () => void;
  /** Refetch the battles list after any change. */
  onChanged: () => void;
  userId:    string | null;
}) {
  const [editing, setEditing]     = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting]   = useState(false);

  // Edit form
  const [gameId,      setGameId]      = useState('');
  const [opponents,   setOpponents]   = useState<SelectedOpponent[]>([]);
  const [date,        setDate]        = useState('');
  const [result,      setResult]      = useState('');
  const [venue,       setVenue]       = useState('');
  const [customVenue, setCustomVenue] = useState('');
  const [notes,       setNotes]       = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Photo ops
  const [busyPhoto, setBusyPhoto]   = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { games,     loading: gamesLoading }     = useAllGames();
  const { locations, loading: locationsLoading } = useLocations();
  const { opponents: roster, refetch: refetchOpponents } = useOpponents(userId);

  // Reset to the view state whenever a different battle opens.
  useEffect(() => {
    if (open) { setEditing(false); setMenuOpen(false); setConfirmDel(false); setError(null); setPhotoError(null); }
  }, [open, battle?.id]);

  if (!battle) return null;

  const gameIcon = battle.game?.slug ? GAME_ICONS[battle.game.slug] : undefined;
  const title    = `${RESULT_TITLE[battle.result]} against ${battle.opp_name}`;
  const whenWhere = battle.location_name
    ? `${formatBattleDate(battle.date_played)} at ${battle.location_name}`
    : formatBattleDate(battle.date_played);

  // ── Enter edit: seed the form from the battle ───────────────────────────────
  const startEditing = () => {
    setGameId(battle.game?.id ?? '');
    setOpponents(battle.opponents.map(o => ({ id: o.id, name: o.name })));
    setDate(battle.date_played);
    setResult(battle.result);
    if (battle.location_id)        { setVenue(battle.location_id); setCustomVenue(''); }
    else if (battle.location_name) { setVenue(OTHER_VENUE); setCustomVenue(battle.location_name); }
    else                           { setVenue(''); setCustomVenue(''); }
    setNotes(battle.battle_notes ?? '');
    setError(null);
    setMenuOpen(false);
    setEditing(true);
  };

  const oppNames = opponents.map(o => o.name.trim()).filter(Boolean).join(', ');
  const canSave = gameId && opponents.length > 0 && date && result && !saving;

  const handleSave = async () => {
    if (!canSave || !userId) return;
    setSaving(true);
    setError(null);

    const known = locations.find(l => l.id === venue);
    const location_id   = known ? known.id : null;
    const location_name = known
      ? known.name
      : (venue === OTHER_VENUE ? (customVenue.trim() || null) : null);

    const { error: err } = await supabase.from('battles').update({
      game_id:      gameId,
      date_played:  date,
      opp_name:     oppNames,          // denormalised cache of the opponent names
      result,
      winner:       result === 'lost' ? oppNames : null,
      location_name,
      location_id,
      battle_notes: notes.trim() || null,
    }).eq('id', battle.id);

    if (err) { setSaving(false); setError(err.message); return; }

    // Sync the opponent objects/links. Cache (opp_name) is already saved above.
    try {
      const oppIds = await resolveOpponentIds(userId, opponents);
      await setBattleOpponents(battle.id, oppIds);
      refetchOpponents();
    } catch { /* opp_name still reflects the names */ }

    setSaving(false);
    onChanged();
    setEditing(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    // battle_images rows cascade-delete via their FK.
    const { error: err } = await supabase.from('battles').delete().eq('id', battle.id);
    setDeleting(false);
    if (err) { setError(err.message); setConfirmDel(false); return; }
    onChanged();
    onClose();
  };

  // ── Photo operations (applied immediately) ──────────────────────────────────
  const handleAddPhotos = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length || !userId) return;
    setBusyPhoto(true);
    setPhotoError(null);
    let hadError = false;

    for (const file of files) {
      const ext  = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('battle-images')
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) { hadError = true; continue; }
      // First-ever photo becomes the primary.
      const isPrimary = battle.photos.length === 0 && !hadError && file === files[0];
      const { error: insErr } = await supabase.from('battle_images').insert({
        battle_id: battle.id, user_id: userId, image_path: path, is_primary: isPrimary,
      });
      if (insErr) hadError = true;
    }

    setBusyPhoto(false);
    if (hadError) setPhotoError('Some photos could not be uploaded.');
    onChanged();
  };

  const handleRemovePhoto = async (id: string) => {
    setBusyPhoto(true);
    setPhotoError(null);
    const { error: err } = await supabase.from('battle_images').delete().eq('id', id);
    setBusyPhoto(false);
    if (err) { setPhotoError('Could not remove the photo.'); return; }
    onChanged();
  };

  const handleSetPrimary = async (id: string) => {
    setBusyPhoto(true);
    setPhotoError(null);
    // One primary per battle (partial unique index): clear the others first.
    await supabase.from('battle_images').update({ is_primary: false }).eq('battle_id', battle.id);
    const { error: err } = await supabase.from('battle_images').update({ is_primary: true }).eq('id', id);
    setBusyPhoto(false);
    if (err) { setPhotoError('Could not set the primary photo.'); return; }
    onChanged();
  };

  const photoUrls = battle.photos.map(p => p.url);

  // No explicit max-width — matches the New Battle / New Booking modals, which take
  // the Modal default (90vw on mobile/tablet, lg:max-w-[50vw] on desktop).
  return (
    <Modal open={open} onClose={onClose} className="max-w-xl overflow-hidden">
      <div className="max-h-[90vh] overflow-y-auto">

        {/* Hero — photo carousel (view) */}
        {!editing && photoUrls.length > 0 && <PhotoCarousel urls={photoUrls} />}

        <div className="flex flex-col gap-3 p-5">

          {/* Header: logo + title + game name + ⋯ menu */}
          <div className="flex gap-3 items-center w-full">
            <div className="size-16 shrink-0 rounded overflow-hidden bg-neutral-700 flex items-center justify-center">
              {gameIcon
                ? <img src={gameIcon} alt="" className="w-full h-full object-cover" />
                : <span className="font-heading text-white text-xs text-center px-1 leading-tight">{battle.game?.name}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-heading text-white text-xl leading-7 tracking-tight truncate">{title}</h2>
              <p className="font-body font-bold text-sm text-neutral-300/60 truncate">{battle.game?.name ?? 'No game'}</p>
            </div>
            <div className="relative shrink-0 self-start">
              <button
                type="button"
                aria-label="Battle actions"
                onClick={() => setMenuOpen(o => !o)}
                className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
              >
                <MenuDots className="w-4 h-4" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                  <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-lg bg-neutral-800 border border-neutral-700 shadow-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={startEditing}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-body text-white hover:bg-neutral-700 text-left"
                    >
                      <Pen2 className="w-4 h-4" /> Edit details
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); setConfirmDel(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-body text-red-400 hover:bg-neutral-700 text-left"
                    >
                      <TrashBinMinimalistic className="w-4 h-4" /> Delete battle
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── VIEW ─────────────────────────────────────────────────────── */}
          {!editing && !confirmDel && (
            <>
              <p className="font-body text-sm text-neutral-50">{whenWhere}</p>

              {battle.opponents.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="font-body text-xs uppercase tracking-wide text-neutral-500">
                    {battle.opponents.length === 1 ? 'Opponent' : 'Opponents'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {battle.opponents.map(o => (
                      <span key={o.id} className="inline-flex items-center gap-1 pl-1.5 pr-2.5 py-0.5 rounded-full text-sm font-body bg-neutral-700 text-neutral-100">
                        <UserRounded className="w-3.5 h-3.5 text-neutral-400" /> {o.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {battle.battle_notes
                ? <MarkdownBody className="text-sm text-neutral-50">{battle.battle_notes}</MarkdownBody>
                : <p className="font-body text-sm text-neutral-500 italic">No notes for this battle.</p>}
            </>
          )}

          {/* ── DELETE CONFIRM ───────────────────────────────────────────── */}
          {confirmDel && (
            <>
              <p className="font-body text-sm text-neutral-200">
                Delete this battle and its photos? This can't be undone.
              </p>
              {error && <p className="font-body text-sm text-red-400">{error}</p>}
              <div className="flex justify-end gap-3">
                <Button variant="ghost" color="danger" size="sm" disabled={deleting} onClick={() => setConfirmDel(false)}>
                  Cancel
                </Button>
                <Button color="danger" size="sm" loading={deleting} rightIcon={<TrashBinMinimalistic className="w-4 h-4" />} onClick={handleDelete}>
                  Delete Battle
                </Button>
              </div>
            </>
          )}

          {/* ── EDIT ─────────────────────────────────────────────────────── */}
          {editing && (
            <>
              <SearchSelect
                label="Battle Game"
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

              <DatePickerInput label="Battle Date" value={date} onChange={setDate} />

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
                  value={customVenue}
                  onChange={e => setCustomVenue(e.target.value)}
                />
              )}

              <div className="flex flex-col gap-2">
                <label className="block text-sm font-medium font-body text-white">Battle Notes</label>
                <RichTextEditor value={notes} onChange={setNotes} placeholder="Your notes from the battle." />
              </div>

              {/* Battle Photos manager */}
              <div className="flex flex-col gap-2.5">
                <label className="block text-sm font-medium font-body text-white">Battle Photos</label>

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busyPhoto}
                  className="flex flex-col items-center justify-center gap-4 h-40 w-full rounded-xl border border-dashed border-neutral-600 bg-neutral-700/40 hover:bg-neutral-700 transition-colors disabled:opacity-50"
                >
                  <div className="flex flex-col items-center gap-2">
                    <UploadMinimalistic className="w-6 h-6 text-neutral-300" />
                    <span className="font-body text-sm text-neutral-50">{busyPhoto ? 'Uploading…' : 'Upload Images'}</span>
                  </div>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-body font-medium">
                    Browse Files
                  </span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAddPhotos} />

                {photoError && <p className="font-body text-sm text-red-400">{photoError}</p>}

                {battle.photos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {battle.photos.map(p => (
                      <div key={p.id} className="relative size-[120px] shrink-0">
                        <img src={p.url} alt="" className="size-full object-cover rounded-md border border-neutral-700" />
                        {/* Remove */}
                        <button
                          type="button"
                          aria-label="Remove photo"
                          onClick={() => handleRemovePhoto(p.id)}
                          disabled={busyPhoto}
                          className="absolute -top-1.5 -right-1.5 text-white bg-neutral-900 rounded-full disabled:opacity-50"
                        >
                          <CloseCircle className="w-5 h-5" />
                        </button>
                        {/* Set / show primary */}
                        <button
                          type="button"
                          aria-label={p.isPrimary ? 'Primary photo' : 'Set as primary'}
                          onClick={() => !p.isPrimary && handleSetPrimary(p.id)}
                          disabled={busyPhoto}
                          className="absolute bottom-1 left-1 grid place-items-center size-6 rounded-full bg-black/60 text-white disabled:opacity-50"
                        >
                          {p.isPrimary
                            ? <StarBold className="w-3.5 h-3.5 text-amber-400" />
                            : <Star className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && <p className="font-body text-sm text-red-400">{error}</p>}

              <div className="flex justify-end gap-3 pt-1">
                <Button variant="ghost" color="danger" size="sm" disabled={saving} onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  size="sm"
                  loading={saving}
                  disabled={!canSave}
                  rightIcon={<CheckCircle className="w-4 h-4" />}
                  onClick={handleSave}
                >
                  Save Battle
                </Button>
              </div>
            </>
          )}

        </div>
      </div>
    </Modal>
  );
}
