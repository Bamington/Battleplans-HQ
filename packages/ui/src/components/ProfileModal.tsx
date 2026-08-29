/**
 * ProfileModal.tsx — "Your Profile" settings dialog
 *
 * Opened from the avatar dropdown in the navbar. Lets a signed-in user edit the
 * same details captured during onboarding, using the shared `ProfileFields`:
 *
 *   • Profile picture    — always editable. Public.
 *   • "Your Name"        — always editable. The `username` column. Private:
 *     only stores you book with and friends you accept ever see it.
 *   • "Username"         — always editable. The `handle` column. Public and
 *     unique; this is what people search for.
 *   • Country + Postcode — shown only if a country is already stored, which
 *     means the user has been through BattlePlan's onboarding. Private: they
 *     decide which venues get offered, and are never shown to anyone else.
 *     This is where somebody who MOVES corrects them.
 *   • Preferred location — shown only if the user has ever picked one (i.e. the
 *     stored preferred_location_id is set). BattleCards-only users who never
 *     touched BattlePlan won't see it.
 *
 * Note the deliberate crossover between the two name fields: the DB's
 * `username` is the UI's "Your Name", and the DB's `handle` is the UI's
 * "Username". See the note at the top of lib/handles.ts.
 *
 * Unlike the blocking WelcomeModal, this one is dismissable (Cancel / backdrop).
 * It re-reads the profile each time it opens so it always shows current values.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { avatarUrl, uploadAvatar } from '../lib/avatars';
import { publishProfileDisplay } from '../lib/profileDisplay';
import { validateHandle, describeProfileSaveError } from '../lib/handles';
import { normalisePostcode, validatePostcode, regionFor, inRegionOf } from '../lib/regions';
import Modal from './Modal';
import Button from './Button';
import { ProfileFields, getInitials, type WelcomeLocation } from './WelcomeModal';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the saved username after a successful save (before close). */
  onSaved?: (username: string) => void;
}

type Status = 'loading' | 'ready';

export default function ProfileModal({ open, onClose, onSaved }: ProfileModalProps) {
  const [status,              setStatus]              = useState<Status>('loading');
  const [userId,              setUserId]              = useState<string | null>(null);
  const [username,            setUsername]            = useState('');
  const [handle,              setHandle]              = useState('');
  const [originalHandle,      setOriginalHandle]      = useState<string | null>(null);
  const [email,               setEmail]               = useState<string | null>(null);
  const [showLocation,        setShowLocation]        = useState(false);
  const [preferredLocationId, setPreferredLocationId] = useState('');
  const [showRegion,          setShowRegion]          = useState(false);
  const [country,             setCountry]             = useState('');
  const [postcode,            setPostcode]            = useState('');
  const [locations,           setLocations]           = useState<WelcomeLocation[]>([]);
  const [savedAvatarUrl,      setSavedAvatarUrl]      = useState<string | null>(null);
  // undefined = untouched, Blob = new picture to upload, null = remove.
  const [pendingAvatar,       setPendingAvatar]       = useState<Blob | null | undefined>(undefined);
  const [saving,              setSaving]              = useState(false);
  const [error,               setError]               = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus('loading');
    setError(null);

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { if (!cancelled) onClose(); return; }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('username, handle, preferred_location_id, country, postcode, avatar_path')
        .eq('id', user.id)
        .single();
      if (cancelled) return;

      const hasLocation = !!profile?.preferred_location_id;
      setUserId(user.id);
      setEmail(user.email ?? null);
      // Fall back to the Google name if a username was somehow never saved.
      const googleName =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ?? '';
      setUsername(profile?.username ?? googleName ?? '');
      setHandle(profile?.handle ?? '');
      setOriginalHandle(profile?.handle ?? null);
      setShowLocation(hasLocation);
      setPreferredLocationId(profile?.preferred_location_id ?? '');
      // Same rule as the location above: offered for editing only once
      // onboarding has captured it, so a BattleCards-only user isn't asked for
      // a postcode by an app that has no venues.
      setShowRegion(!!profile?.country);
      setCountry(profile?.country ?? '');
      setPostcode(profile?.postcode ?? '');
      setSavedAvatarUrl(avatarUrl(profile?.avatar_path));
      setPendingAvatar(undefined);

      if (hasLocation) {
        const { data: locs } = await supabase
          .from('locations')
          .select('id, name, country, postcode')
          .neq('kind', 'space')   // never a home venue — see useLocations
          .order('name');
        if (!cancelled && locs) setLocations(locs as WelcomeLocation[]);
      }

      setStatus('ready');
    })();

    return () => { cancelled = true; };
  }, [open, onClose]);

  async function handleSave() {
    if (!userId) return;
    setError(null);

    const trimmed = username.trim();
    if (!trimmed) { setError('Please enter your name.'); return; }
    if (showRegion) {
      if (!country) { setError('Please choose your country.'); return; }
      const postcodeError = validatePostcode(country, postcode);
      if (postcodeError) { setError(postcodeError); return; }
    }
    if (showLocation && !preferredLocationId) {
      setError('Please select a preferred location.');
      return;
    }
    const handleError = validateHandle(handle);
    if (handleError) { setError(handleError); return; }

    setSaving(true);
    const update: {
      username: string;
      handle?: string;
      preferred_location_id?: string;
      country?: string;
      postcode?: string | null;
      avatar_path?: string | null;
    } = { username: trimmed };
    if (handle !== originalHandle) update.handle = handle;
    if (showLocation) update.preferred_location_id = preferredLocationId;
    if (showRegion) {
      update.country  = country;
      update.postcode = normalisePostcode(postcode);
    }

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
    if (saveError) { setError(describeProfileSaveError(saveError)); return; }
    publishProfileDisplay({ username: trimmed, avatarUrl: newAvatarUrl });
    onSaved?.(trimmed);
    onClose();
  }

  if (!open) return null;

  // Mirrors the onboarding modal: the home-venue list narrows to the postcode
  // as it's edited, and whatever is already saved stays listed so correcting a
  // postcode can never silently blank out a venue the user chose.
  const region = regionFor(country, postcode);
  const offeredLocations = inRegionOf(locations, region)
    .concat(locations.filter(l => l.id === preferredLocationId
                               && !inRegionOf([l], region).length));

  return (
    <Modal open onClose={saving ? () => {} : onClose} className="max-w-md">
      <div className="p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-white text-[19.8px] leading-7 tracking-[-0.5px]">
            Your profile
          </h1>
          <p className="font-body text-base text-gray-300 leading-6">
            Update your account details.
          </p>
        </div>

        {status !== 'ready' ? (
          <p className="font-body text-sm text-gray-400">Loading…</p>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={e => { e.preventDefault(); handleSave(); }}
          >
            <ProfileFields
              showAvatar
              avatarUrl={savedAvatarUrl}
              avatarInitials={getInitials(username, email)}
              onAvatarChange={setPendingAvatar}
              disabled={saving}
              showHandle
              handle={handle}
              onHandleChange={setHandle}
              originalHandle={originalHandle}
              selfId={userId}
              showUsername
              showPreferredLocation={showLocation}
              showRegion={showRegion}
              country={country}
              onCountryChange={setCountry}
              postcode={postcode}
              onPostcodeChange={setPostcode}
              username={username}
              onUsernameChange={setUsername}
              preferredLocationId={preferredLocationId}
              onPreferredLocationChange={setPreferredLocationId}
              locations={offeredLocations}
              error={error}
            />

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                color="secondary"
                className="flex-1"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
