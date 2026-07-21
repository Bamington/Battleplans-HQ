/**
 * WelcomeModal.tsx — First-run onboarding dialog
 *
 * Shown once, right after sign-in, to capture the profile details an app needs
 * before the user can proceed. It's a BLOCKING modal — there's no close button
 * and the backdrop doesn't dismiss it; it stays until the required fields are
 * saved. Which fields appear is driven by the `fields` prop, so each app asks
 * for only what it needs (and the form can grow over time):
 *
 *   BattleCards  → { username: true }
 *   BattleBench  → { username: true }
 *   BattlePlan   → { username: true, preferredLocation: true, bookingEmailNote: true }
 *
 * The profile picture is offered in every app and is always OPTIONAL — it never
 * gates the modal, or a user who simply doesn't want one could never get past it.
 *
 * Data lives on `public.user_profiles` (username, preferred_location_id,
 * avatar_path). The gate re-reads that row on mount; if every *required* field
 * is already set the modal never renders. A username set in one app therefore
 * carries over to the other — BattlePlan only additionally needs the preferred
 * location, and a user who lands there second gets another chance at a picture.
 *
 * `WelcomeModalView` is the presentational half (used by the component gallery);
 * `WelcomeModal` wraps it with the data-fetching + gating logic.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { avatarUrl, uploadAvatar } from '../lib/avatars';
import { publishProfileDisplay } from '../lib/profileDisplay';
import Modal from './Modal';
import Input from './Input';
import Select from './Select';
import Button from './Button';
import AvatarPicker from './AvatarPicker';

// ── Field configuration ───────────────────────────────────────────────────────

export interface WelcomeModalFields {
  /** Ask for a chosen username. */
  username?: boolean;
  /** Ask for a preferred booking location (BattlePlan). */
  preferredLocation?: boolean;
  /**
   * Add the line explaining that the user's email reaches stores when they
   * book. Only true where bookings exist (BattlePlan).
   */
  bookingEmailNote?: boolean;
}

/** Up to two uppercase initials from a name, falling back to the email. */
export function getInitials(name: string, email?: string | null): string {
  const trimmed = name.trim();
  if (trimmed) {
    return trimmed.split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  }
  return email ? email[0].toUpperCase() : '';
}

export interface WelcomeLocation {
  id: string;
  name: string;
}

// ── Shared fields ─────────────────────────────────────────────────────────────
// The username + preferred-location inputs, shared by the onboarding
// (WelcomeModalView) and profile-edit (ProfileModal) screens so both stay
// visually identical.

export interface ProfileFieldsProps {
  /** Show the profile picture chooser. Always optional — never gates a save. */
  showAvatar?: boolean;
  /** Public URL of the already-saved picture, if any. */
  avatarUrl?: string | null;
  /** Initials shown by the picker when there is no picture. */
  avatarInitials?: string;
  /** Blob = new picture awaiting upload, null = remove. */
  onAvatarChange?: (blob: Blob | null) => void;
  showUsername: boolean;
  showPreferredLocation: boolean;
  username: string;
  onUsernameChange: (value: string) => void;
  preferredLocationId: string;
  onPreferredLocationChange: (value: string) => void;
  locations: WelcomeLocation[];
  error: string | null;
  /** Greys out the inputs while the parent form is saving. */
  disabled?: boolean;
}

