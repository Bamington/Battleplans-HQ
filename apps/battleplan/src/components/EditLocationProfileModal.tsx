/**
 * EditLocationProfileModal — a venue or club admin edits its public profile
 *
 * Opened from "Edit Store Profile" / "Edit Club Profile" in the user menu while
 * that location is selected. Name, logo and @profile name, plus the page's
 * switches (Store Stats, for now). The richer profile fields (about, contact,
 * photos…) will land here too. Opening hours aren't edited here: they come from
 * the venue's timeslots and tables in Manage Store.
 *
 * Saves through `update_location_profile`, which touches only these columns:
 * venue admins have no UPDATE on `locations` itself. The logo goes to
 * `location-icons/<location id>/…`, the one folder a venue admin may write to.
 *
 * Like Edit Profile, the logo is cropped locally and only uploaded on Save, so
 * abandoning the form leaves nothing behind in storage.
 */

import { useEffect, useState } from 'react';
import {
  supabase, Modal, Button, Input, AvatarPicker, Checkbox,
  normaliseHandle, validateHandle, isHandleAvailable, HANDLE_MAX_LENGTH,
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

const ICON_BUCKET = 'location-icons';

async function uploadLogo(locationId: string, blob: Blob): Promise<string> {
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
  const noun = location.kind === 'club' ? 'Club' : 'Store';

  const [name,        setName]        = useState(location.name);
  const [slug,        setSlug]        = useState(location.slug ?? '');
  // undefined = untouched, Blob = new logo to upload, null = remove it.
  const [pendingLogo, setPendingLogo] = useState<Blob | null | undefined>(undefined);
  // null until location_profiles has been read; a missing row means off.
  const [showStats,   setShowStats]   = useState<boolean | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Reset to the stored values each time it opens, so a cancelled edit
  // doesn't come back next time. Keyed on `open` alone: callers build
  // `location` inline, and resetting on every new object would wipe typing.
  useEffect(() => {
    if (!open) return;
    setName(location.name);
    setSlug(location.slug ?? '');
    setPendingLogo(undefined);
    setError(null);
    setShowStats(null);
    let cancelled = false;
    supabase
      .from('location_profiles')
      .select('show_stats')
      .eq('location_id', location.id)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setShowStats(!!data?.show_stats); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const slugProblem = slug ? validateHandle(slug)?.replace(/Usernames?/g, 'Profile names') ?? null : null;
  // AvatarPicker shows images only; an emoji icon reads as "no picture".
  const currentLogoUrl = location.icon?.startsWith('http') ? location.icon : null;

  async function handleSave() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) { setError(`Please enter the ${noun.toLowerCase()}'s name.`); return; }
    if (!slug) { setError('Please choose a profile name.'); return; }
    if (slugProblem) { setError(slugProblem); return; }

    setSaving(true);
    try {
      if (slug !== (location.slug ?? '') && !(await isHandleAvailable(slug, location.id))) {
        setError(`@${slug} is already taken.`);
        return;
      }

      let icon = location.icon ?? '';
      if (pendingLogo instanceof Blob) icon = await uploadLogo(location.id, pendingLogo);
      else if (pendingLogo === null)   icon = '';

      const { error: rpcError } = await supabase.rpc('update_location_profile', {
        p_location: location.id,
        p_name:     trimmed,
        p_icon:     icon,
        p_slug:     slug,
        // null = not loaded yet, so leave whatever is stored alone.
        p_show_stats: showStats,
      });
      if (rpcError) {
        setError(
          rpcError.code === '23505' ? `@${slug} was just taken. Please choose another.`
          : rpcError.code === '23514' ? 'That profile name isn’t valid. Use 3–24 letters, numbers, - or _.'
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

  return (
    <Modal open={open} onClose={saving ? () => {} : onClose} className="max-w-md">
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

          <div className="flex flex-col gap-2">
            <p className="font-heading text-xs uppercase tracking-wide text-gray-400">On your page</p>
            <Checkbox
              label={`Show ${noun} Stats`}
              helperText="Your most-booked games and busiest days, from the last 12 months of table bookings. Only appears once you have 10 or more."
              checked={!!showStats}
              disabled={saving || showStats === null}
              onChange={e => setShowStats(e.target.checked)}
            />
          </div>

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
            <Button type="submit" className="flex-1" disabled={saving || !!slugProblem}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
