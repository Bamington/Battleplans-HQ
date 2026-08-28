/**
 * WelcomeModal.tsx — The welcome flow: announcements and onboarding
 *
 * A BLOCKING modal shown right after sign-in — no close button, and the
 * backdrop doesn't dismiss it. Every app mounts one, and what it shows is a
 * WELCOME FLOW passed in by that app:
 *
 *   <WelcomeModal appName="BattlePlan" flow={VENUE_REGIONS_FLOW} />
 *
 * A flow is one or more INTRO STEPS, then an OPTIONAL FORM STEP:
 *
 *   { key, steps: [{ title, body, cta }, …], fields?: { username: true, … } }
 *
 * Both halves are optional in practice, and the two combinations are what make
 * this reusable:
 *
 *   steps only          → an announcement. Explains something, asks for
 *                         nothing, records that it was read.
 *   steps + fields      → onboarding. Explains why, then collects it.
 *
 * WHAT MAKES IT REPEATABLE. `key`. It is written to
 * `user_profiles.seen_welcome_flows` when the flow finishes, and it is the only
 * thing deciding whether a user has already been through this one. Each release
 * gets a new key and its own copy; nothing needs a migration, and no release
 * inherits an earlier one's wording. This replaced a hardcoded intro screen
 * behind a single `show_profile_intro` boolean, which could say exactly one
 * thing exactly once — and which, on the next release that used the modal,
 * showed sixty-eight people an announcement about a change from months earlier.
 *
 * TWO REASONS IT OPENS, and they are independent:
 *   1. the flow key is unseen — the announcement half;
 *   2. a required field is missing — the form half, which stands alone so a
 *      user lacking a username is still asked, long after the flow is done.
 * A user in case 2 only skips straight to the form; they are not walked back
 * through copy they have already read.
 *
 * THE FORM ASKS ONLY FOR WHAT IS MISSING. `fields` says what a flow MAY ask
 * for; what any given user actually sees is that list narrowed to what their
 * profile hasn't got (see `asks`). Someone with a name and a home venue,
 * arriving at a flow about locations, gets a country and a postcode and nothing
 * else — a form that asks for more than its intro promised reads as a bait and
 * switch, and re-confirming details the user set months ago is busywork.
 *
 * Two consequences worth knowing:
 *   • the picture and the @handle ride along with the NAME field, not with the
 *     form in general — they are what you offer someone setting up a profile;
 *   • a flow whose fields are ALL already satisfied shows no form at all and
 *     ends on its last intro step, which is what makes an announcement out of a
 *     flow that could have collected something.
 *
 * WRITING A FLOW. Define it beside the app's other constants, not inline in
 * JSX, so the copy is reviewable in one place. See the app CLAUDE.md files for
 * the house rules on when to add one.
 *
 * NAMING — the two name fields cross over between code and interface:
 *
 *   `username` column → labelled "Your Name". Private free text. Only stores
 *                       you book with and friends you accept can see it, which
 *                       is why the copy suggests using a real name.
 *   `handle` column   → labelled "Username". Public, unique, searchable.
 *
 * Each field states its own privacy rule; there is deliberately no general
 * summary line, which would only repeat them less precisely.
 *
 * The profile picture is offered in every app and is always OPTIONAL — it never
 * gates the modal, or a user who simply doesn't want one could never get past
 * it. The same goes for the Username, auto-assigned at signup and offered here
 * only for editing.
 *
 * Data lives on `public.user_profiles` (username, handle, preferred_location_id,
 * country, postcode, avatar_path, seen_welcome_flows). `onboarded` is still
 * written on save for the benefit of the deployed builds that gate on it, and
 * `show_profile_intro` is deliberately no longer read at all.
 *
 * `WelcomeStepView` and `WelcomeModalView` are the presentational halves (used
 * by the component gallery); `WelcomeModal` wraps them with the data-fetching
 * and gating.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { avatarUrl, uploadAvatar } from '../lib/avatars';
import { publishProfileDisplay } from '../lib/profileDisplay';
import { normaliseHandle, validateHandle, describeProfileSaveError } from '../lib/handles';
import { COUNTRIES, normalisePostcode, validatePostcode, regionFor, inRegionOf } from '../lib/regions';
import { useHandleAvailability } from '../hooks/useHandleAvailability';
import Modal from './Modal';
import Input from './Input';
import Select from './Select';
import Button from './Button';
import AvatarPicker from './AvatarPicker';

// ── Field configuration ───────────────────────────────────────────────────────

/**
 * One intro screen.
 *
 * `body` is a list of paragraphs rather than a single string so a flow can bold
 * a phrase or drop a link in without this component parsing anything.
 */