export function ProfileFields({
  showAvatar = false,
  avatarUrl: currentAvatarUrl,
  avatarInitials,
  onAvatarChange,
  showUsername,
  showPreferredLocation,
  username,
  onUsernameChange,
  preferredLocationId,
  onPreferredLocationChange,
  locations,
  error,
  disabled = false,
}: ProfileFieldsProps) {
  return (
    <>
      {showAvatar && onAvatarChange && (
        <AvatarPicker
          currentUrl={currentAvatarUrl}
          initials={avatarInitials}
          onChange={onAvatarChange}
          disabled={disabled}
        />
      )}

      {showUsername && (
        <Input
          label="Username"
          placeholder="Choose a username"
          value={username}
          onChange={e => onUsernameChange(e.target.value)}
          state={error ? 'error' : 'default'}
          required
        />
      )}

      {showPreferredLocation && (
        <Select
          label="Preferred location"
          value={preferredLocationId}
          onChange={e => onPreferredLocationChange(e.target.value)}
          state={error ? 'error' : 'default'}
          required
          options={[
            { value: '', label: 'Select a location…' },
            ...locations.map(l => ({ value: l.id, label: l.name })),
          ]}
        />
      )}

      {error && <p className="font-body text-sm text-red-400">{error}</p>}
    </>
  );
}

// ── Presentational view ───────────────────────────────────────────────────────

export interface WelcomeModalViewProps {
  appName: string;
  showAvatar?: boolean;
  avatarUrl?: string | null;
  avatarInitials?: string;
  onAvatarChange?: (blob: Blob | null) => void;
  showUsername: boolean;
  showPreferredLocation: boolean;
  /** Adds the "email is only shared with stores" line (BattlePlan). */
  showBookingEmailNote?: boolean;
  username: string;
  onUsernameChange: (value: string) => void;
  preferredLocationId: string;
  onPreferredLocationChange: (value: string) => void;
  locations: WelcomeLocation[];
  saving: boolean;
  error: string | null;
  onSave: () => void;
}

export function WelcomeModalView({
  appName,
  showAvatar,
  avatarUrl: currentAvatarUrl,
  avatarInitials,
  onAvatarChange,
  showUsername,
  showPreferredLocation,
  showBookingEmailNote = false,
  username,
  onUsernameChange,
  preferredLocationId,
  onPreferredLocationChange,
  locations,
  saving,
  error,
  onSave,
}: WelcomeModalViewProps) {
  return (
    // Blocking: onClose is a no-op so clicking the backdrop can't dismiss it.
    <Modal open onClose={() => {}} className="max-w-md">
      <form
        className="p-5 flex flex-col gap-4"
        onSubmit={e => { e.preventDefault(); onSave(); }}
      >
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-white text-[19.8px] leading-7 tracking-[-0.5px]">
            Welcome to {appName}
          </h1>
          <p className="font-body text-base text-gray-300 leading-6">
            Other users will see your Username and Profile Picture.
          </p>
          {showBookingEmailNote && (
            <p className="font-body text-base text-gray-300 leading-6">
              Your email address is only shared with stores when you make a booking.
            </p>
          )}
        </div>

        <ProfileFields
          showAvatar={showAvatar}
          avatarUrl={currentAvatarUrl}
          avatarInitials={avatarInitials}
          onAvatarChange={onAvatarChange}
          showUsername={showUsername}
          showPreferredLocation={showPreferredLocation}
          username={username}
          onUsernameChange={onUsernameChange}
          preferredLocationId={preferredLocationId}
          onPreferredLocationChange={onPreferredLocationChange}
          locations={locations}
          error={error}
          disabled={saving}
        />

        <Button className="w-full" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Continue'}
        </Button>
      </form>
    </Modal>
  );
}

// ── Smart wrapper ─────────────────────────────────────────────────────────────

interface WelcomeModalProps {
  /** Shown in the heading, e.g. "BattleCards". */
  appName: string;
  /** Which fields to show and require. */
  fields: WelcomeModalFields;
}

type Status = 'loading' | 'needed' | 'done';

