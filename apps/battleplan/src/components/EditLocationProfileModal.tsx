/**
 * EditLocationProfileModal — a venue or club admin edits its public profile
 *
 * Opened from "Edit Store Profile" / "Edit Club Profile" in the user menu while
 * that location is selected. Stores and clubs get the same editor; a club also
 * gets its public switch and a Venues tab.
 *
 *   Details — logo, name, @profile name, founded year, (club) public page,
 *             Store/Club Stats
 *   Page    — cover image, About, links (the first is the page's main button
 *             when there's no booking)
 *   Rules   — House Rules / Code of Conduct, and a link to the full version
 *   Venues  — clubs only: where the club plays, and which is home
 *
 * Opening hours and events aren't edited here: hours come from the venue's
 * timeslots and tables in Manage Store, events from BattlePack.
 *
 * Saves through `update_location_profile`, which touches only these columns:
 * venue admins have no UPDATE on `locations` itself. Images go to
 * `location-icons/<location id>/…`, the one folder a venue admin may write to.
 *
 * Like Edit Profile, images are cropped locally and only uploaded on Save, so
 * abandoning the form leaves nothing behind in storage.
 */

import { useEffect, useState } from 'react';
import {
  supabase, Modal, Button, Input, AvatarPicker, BannerPicker, Checkbox, Tabs,
  RichTextEditor, SearchSelect, EditableListItem, Badge,
  normaliseHandle, validateHandle, isHandleAvailable, HANDLE_MAX_LENGTH,
  type PendingBanner,
} from '@battleplans/ui';

export interface EditableLocationProfile {
  id:    string;
  name:  string;
  /** Image URL, emoji, or empty. */
  icon:  string | null;
  slug:  string | null;
  kind?: 'venue' | 'club' | 'space';
}

export interface EditLocationProfileModalProps {
  open: boolean;
  onClose: () => void;
  location: EditableLocationProfile;
  /** Fires after a successful save with the values now stored. */
  onSaved?: (updated: EditableLocationProfile) => void;
}

interface LinkRow  { key: string; label: string; url: string }
interface VenueRow { id: string; name: string; address: string | null; home: boolean }
interface VenueOption { id: string; name: string; address: string | null }

/** What location_profiles holds, as the form edits it. */
interface ProfileForm {
  show_stats:   boolean;
  is_public:    boolean;
  about:        string;
  cover_url:    string | null;
  cover_aspect: number | null;
  founded_year: string;
  links:        LinkRow[];
  rules:        string;
  rules_url:    string;
}

const EMPTY_FORM: ProfileForm = {
  show_stats: false, is_public: false, about: '', cover_url: null, cover_aspect: null,
  founded_year: '', links: [], rules: '', rules_url: '',
};

const ICON_BUCKET = 'location-icons';
const MAX_LINKS   = 8;
const MAX_VENUES  = 10;
const URL_RE      = /^https?:\/\/\S+$/i;

let linkSeq = 0;
const newLinkKey = () => `link-${++linkSeq}`;

