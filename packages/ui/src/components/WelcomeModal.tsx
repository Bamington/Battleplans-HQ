/**
 * WelcomeModal.tsx — First-run onboarding dialog
 *
 * Shown once, right after sign-in, to capture the profile details an app needs
 * before the user can proceed. It's a BLOCKING modal — there's no close button
 * and the backdrop doesn't dismiss it; it stays until the required fields are
 * saved. Which fields appear is driven by the `fields` prop, so each app asks
 * for only what it needs (and the form can grow over time):
 *
 *   BattleCards → { username: true }
 *   BattlePlan  → { username: true, preferredLocation: true }
 *
 * Data lives on `public.user_profiles` (username, preferred_location_id). The
 * gate re-reads that row on mount; if every required field is already set the
 * modal never renders. A username set in one app therefore carries over to the
 * other — BattlePlan only additionally needs the preferred location.
 *
 * `WelcomeModalView` is the presentational half (used by the component gallery);
 * `WelcomeModal` wraps it with the data-fetching + gating logic.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Modal from './Modal';
import Input from './Input';
import Select from './Select';
import Button from './Button';

// ── Field configuration ───────────────────────────────────────────────────────

export interface WelcomeModalFields {
  /** Ask for a chosen username. */
  username?: boolean;
  /** Ask for a preferred booking location (BattlePlan). */
  preferredLocation?: boolean;
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
  showUsername: boolean;
  showPreferredLocation: boolean;
  username: string;
  onUsernameChange: (value: string) => void;
  preferredLocationId: string;
  onPreferredLocationChange: (value: string) => void;
  locations: WelcomeLocation[];
  error: string | null;
}

export function ProfileFields({
  showUsername,
  showPreferredLocation,
  username,
  onUsernameChange,
  preferredLocationId,
  onPreferredLocationChange,
  locations,
  error,
}: ProfileFieldsProps) {
  return (
    <>
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
  showUsername: boolean;
  showPreferredLocation: boolean;
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
  showUsername,
  showPreferredLocation,
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
            Just a couple of details to finish setting up your account.
          </p>
        </div>

        <ProfileFields
          showUsername={showUsername}
          showPreferredLocation={showPreferredLocation}
          username={username}
          onUsernameChange={onUsernameChange}
          preferredLocationId={preferredLocationId}
          onPreferredLocationChange={onPreferredLocationChange}
          locations={locations}
          error={error}
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

  const [status,              setStatus]              = useState<Status>('loading');
  const [userId,              setUserId]              = useState<string | null>(null);
  const [username,            setUsername]            = useState('');
  const [preferredLocationId, setPreferredLocationId] = useState('');
  const [locations,           setLocations]           = useState<WelcomeLocation[]>([]);
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
        .select('username, preferred_location_id')
        .eq('id', user.id)
        .single();

      if (cancelled) return;

      const existingUsername = profile?.username ?? '';
      const existingLocation = profile?.preferred_location_id ?? '';

      const missing =
        (wantUsername && !existingUsername) ||
        (wantLocation && !existingLocation);

      if (!missing) { setStatus('done'); return; }

      setUserId(user.id);
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
    const update: { username?: string; preferred_location_id?: string } = {};
    if (wantUsername) update.username = trimmedUsername;
    if (wantLocation) update.preferred_location_id = preferredLocationId;

    const { error: saveError } = await supabase
      .from('user_profiles')
      .update(update)
      .eq('id', userId);

    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    setStatus('done');
  }

  if (status !== 'needed') return null;

  return (
    <WelcomeModalView
      appName={appName}
      showUsername={wantUsername}
      showPreferredLocation={wantLocation}
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