export default function WelcomeModal({ appName, fields }: WelcomeModalProps) {
  const wantUsername = !!fields.username;
  const wantLocation = !!fields.preferredLocation;
  const wantEmailNote = !!fields.bookingEmailNote;

  const [status,              setStatus]              = useState<Status>('loading');
  const [userId,              setUserId]              = useState<string | null>(null);
  const [username,            setUsername]            = useState('');
  const [email,               setEmail]               = useState<string | null>(null);
  const [preferredLocationId, setPreferredLocationId] = useState('');
  const [locations,           setLocations]           = useState<WelcomeLocation[]>([]);
  const [savedAvatarUrl,      setSavedAvatarUrl]      = useState<string | null>(null);
  // undefined = untouched, Blob = new picture to upload, null = remove.
  const [pendingAvatar,       setPendingAvatar]       = useState<Blob | null | undefined>(undefined);
  const [saving,              setSaving]              = useState(false);
  const [error,               setError]               = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { if (!cancelled) setStatus('done'); return; }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('username, preferred_location_id, avatar_path')
        .eq('id', user.id)
        .single();

      if (cancelled) return;

      const existingUsername = profile?.username ?? '';
      const existingLocation = profile?.preferred_location_id ?? '';

      // The picture is deliberately absent from this check — it's optional, so
      // a missing one must never keep the blocking modal on screen.
      const missing =
        (wantUsername && !existingUsername) ||
        (wantLocation && !existingLocation);

      if (!missing) { setStatus('done'); return; }

      setUserId(user.id);
      setEmail(user.email ?? null);
      setSavedAvatarUrl(avatarUrl(profile?.avatar_path));
      // Prefill the username from any value already saved, else the Google
      // display name as an editable starting point.
      const googleName =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        '';
      setUsername(existingUsername || googleName);
      setPreferredLocationId(existingLocation);

      if (wantLocation) {
        const { data: locs } = await supabase
          .from('locations')
          .select('id, name')
          .order('name');
        if (!cancelled && locs) setLocations(locs as WelcomeLocation[]);
      }

      setStatus('needed');
    }

    load();
    return () => { cancelled = true; };
  }, [wantUsername, wantLocation]);

  async function handleSave() {
    if (!userId) return;
    setError(null);

    const trimmedUsername = username.trim();
    if (wantUsername && !trimmedUsername) {
      setError('Please enter a username.');
      return;
    }
    if (wantLocation && !preferredLocationId) {
      setError('Please select a preferred location.');
      return;
    }

    setSaving(true);
    const update: {
      username?: string;
      preferred_location_id?: string;
      avatar_path?: string | null;
    } = {};
    if (wantUsername) update.username = trimmedUsername;
    if (wantLocation) update.preferred_location_id = preferredLocationId;

    // Upload first: if storage fails there's nothing to undo, whereas saving the
    // row first could leave avatar_path pointing at an object that never landed.
    // Untouched → keep whatever was already saved.
    let newAvatarUrl: string | null = savedAvatarUrl;
    if (pendingAvatar instanceof Blob) {
      try {
        update.avatar_path = await uploadAvatar(userId, pendingAvatar);
        newAvatarUrl = avatarUrl(update.avatar_path);
      } catch (err) {
        setSaving(false);
        setError(err instanceof Error ? err.message : 'Could not upload that picture.');
        return;
      }
    } else if (pendingAvatar === null) {
      update.avatar_path = null;
      newAvatarUrl = null;
    }

    const { error: saveError } = await supabase
      .from('user_profiles')
      .update(update)
      .eq('id', userId);

    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    // The Navbar is a sibling of this modal, so it can't be reached by a prop —
    // publishing is what makes the new name and picture appear straight away
    // instead of only after the next page load.
    publishProfileDisplay({ username: trimmedUsername || null, avatarUrl: newAvatarUrl });
    setStatus('done');
  }

  if (status !== 'needed') return null;

  return (
    <WelcomeModalView
      appName={appName}
      showAvatar
      avatarUrl={savedAvatarUrl}
      avatarInitials={getInitials(username, email)}
      onAvatarChange={setPendingAvatar}
      showUsername={wantUsername}
      showPreferredLocation={wantLocation}
      showBookingEmailNote={wantEmailNote}
      username={username}
      onUsernameChange={setUsername}
      preferredLocationId={preferredLocationId}
      onPreferredLocationChange={setPreferredLocationId}
      locations={locations}
      saving={saving}
      error={error}
      onSave={handleSave}
    />
  );
}