export interface WelcomeStep {
  title: string;
  body: React.ReactNode[];
  /** Button label. Defaults to "Continue". */
  cta?: string;
}

/**
 * A welcome flow — what this modal shows, and what marks it done.
 *
 * ALWAYS at least one intro step. OPTIONALLY a form step after them, when the
 * release needs something back from the user.
 *
 * `key` is the important part. It is written to `seen_welcome_flows` when the
 * flow completes, and it is what stops the flow showing again. Give each
 * release its own key and never reuse one — reusing a key means the new copy is
 * silently withheld from everyone who finished the old flow.
 */
export interface WelcomeFlow {
  /** Stable id, e.g. 'battleplan-venue-regions'. Never reuse across releases. */
  key: string;
  /** One or more intro screens, shown in order. */
  steps: WelcomeStep[];
  /**
   * Heading for the FORM step. Defaults to "Welcome to {appName}".
   *
   * Override it whenever the flow is not a welcome. "Welcome to BattlePlan"
   * over a country and a postcode, shown to somebody who has been booking
   * tables for a year, is not a greeting — it is a component that has forgotten
   * who it is talking to. Matching the intro step's title is usually right.
   */
  formTitle?: string;
  /**
   * The optional form step. Omit for an announcement that asks for nothing.
   *
   * This is what the flow MAY ask for, not what every user is shown — each
   * field is dropped for anyone who already has it, and a user who has them all
   * gets no form step at all.
   */
  fields?: WelcomeModalFields;
}

