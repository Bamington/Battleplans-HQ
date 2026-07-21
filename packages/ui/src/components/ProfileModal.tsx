/**
 * ProfileModal.tsx — "Your Profile" settings dialog
 *
 * Opened from the avatar dropdown in the navbar. Lets a signed-in user edit the
 * same details captured during onboarding, using the shared `ProfileFields`:
 *
 *   • Profile picture    — always editable.
 *   • Username           — always editable.
 *   • Preferred location — shown only if the user has ever picked one (i.e. the
 *     stored preferred_location_id is set). BattleCards-only users who never
 *     touched BattlePlan won't see it.
 *
 * Unlike the blocking WelcomeModal, this one is dismissable (Cancel / backdrop).
 * It re-reads the profile each time it opens so it always shows current values.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { avatarUrl, uploadAvatar } from '../lib/avatars';
import Modal from './Modal';
import Button from './Button';
import { ProfileFields, getInitials, type WelcomeLocation } from './WelcomeModal';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the saved username after a successful save (before close). */
  onSaved?: (username: string) => void;
  /**
   * Called after a successful save with the new avatar's public URL (or null if
   * it was removed). Only fires when the picture actually changed.
   */
  onAvatarSaved?: (url: string | null) => void;
}

type Status = 'loading' | 'ready';

export default function ProfileModal({ open, onClose, onSaved, onAvatarSaved }: ProfileModalProps) {
  const [status,              setStatus]              = useState<Status>('loading');
  const [userId,              setUserId]              = useState<string | null>(null);
  const [username,            setUsername]            = useState('');
  const [email,               setEmail]               = useState<string | null>(null);
  const [showLocation,        setShowLocation]        = useState(false);
  const [preferredLocationId, setPreferredLocationId] = useState('');
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
        .select('username, preferred_location_id, avatar_path')
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
      setShowLocation(hasLocation);
      setPreferredLocationId(profile?.preferred_location_id ?? '');
      setSavedAvatarUrl(avatarUrl(profile?.avatar_path));
      setPendingAvatar(undefined);

      if (hasLocation) {
        const { data: locs } = await supabase
          .from('locations')
          .select('id, name')
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
    if (!trimmed) { setError('Please enter a username.'); return; }
    if (showLocation && !preferredLocationId) {
      setError('Please select a preferred location.');
      return;
    }

    setSaving(true);
    const update: {
      username: string;
      preferred_location_id?: string;
      avatar_path?: string | null;
    } = { username: trimmed };
    if (showLocation) update.preferred_location_id = preferredLocationId;

    // Upload first: if storage fails there's nothing to undo, whereas saving the
    // row first could leave avatar_path pointing at an object that never landed.
    let newAvatarUrl: string | null = null;
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
    }

    const { error: saveError } = await supabase
      .from('user_profiles')
      .update(update)
      .eq('id', userId);

    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    onSaved?.(trimmed);
    if (pendingAvatar !== undefined) onAvatarSaved?.(newAvatarUrl);
    onClose();
  }

  if (!open) return null;

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
              showUsername
              showPreferredLocation={showLocation}
              username={username}
              onUsernameChange={setUsername}
              preferredLocationId={preferredLocationId}
              onPreferredLocationChange={setPreferredLocationId}
              locations={locations}
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
