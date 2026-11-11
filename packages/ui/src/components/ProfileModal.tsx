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
import { Link } from 'react-router-dom';
import Modal from './Modal';
import Button from './Button';
import Select from './Select';
import Tabs from './Tabs';
import { profilePath } from './FriendProfileModal';
import { ProfileFields, getInitials, type WelcomeLocation } from './WelcomeModal';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the saved username after a successful save (before close). */
  onSaved?: (username: string) => void;
}

type Status = 'loading' | 'ready';

/** Who sees a profile section. */
export type SectionVisibility = 'off' | 'friends' | 'everyone';
type SectionKey = 'bench' | 'favourites' | 'stats';
type Sections = Record<SectionKey, SectionVisibility>;

const VISIBILITY_OPTIONS: { value: SectionVisibility; label: string }[] = [
  { value: 'off',      label: 'Off' },
  { value: 'friends',  label: 'Friends only' },
  { value: 'everyone', label: 'Everyone' },
];

/**
 * The public profile's optional sections. Every app lists all of them; one the
 * user has nothing for yet is shown but disabled, with what unlocks it — e.g.
 * someone who has never used BattleBench's Painting Desk can't share a bench.
 */
const SECTIONS: { key: SectionKey; column: string; title: string; description: string; locked: string }[] = [
  { key: 'bench', column: 'public_bench', title: 'Painting Bench',
    description: 'The models on your BattleBench Painting Desk, with their progress photos.',
    locked: 'Put a model on the Painting Desk in BattleBench to share this.' },
  { key: 'favourites', column: 'public_favourites', title: 'Favourites',
    description: 'Models and collections you’ve marked as favourites in BattleBench.',
    locked: 'Mark a model or collection as a favourite in BattleBench to share this.' },
  { key: 'stats', column: 'public_stats', title: 'Painting Stats',
    description: 'A summary of your collection: totals, painting progress and most collected games.',
    locked: 'Add a model in BattleBench to share this.' },
];

/** The "Public Profile" tab: one Off / Friends only / Everyone choice per section. */
function PublicProfileSettings({ sections, available, onChange, disabled, handle }: {
  sections: Sections;
  available: Record<SectionKey, boolean>;
  onChange: (key: SectionKey, v: SectionVisibility) => void;
  disabled: boolean;
  handle: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-body text-sm text-gray-300">
        Choose what else your profile shows. Your avatar and username are always visible;
        your name only ever shows to friends.
      </p>
      {SECTIONS.map(s => {
        const locked = !available[s.key];
        return (
          <div key={s.key} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className={`font-body text-sm font-medium ${locked ? 'text-gray-500' : 'text-white'}`}>{s.title}</p>
                <p className="font-body text-xs text-gray-400">{locked ? s.locked : s.description}</p>
              </div>
              <Select
                size="sm"
                className="w-36 shrink-0"
                aria-label={`${s.title} visibility`}
                value={locked ? 'off' : sections[s.key]}
                disabled={disabled || locked}
                onChange={e => onChange(s.key, e.target.value as SectionVisibility)}
                options={VISIBILITY_OPTIONS}
              />
            </div>
          </div>
        );
      })}
      {handle && (
        <Link to={profilePath(handle)} className="self-start font-body text-sm text-primary-400 hover:text-primary-300 hover:underline">
          View your profile
        </Link>
      )}
    </div>
  );
}

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
  const [sections,            setSections]            = useState<Sections>({ bench: 'off', favourites: 'off', stats: 'off' });
  const [available,           setAvailable]           = useState<Record<SectionKey, boolean>>({ bench: false, favourites: false, stats: false });
  const [tab,                 setTab]                 = useState<'details' | 'public'>('details');
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
        .select('username, handle, preferred_location_id, country, postcode, avatar_path, public_bench, public_favourites, public_stats')
        .eq('id', user.id)
        .single();
      const { data: avail } = await supabase.rpc('my_profile_section_availability');
      if (cancelled) return;

      setTab('details');
      setSections({
        bench:      (profile?.public_bench ?? 'off') as SectionVisibility,
        favourites: (profile?.public_favourites ?? 'off') as SectionVisibility,
        stats:      (profile?.public_stats ?? 'off') as SectionVisibility,
      });
      const a = (avail ?? {}) as Partial<Record<SectionKey, boolean>>;
      setAvailable({ bench: !!a.bench, favourites: !!a.favourites, stats: !!a.stats });

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

    // Every check is about Your Details, so a failure takes you back there to see it.
    const fail = (message: string) => { setError(message); setTab('details'); };
    const trimmed = username.trim();
    if (!trimmed) { fail('Please enter your name.'); return; }
    if (showRegion) {
      if (!country) { fail('Please choose your country.'); return; }
      const postcodeError = validatePostcode(country, postcode);
      if (postcodeError) { fail(postcodeError); return; }
    }
    if (showLocation && !preferredLocationId) {
      fail('Please select a preferred location.');
      return;
    }
    const handleError = validateHandle(handle);
    if (handleError) { fail(handleError); return; }

    setSaving(true);
    const update: {
      username: string;
      handle?: string;
      preferred_location_id?: string;
      country?: string;
      postcode?: string | null;
      avatar_path?: string | null;
      public_bench?: SectionVisibility;
      public_favourites?: SectionVisibility;
      public_stats?: SectionVisibility;
    } = { username: trimmed };
    // A locked section saves as off, whatever it was set to before.
    update.public_bench      = available.bench      ? sections.bench      : 'off';
    update.public_favourites = available.favourites ? sections.favourites : 'off';
    update.public_stats      = available.stats      ? sections.stats      : 'off';
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
    if (saveError) { fail(describeProfileSaveError(saveError)); return; }
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
            <Tabs
              variant="segmented"
              activeTab={tab}
              onTabChange={id => setTab(id as 'details' | 'public')}
              panelClassName="!p-0 !pt-4 !border-0 !bg-transparent !rounded-none"
              tabs={[
                { id: 'details', label: 'Your Details', content: (
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
                ) },
                { id: 'public', label: 'Public Profile', content: (
                  <PublicProfileSettings
                    sections={sections}
                    available={available}
                    onChange={(key, v) => setSections(s => ({ ...s, [key]: v }))}
                    disabled={saving}
                    handle={originalHandle}
                  />
                ) },
              ]}
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