export interface WelcomeModalFields {
  /** Ask for a chosen username. */
  username?: boolean;
  /** Ask for a preferred booking location (BattlePlan). */
  preferredLocation?: boolean;
  /**
   * Ask for country + postcode, which decide which venues get offered
   * (BattlePlan). See lib/regions.ts for what is done with them.
   */
  homeRegion?: boolean;
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
  /** Raw region columns, so the picker can narrow to the chosen postcode. */
  country?: string | null;
  postcode?: string | null;
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
  /** Show the country + postcode pair that decides which venues are offered. */
  showRegion?: boolean;
  /** Optional like the handle fields below — only meaningful with showRegion. */
  country?: string;
  onCountryChange?: (value: string) => void;
  postcode?: string;
  onPostcodeChange?: (value: string) => void;
  username: string;
  onUsernameChange: (value: string) => void;
  /** Show the unique @handle field. */
  showHandle?: boolean;
  handle?: string;
  onHandleChange?: (value: string) => void;
  /** The handle already saved — used to skip the check when it's unchanged. */
  originalHandle?: string | null;
  /** Signed-in user's id, so their own handle isn't reported as taken. */
  selfId?: string | null;
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
  showRegion = false,
  country = '',
  onCountryChange,
  postcode = '',
  onPostcodeChange,
  username,
  onUsernameChange,
  showHandle = false,
  handle = '',
  onHandleChange,
  originalHandle,
  selfId,
  preferredLocationId,
  onPreferredLocationChange,
  locations,
  error,
  disabled = false,
}: ProfileFieldsProps) {
  const availability = useHandleAvailability(handle, selfId ?? null, originalHandle);

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
          label="Your Name"
          placeholder="Your name"
          value={username}
          onChange={e => onUsernameChange(e.target.value)}
          state={error ? 'error' : 'default'}
          helperText="Use your real name — only stores you book with and friends you accept can see it."
          required
          disabled={disabled}
        />
      )}

      {showHandle && onHandleChange && (
        <Input
          label="Username"
          placeholder="your-username"
          // Input is coerced to the legal alphabet as it's typed. Length is not
          // padded, so a too-short value still needs validateHandle on save.
          value={handle}
          onChange={e => onHandleChange(normaliseHandle(e.target.value))}
          leftIcon={<span className="font-body text-sm text-gray-500">@</span>}
          state={
            availability.status === 'invalid' || availability.status === 'taken' ? 'error'
            : availability.status === 'available' ? 'success'
            : error ? 'error'
            : 'default'
          }
          helperText={
            availability.message
            ?? 'This is public. People can find you by searching for your Username. Letters, numbers, - and _.'
          }
          required
          disabled={disabled}
        />
      )}

      {/* Sits above the venue picker because it decides what that picker
          contains — answering "where are you?" before "which shop?" is the
          order the questions actually depend on each other in. */}
      {showRegion && onCountryChange && onPostcodeChange && (
        <>
          <Select
            label="Country"
            value={country}
            onChange={e => onCountryChange(e.target.value)}
            state={error ? 'error' : 'default'}
            required
            disabled={disabled}
            options={[
              { value: '', label: 'Select a country…' },
              ...COUNTRIES.map(c => ({ value: c.code, label: c.name })),
            ]}
          />
          <Input
            label="Postcode"
            placeholder={country === 'GB' ? 'e.g. SW1A 1AA' : 'e.g. 3065'}
            value={postcode}
            onChange={e => onPostcodeChange(e.target.value)}
            state={error ? 'error' : 'default'}
            helperText="Used to show you venues near you. Never shown to anyone else."
            required
            disabled={disabled}
          />
        </>
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
  showRegion?: boolean;
  country?: string;
  onCountryChange?: (value: string) => void;
  postcode?: string;
  onPostcodeChange?: (value: string) => void;
  /** Heading override. Defaults to "Welcome to {appName}". */
  title?: string;
  /** Adds the "email is only shared with stores" line (BattlePlan). */
  showBookingEmailNote?: boolean;
  username: string;
  onUsernameChange: (value: string) => void;
  showHandle?: boolean;
  handle?: string;
  onHandleChange?: (value: string) => void;
  originalHandle?: string | null;
  selfId?: string | null;
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
  showRegion,
  country,
  onCountryChange,
  postcode,
  onPostcodeChange,
  title,
  showBookingEmailNote = false,
  username,
  onUsernameChange,
  showHandle,
  handle,
  onHandleChange,
  originalHandle,
  selfId,
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
            {title ?? `Welcome to ${appName}`}
          </h1>
          {/* No general privacy summary here — each field carries its own,
              stated precisely and next to the input it applies to. The email
              note stays because no field explains it. */}
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
          showRegion={showRegion}
          country={country}
          onCountryChange={onCountryChange}
          postcode={postcode}
          onPostcodeChange={onPostcodeChange}
          username={username}
          onUsernameChange={onUsernameChange}
          showHandle={showHandle}
          handle={handle}
          onHandleChange={onHandleChange}
          originalHandle={originalHandle}
          selfId={selfId}
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

// ── Intro stage ───────────────────────────────────────────────────────────────
// An intro screen: a title, some paragraphs, and a button that advances. Every
// flow has at least one; the copy comes from the flow definition, never from
// here. See the WelcomeFlow docs above for why.
//
// Multi-step flows show "1 of 3" beneath the button so a reader knows how much
// is left. A single-step flow shows nothing — "1 of 1" is just noise.

const ArrowRightIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden="true">
    <path
      d="M3.333 8h9.334M9.333 4.667 12.667 8l-3.334 3.333"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export interface WelcomeStepViewProps {
  step: WelcomeStep;
  onContinue: () => void;
  /** 1-based position, for the "1 of 3" counter. */
  index?: number;
  /** How many intro steps this flow has. 1 hides the counter. */
  total?: number;
}

export function WelcomeStepView({ step, onContinue, index = 1, total = 1 }: WelcomeStepViewProps) {
  return (
    // Blocking, like the form stage — the backdrop can't dismiss it.
    <Modal open onClose={() => {}} className="max-w-md">
      <div className="p-5 flex flex-col gap-4">
        <h1 className="font-heading text-white text-[19.8px] leading-7 tracking-[-0.5px]">
          {step.title}
        </h1>

        {/* Each entry is its own paragraph. Passing a ReactNode rather than a
            string is what lets a flow bold a phrase mid-sentence without this
            component knowing anything about the copy. */}
        <div className="flex flex-col gap-4 font-body text-base leading-6 text-gray-200">
          {step.body.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
        </div>

        <Button className="w-full" onClick={onContinue} rightIcon={<ArrowRightIcon />}>
          {step.cta ?? 'Continue'}
        </Button>

        {total > 1 && (
          <p className="font-body text-xs text-gray-500 text-center">{index} of {total}</p>
        )}
      </div>
    </Modal>
  );
}

// ── Smart wrapper ─────────────────────────────────────────────────────────────

interface WelcomeModalProps {
  /** Shown in the form step's heading, e.g. "BattleCards". */
  appName: string;
  /** What to show, and what marks it done. */
  flow: WelcomeFlow;
}

type Status = 'loading' | 'needed' | 'done';

export default function WelcomeModal({ appName, flow }: WelcomeModalProps) {
  const fields = flow.fields ?? {};
  const wantUsername = !!fields.username;
  const wantLocation = !!fields.preferredLocation;
  const wantRegion   = !!fields.homeRegion;
  const wantEmailNote = !!fields.bookingEmailNote;

  const [status,              setStatus]              = useState<Status>('loading');
  // Where in the flow we are: an index into flow.steps, or 'form' once the intro
  // steps are done. load() decides the real starting point — a user who has
  // already seen this flow and is only here because a required field is missing
  // starts on the form, since re-reading an announcement they've read would be
  // an odd way to ask them for a postcode.
  const [stage,               setStage]               = useState<number | 'form'>(0);
  const [userId,              setUserId]              = useState<string | null>(null);
  const [username,            setUsername]            = useState('');
  const [handle,              setHandle]              = useState('');
  const [originalHandle,      setOriginalHandle]      = useState<string | null>(null);
  const [email,               setEmail]               = useState<string | null>(null);
  const [preferredLocationId, setPreferredLocationId] = useState('');
  const [country,             setCountry]             = useState('');
  const [postcode,            setPostcode]            = useState('');
  const [locations,           setLocations]           = useState<WelcomeLocation[]>([]);
  const [savedAvatarUrl,      setSavedAvatarUrl]      = useState<string | null>(null);
  // The flow keys already on the profile, kept so handleSave can append to them
  // rather than overwrite the column.
  const [seenWelcomeFlows,    setSeenWelcomeFlows]    = useState<string[]>([]);
  /**
   * Which fields this user is actually asked for — decided once, at load, from
   * what their profile is missing.
   *
   * The flow says what it CAN ask for; this says what it DOES. Someone who
   * already has a name and a home venue, arriving at a flow about locations,
   * gets a form with a country and a postcode on it and nothing else — the form
   * matching what the intro promised is the whole point.
   *
   * Held in state rather than recomputed on render so the form doesn't shrink
   * out from under someone as they fill it in.
   */
  const [asks, setAsks] = useState({ username: false, location: false, region: false });
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
        .select('username, handle, preferred_location_id, country, postcode, avatar_path, onboarded, seen_welcome_flows')
        .eq('id', user.id)
        .single();

      if (cancelled) return;

      const existingUsername = profile?.username ?? '';
      const existingLocation = profile?.preferred_location_id ?? '';
      const existingCountry  = profile?.country ?? '';

      // ── Two independent reasons to open ───────────────────────────────────
      //
      // 1. The flow is UNSEEN. This is the announcement half: everyone who has
      //    not completed this flow key sees it once, whatever their profile
      //    looks like. `show_profile_intro` used to do this job for exactly one
      //    release and is deliberately no longer read — a per-flow key is what
      //    lets a second release say something without inheriting the first
      //    release's copy.
      //
      // 2. A REQUIRED FIELD is missing. This is the form half, and it stands on
      //    its own so a user who somehow lacks a username is asked for it even
      //    though they finished the flow months ago.
      //
      // Neither the picture nor the handle can gate the modal: the picture is
      // optional, and the handle is auto-assigned at signup. Both are offered
      // for editing, but a blocking modal must never hinge on something the
      // user already has or may not want.
      const seenFlows  = (profile?.seen_welcome_flows as string[] | null) ?? [];
      setSeenWelcomeFlows(seenFlows);
      const flowUnseen = !seenFlows.includes(flow.key);

      // What the flow may ask for, narrowed to what this user hasn't got.
      const nextAsks = {
        username: wantUsername && !existingUsername,
        location: wantLocation && !existingLocation,
        region:   wantRegion   && !existingCountry,
      };
      setAsks(nextAsks);

      const missingField = nextAsks.username || nextAsks.location || nextAsks.region;

      if (!flowUnseen && !missingField) { setStatus('done'); return; }

      setUserId(user.id);
      setEmail(user.email ?? null);
      setSavedAvatarUrl(avatarUrl(profile?.avatar_path));
      setHandle(profile?.handle ?? '');
      setOriginalHandle(profile?.handle ?? null);
      // Prefill the username from any value already saved, else the Google
      // display name as an editable starting point.
      const googleName =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        '';
      setUsername(existingUsername || googleName);
      setPreferredLocationId(existingLocation);
      setCountry(existingCountry);
      setPostcode(profile?.postcode ?? '');

      // Only fetch venues if a venue is actually going to be asked for.
      if (nextAsks.location) {
        const { data: locs } = await supabase
          .from('locations')
          .select('id, name, country, postcode')
          .neq('kind', 'space')   // never a home venue — see useLocations
          .order('name');
        if (!cancelled && locs) setLocations(locs as WelcomeLocation[]);
      }

      // Someone here only because a field is missing has already read the
      // intro — send them straight to the form rather than making them click
      // through an announcement again to reach it.
      setStage(flowUnseen && flow.steps.length > 0 ? 0 : 'form');
      setStatus('needed');
    }

    load();
    return () => { cancelled = true; };
  }, [wantUsername, wantLocation]);

  /**
   * Close an announcement-only flow — one with intro steps and no form.
   *
   * Records the key and gets out of the way. Deliberately optimistic: the modal
   * closes first and the write follows, because a failed write here means the
   * user is shown the announcement again next login, which is a far better
   * outcome than trapping them behind a blocking dialog over a note they have
   * already read. The form path is the opposite — it holds the modal open on
   * failure, because there the write is the whole point.
   */
  async function finishWithoutForm() {
    setStatus('done');
    if (!userId) return;
    await supabase
      .from('user_profiles')
      .update({ seen_welcome_flows: [...seenWelcomeFlows, flow.key] })
      .eq('id', userId);
  }

  async function handleSave() {
    if (!userId) return;
    setError(null);

    const trimmedUsername = username.trim();
    if (asks.username && !trimmedUsername) {
      setError('Please enter your name.');
      return;
    }
    if (asks.region && !country) {
      setError('Please choose your country.');
      return;
    }
    if (asks.region) {
      const postcodeError = validatePostcode(country, postcode);
      if (postcodeError) { setError(postcodeError); return; }
    }
    if (asks.location && !preferredLocationId) {
      setError('Please select a preferred location.');
      return;
    }
    // Only when the handle field was on screen — it isn't shown to someone who
    // is only here to add a postcode, so there is nothing to validate.
    if (asks.username) {
      const handleError = validateHandle(handle);
      if (handleError) { setError(handleError); return; }
    }

    setSaving(true);
    const update: {
      username?: string;
      handle?: string;
      preferred_location_id?: string;
      country?: string;
      postcode?: string | null;
      avatar_path?: string | null;
      onboarded?: boolean;
      seen_welcome_flows?: string[];
    } = {};
    if (asks.username) update.username = trimmedUsername;
    if (asks.username && handle !== originalHandle) update.handle = handle;
    if (asks.location) update.preferred_location_id = preferredLocationId;
    if (asks.region) {
      update.country  = country;
      // Stored normalised so "SW1A 1AA" and "sw1a1aa" compare equal later.
      update.postcode = normalisePostcode(postcode);
    }
    // Finishing the flow is what closes it for good. Appending rather than
    // replacing preserves the keys of every earlier flow — the array read at
    // load() is the one being extended here, so a flow completed in another tab
    // in between would be lost, which is a trade worth making against a
    // read-modify-write round trip on every login.
    update.seen_welcome_flows = [...seenWelcomeFlows, flow.key];
    // Still written for the deployed apps, which gate on it and know nothing
    // about flow keys. Harmless once they no longer do.
    update.onboarded = true;

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
    // The Navbar is a sibling of this modal, so it can't be reached by a prop —
    // publishing is what makes the new name and picture appear straight away
    // instead of only after the next page load.
    publishProfileDisplay({ username: trimmedUsername || null, avatarUrl: newAvatarUrl });
    setStatus('done');
  }

  if (status !== 'needed') return null;

  // Whether there is a form step at all. A flow can declare fields and still
  // show no form — if this user already has everything it would ask for, there
  // is nothing to put on it, and the flow ends on its last intro step.
  const wantForm = asks.username || asks.location || asks.region;

  // ── Intro steps ─────────────────────────────────────────────────────────────
  // Advancing past the last one lands on the form, or — for a flow that asks
  // for nothing — finishes the whole thing. An announcement-only flow therefore
  // still records its key, which is what stops it reappearing next login.
  if (typeof stage === 'number') {
    const step = flow.steps[stage];
    // A flow with no steps at all shouldn't reach here (load() sends it to the
    // form), but a stage past the end would render nothing at all — so fall
    // through to the form rather than a blank blocking modal.
    if (step) {
      const isLast = stage === flow.steps.length - 1;
      return (
        <WelcomeStepView
          step={step}
          index={stage + 1}
          total={flow.steps.length}
          onContinue={() => {
            if (!isLast) { setStage(stage + 1); return; }
            if (wantForm) { setStage('form'); return; }
            finishWithoutForm();
          }}
        />
      );
    }
  }

  // Past the intro steps with no form to show — nothing left to render.
  if (!wantForm) return null;

  // Narrow the home-venue list as soon as the postcode is typed, so the two
  // fields visibly answer each other. There is no "show all" escape here: this
  // is a HOME venue, and the one place where the far-away shop genuinely isn't
  // the answer. Anything already saved stays listed regardless, so a user whose
  // stored venue falls outside their region isn't forced to re-pick it here.
  const region = regionFor(country, postcode);
  const offeredLocations = inRegionOf(locations, region)
    .concat(locations.filter(l => l.id === preferredLocationId
                               && !inRegionOf([l], region).length));

  return (
    <WelcomeModalView
      appName={appName}
      // The picture and the @handle ride along with the NAME, not with the form
      // in general. Both are things you offer someone who is setting up a
      // profile; neither belongs on a form whose intro promised to ask for a
      // postcode. Both are optional and never block the save.
      showAvatar={asks.username}
      avatarUrl={savedAvatarUrl}
      avatarInitials={getInitials(username, email)}
      onAvatarChange={setPendingAvatar}
      showUsername={asks.username}
      showPreferredLocation={asks.location}
      showRegion={asks.region}
      country={country}
      onCountryChange={setCountry}
      postcode={postcode}
      onPostcodeChange={setPostcode}
      // The "your email reaches stores" line explains a consequence of booking,
      // which only lands next to the fields booking needs.
      title={flow.formTitle}
      showBookingEmailNote={wantEmailNote && (asks.username || asks.location)}
      username={username}
      onUsernameChange={setUsername}
      showHandle={asks.username}
      handle={handle}
      onHandleChange={setHandle}
      originalHandle={originalHandle}
      selfId={userId}
      preferredLocationId={preferredLocationId}
      onPreferredLocationChange={setPreferredLocationId}
      locations={offeredLocations}
      saving={saving}
      error={error}
      onSave={handleSave}
    />
  );
}