async function uploadImage(locationId: string, blob: Blob): Promise<string> {
  // A fresh name every time: no CDN staleness, and the old file is left alone.
  const path = `${locationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage
    .from(ICON_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return supabase.storage.from(ICON_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Up to two initials from the name, for the logo placeholder. */
function initialsOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?';
}

export default function EditLocationProfileModal({ open, onClose, location, onSaved }: EditLocationProfileModalProps) {
  const isClub = location.kind === 'club';
  const noun = isClub ? 'Club' : 'Store';

  const [name,         setName]         = useState(location.name);
  const [slug,         setSlug]         = useState(location.slug ?? '');
  // undefined = untouched, Blob = new logo to upload, null = remove it.
  const [pendingLogo,  setPendingLogo]  = useState<Blob | null | undefined>(undefined);
  const [pendingCover, setPendingCover] = useState<PendingBanner | null | undefined>(undefined);
  const [form,         setForm]         = useState<ProfileForm>(EMPTY_FORM);
  const [venues,       setVenues]       = useState<VenueRow[]>([]);
  const [venueOptions, setVenueOptions] = useState<VenueOption[]>([]);
  // False until location_profiles (and, for a club, its venues) have loaded.
  // Saving before then would write the blank form over what's stored.
  const [loaded,       setLoaded]       = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const patch = (p: Partial<ProfileForm>) => setForm(f => ({ ...f, ...p }));

  // Reset to the stored values each time it opens, so a cancelled edit
  // doesn't come back next time. Keyed on `open` alone: callers build
  // `location` inline, and resetting on every new object would wipe typing.
  useEffect(() => {
    if (!open) return;
    setName(location.name);
    setSlug(location.slug ?? '');
    setPendingLogo(undefined);
    setPendingCover(undefined);
    setForm(EMPTY_FORM);
    setVenues([]);
    setError(null);
    setLoaded(false);
    let cancelled = false;

    (async () => {
      const [{ data: lp, error: lpError }, clubVenues, options] = await Promise.all([
        supabase
          .from('location_profiles')
          .select('show_stats, is_public, about, cover_url, cover_aspect, founded_year, links, rules, rules_url')
          .eq('location_id', location.id)
          .maybeSingle(),
        isClub
          ? supabase
              .from('club_venues')
              .select('is_home, venue:locations!club_venues_venue_id_fkey(id, name, address)')
              .eq('club_id', location.id)
          : Promise.resolve({ data: [], error: null }),
        isClub
          ? supabase.from('locations').select('id, name, address').eq('kind', 'venue').order('name')
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (cancelled) return;
      if (lpError || clubVenues.error) {
        setError('Couldn’t load the profile. Close this and try again.');
        return;
      }
      if (lp) {
        setForm({
          show_stats:   !!lp.show_stats,
          is_public:    !!lp.is_public,
          about:        lp.about ?? '',
          cover_url:    lp.cover_url,
          cover_aspect: lp.cover_aspect,
          founded_year: lp.founded_year ? String(lp.founded_year) : '',
          links:        ((lp.links ?? []) as { label: string; url: string }[]).map(l => ({ key: newLinkKey(), ...l })),
          rules:        lp.rules ?? '',
          rules_url:    lp.rules_url ?? '',
        });
      }
      type ClubVenue = { is_home: boolean; venue: VenueOption | VenueOption[] | null };
      setVenues(((clubVenues.data ?? []) as ClubVenue[]).flatMap(cv => {
        const v = Array.isArray(cv.venue) ? cv.venue[0] : cv.venue;
        return v ? [{ id: v.id, name: v.name, address: v.address, home: cv.is_home }] : [];
      }).sort((a, b) => Number(b.home) - Number(a.home) || a.name.localeCompare(b.name)));
      setVenueOptions((options.data ?? []) as VenueOption[]);
      setLoaded(true);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const slugProblem = slug ? validateHandle(slug)?.replace(/Usernames?/g, 'Profile names') ?? null : null;
  // AvatarPicker shows images only; an emoji icon reads as "no picture".
  const currentLogoUrl = location.icon?.startsWith('http') ? location.icon : null;

  // ── Links ──
  const setLink = (key: string, p: Partial<LinkRow>) =>
    patch({ links: form.links.map(l => (l.key === key ? { ...l, ...p } : l)) });
  const moveLink = (i: number, delta: -1 | 1) => {
    const links = [...form.links];
    [links[i], links[i + delta]] = [links[i + delta], links[i]];
    patch({ links });
  };

  // ── Venues ──
  const addVenue = (id: string) => {
    const v = venueOptions.find(o => o.id === id);
    if (!v || venues.some(x => x.id === id)) return;
    setVenues([...venues, { ...v, home: venues.length === 0 }]);
  };
  const setHome = (id: string) => setVenues(venues.map(v => ({ ...v, home: v.id === id ? !v.home : false })));

  async function handleSave() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) { setError(`Please enter the ${noun.toLowerCase()}'s name.`); return; }
    if (!slug) { setError('Please choose a profile name.'); return; }
    if (slugProblem) { setError(slugProblem); return; }
    const year = form.founded_year.trim();
    if (year && !/^(19|20)\d\d$/.test(year)) { setError('Founded should be a year, like 2022.'); return; }
    const links = form.links.filter(l => l.url.trim());
    const badLink = links.find(l => !URL_RE.test(l.url.trim()));
    if (badLink) { setError(`“${badLink.url}” isn’t a web address. Links start with https://`); return; }
    if (form.rules_url.trim() && !URL_RE.test(form.rules_url.trim())) {
      setError('The rules link should start with https://'); return;
    }

    setSaving(true);
    try {
      if (slug !== (location.slug ?? '') && !(await isHandleAvailable(slug, location.id))) {
        setError(`@${slug} is already taken.`);
        return;
      }

      let icon = location.icon ?? '';
      if (pendingLogo instanceof Blob) icon = await uploadImage(location.id, pendingLogo);
      else if (pendingLogo === null)   icon = '';

      let coverUrl    = form.cover_url;
      let coverAspect = form.cover_aspect;
      if (pendingCover) {
        coverUrl    = await uploadImage(location.id, pendingCover.blob);
        coverAspect = pendingCover.aspect;
      } else if (pendingCover === null) {
        coverUrl = null; coverAspect = null;
      }

      const profile: Record<string, unknown> = {
        about:        form.about,
        cover_url:    coverUrl ?? '',
        cover_aspect: coverAspect,
        founded_year: year,
        links:        links.map(l => ({ label: l.label.trim(), url: l.url.trim() })),
        rules:        form.rules,
        rules_url:    form.rules_url.trim(),
      };
      if (isClub) {
        profile.is_public = form.is_public;
        profile.venues    = venues.map(v => ({ id: v.id, home: v.home }));
      }

      const { error: rpcError } = await supabase.rpc('update_location_profile', {
        p_location:   location.id,
        p_name:       trimmed,
        p_icon:       icon,
        p_slug:       slug,
        p_show_stats: form.show_stats,
        p_profile:    profile,
      });
      if (rpcError) {
        setError(
          rpcError.code === '23505' ? `@${slug} was just taken. Please choose another.`
          : rpcError.code === '23514' ? rpcError.message
          : rpcError.message,
        );
        return;
      }

      onSaved?.({ ...location, name: trimmed, icon: icon || null, slug });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong saving the profile.');
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || !loaded;
  const rulesTitle = isClub ? 'Code of Conduct' : 'House Rules';

  const detailsTab = (
    <div className="flex flex-col gap-4">
      <AvatarPicker
        label="Logo"
        currentUrl={currentLogoUrl}
        initials={initialsOf(name || location.name)}
        onChange={setPendingLogo}
        disabled={saving}
      />

      <Input
        label="Name"
        value={name}
        onChange={e => setName(e.target.value)}
        disabled={saving}
        required
      />

      <Input
        label="Profile name"
        value={slug}
        onChange={e => setSlug(normaliseHandle(e.target.value))}
        maxLength={HANDLE_MAX_LENGTH}
        disabled={saving}
        required
        state={slugProblem ? 'error' : 'default'}
        leftIcon={<span className="font-body text-sm text-gray-400">@</span>}
        helperText={slugProblem ?? `Your page lives at /@${slug || '…'}`}
      />

      <Input
        label="Founded"
        value={form.founded_year}
        onChange={e => patch({ founded_year: e.target.value.replace(/\D/g, '').slice(0, 4) })}
        inputMode="numeric"
        placeholder="e.g. 2022"
        disabled={busy}
        helperText="Shown as “Est. 2022” under the name. Optional."
      />

      <div className="flex flex-col gap-3">
        <p className="font-heading text-xs uppercase tracking-wide text-gray-400">On your page</p>
        {isClub && (
          <Checkbox
            label="Public page"
            helperText="Anyone with the link can see this club’s page. Off, and only your members and organisers can."
            checked={form.is_public}
            disabled={busy}
            onChange={e => patch({ is_public: e.target.checked })}
          />
        )}
        <Checkbox
          label={`Show ${noun} Stats`}
          helperText="Your most-booked games and busiest days, from the last 12 months of table bookings. Only appears once you have 10 or more."
          checked={form.show_stats}
          disabled={busy}
          onChange={e => patch({ show_stats: e.target.checked })}
        />
      </div>
    </div>
  );

  const pageTab = (
    <div className="flex flex-col gap-4">
      <BannerPicker
        label="Cover image"
        currentUrl={form.cover_url}
        currentAspect={form.cover_aspect}
        minAspect={3 / 2}
        hint={isClub ? 'A photo from one of your events works well.' : 'Your shopfront or gaming room.'}
        onChange={setPendingCover}
        disabled={busy}
      />

      <div className="flex flex-col gap-2">
        <p className="font-body text-sm font-medium text-white">About</p>
        <RichTextEditor
          value={form.about}
          onChange={about => patch({ about })}
          placeholder={isClub
            ? 'Who you are, what you play, and who’s welcome.'
            : 'What the shop is, what you stock, and what goes on in the gaming room.'}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-col">
          <p className="font-body text-sm font-medium text-white">Links</p>
          <p className="font-body text-xs text-gray-400">
            {isClub
              ? 'Discord, website, socials. The first is your page’s main button — “Join our Discord”, say.'
              : 'Website, online shop, socials, Discord.'}
          </p>
        </div>
        {form.links.map((l, i) => (
          <EditableListItem
            key={l.key}
            index={i}
            count={form.links.length}
            header={i === 0 && isClub ? <Badge color="primary">Main button</Badge> : null}
            onMove={delta => moveLink(i, delta)}
            onRemove={() => patch({ links: form.links.filter(x => x.key !== l.key) })}
            removeLabel={`Remove link ${i + 1}`}
            disabled={busy}
          >
            <Input
              size="sm"
              placeholder={i === 0 && isClub ? 'Join our Discord' : 'Label, e.g. Instagram'}
              value={l.label}
              maxLength={40}
              onChange={e => setLink(l.key, { label: e.target.value })}
              disabled={busy}
            />
            <Input
              size="sm"
              placeholder="https://"
              value={l.url}
              onChange={e => setLink(l.key, { url: e.target.value })}
              disabled={busy}
              state={l.url.trim() && !URL_RE.test(l.url.trim()) ? 'error' : 'default'}
            />
          </EditableListItem>
        ))}
        {form.links.length < MAX_LINKS && (
          <Button
            size="xs"
            variant="outline"
            color="secondary"
            className="self-start"
            disabled={busy}
            onClick={() => patch({ links: [...form.links, { key: newLinkKey(), label: '', url: '' }] })}
          >
            Add link
          </Button>
        )}
      </div>
    </div>
  );

  const rulesTab = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col">
          <p className="font-body text-sm font-medium text-white">{rulesTitle}</p>
          <p className="font-body text-xs text-gray-400">
            {isClub
              ? 'How you expect people to play and behave, at your events and online.'
              : 'Gaming-room rules — painted models, food and drink, how to behave.'}
          </p>
        </div>
        <RichTextEditor value={form.rules} onChange={rules => patch({ rules })} placeholder="Be kind. Roll dice where everyone can see them…" />
      </div>
      <Input
        label="Link to the full version"
        placeholder="https://"
        value={form.rules_url}
        onChange={e => patch({ rules_url: e.target.value })}
        disabled={busy}
        state={form.rules_url.trim() && !URL_RE.test(form.rules_url.trim()) ? 'error' : 'default'}
        helperText="Optional. For when the whole thing lives on your website."
      />
    </div>
  );

  const venuesTab = (
    <div className="flex flex-col gap-3">
      <p className="font-body text-xs text-gray-400">
        The stores you play at. Your page lists them under Where We Play, and if your page is
        public, each store’s page lists you under Clubs That Play Here. Stores where you’ve run a
        BattlePack event are added automatically.
      </p>
      {venues.map((v, i) => (
        <EditableListItem
          key={v.id}
          index={i}
          count={venues.length}
          header={
            <div className="flex flex-col min-w-0">
              <span className="font-body text-sm text-white truncate">{v.name}</span>
              {v.address && <span className="font-body text-xs text-gray-400 truncate">{v.address}</span>}
            </div>
          }
          onRemove={() => setVenues(venues.filter(x => x.id !== v.id))}
          removeLabel={`Remove ${v.name}`}
          disabled={busy}
        >
          <Checkbox
            label="Home venue"
            checked={v.home}
            disabled={busy}
            onChange={() => setHome(v.id)}
          />
        </EditableListItem>
      ))}
      {venues.length < MAX_VENUES && (
        <SearchSelect
          label={venues.length ? 'Add another store' : 'Add a store'}
          placeholder="Choose a store"
          searchPlaceholder="Search stores…"
          value=""
          onChange={addVenue}
          disabled={busy}
          options={venueOptions
            .filter(o => o.id !== location.id && !venues.some(v => v.id === o.id))
            .map(o => ({ value: o.id, label: o.address ? `${o.name} — ${o.address}` : o.name }))}
          emptyLabel="No stores match"
        />
      )}
    </div>
  );

  return (
    <Modal open={open} onClose={saving ? () => {} : onClose} className="max-w-lg">
      <div className="p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-white text-[19.8px] leading-7 tracking-[-0.5px]">
            {noun} profile
          </h1>
          <p className="font-body text-base text-gray-300 leading-6">
            What people see on {location.name}’s profile page.
          </p>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={e => { e.preventDefault(); handleSave(); }}
        >
          <Tabs
            variant="segmented"
            panelClassName="pt-4"
            tabs={[
              { id: 'details', label: 'Details', content: detailsTab },
              { id: 'page',    label: 'Page',    content: pageTab },
              { id: 'rules',   label: 'Rules',   content: rulesTab },
              ...(isClub ? [{ id: 'venues', label: 'Venues', content: venuesTab }] : []),
            ]}
          />

          {error && <p className="font-body text-sm text-red-400">{error}</p>}

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
            <Button type="submit" className="flex-1" disabled={busy || !!slugProblem}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
