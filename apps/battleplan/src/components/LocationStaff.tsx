import { useEffect, useState } from 'react';
import {
  supabase, Button, Modal, Dropdown, DropdownItem, Input, Avatar, avatarUrl,
  TrashBinMinimalistic, ArrowRight, UserRounded,
} from '@battleplans/ui';
import type { StaffMember } from '../hooks/useBookingData';

// ── Icons ─────────────────────────────────────────────────────────────────────

const MenuDotsIcon = () => (
  <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="3" r="1.2"/>
    <circle cx="8" cy="8" r="1.2"/>
    <circle cx="8" cy="13" r="1.2"/>
  </svg>
);

/** Column header icon — two figures, matching the other Manage Store columns. */
export const StaffIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="19" cy="15" r="7" stroke="currentColor" strokeWidth="2.5"/>
    <path d="M6 39c0-6.6 5.8-11 13-11s13 4.4 13 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M33 9.7a7 7 0 0 1 0 10.6M36 28.9c3.6 1.6 6 4.6 6 8.1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Their real name where the venue is entitled to it, else their @handle.
 * Only a venue's own admins get the name — see 20260812050000.
 */
export function staffLabel(s: StaffMember): string {
  return s.username?.trim() || (s.handle ? `@${s.handle}` : 'Unknown user');
}

function initialsFor(s: StaffMember): string {
  return (s.username?.trim() || s.handle || '?').slice(0, 2).toUpperCase();
}

// ── StaffItem ─────────────────────────────────────────────────────────────────

export function StaffItem({ member, locationId, locationName, onChanged }: {
  member: StaffMember;
  locationId: string;
  locationName: string;
  onChanged: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing,    setRemoving]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);
    const { error: delErr } = await supabase
      .from('location_staff')
      .delete()
      .eq('location_id', locationId)
      .eq('user_id', member.userId);
    setRemoving(false);
    if (delErr) { setError(delErr.message); return; }
    setConfirmOpen(false);
    onChanged();
  };

  const url = avatarUrl(member.avatarPath);

  return (
    <>
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] flex gap-2.5 items-center shadow-md">

        <Avatar
          src={url ?? undefined}
          initials={initialsFor(member)}
          size="lg"
          alt=""
          className="shrink-0"
        />

        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-heading text-lg text-white leading-6 truncate">{staffLabel(member)}</span>
          {/* The handle underneath, but only when the line above isn't already
              it — two identical lines would just look like a rendering fault. */}
          {member.handle && member.username?.trim() && (
            <span className="font-body text-xs text-neutral-400 leading-4 truncate">@{member.handle}</span>
          )}
          <span className="font-body text-xs text-primary-300 leading-4">Staff</span>
        </div>

        <Dropdown
          align="right"
          trigger={
            <button type="button" className="p-1 opacity-50 hover:opacity-100 transition-opacity shrink-0">
              <MenuDotsIcon />
            </button>
          }
        >
          <DropdownItem
            icon={<TrashBinMinimalistic className="w-4 h-4 text-red-400" />}
            onClick={() => { setError(null); setConfirmOpen(true); }}
          >
            <span className="text-red-400">Remove</span>
          </DropdownItem>
        </Dropdown>

      </div>

      <Modal open={confirmOpen} onClose={() => !removing && setConfirmOpen(false)}>
        <div className="flex flex-col gap-3 p-5">
          <TrashBinMinimalistic className="w-8 h-8 text-primary-500" />
          <h2 className="font-heading text-xl text-white">Remove Staff Member</h2>
          <p className="font-body text-base text-neutral-300">
            {staffLabel(member)} will no longer see bookings at {locationName}. Their own
            bookings and account aren’t affected.
          </p>
          {error && <p className="font-body text-sm text-red-400">{error}</p>}
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button variant="ghost" size="sm" disabled={removing} onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              color="danger"
              size="sm"
              loading={removing}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={handleRemove}
            >
              Yes, Remove
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ── AddStaffModal ─────────────────────────────────────────────────────────────

/** What the lookup RPC hands back for a matched person. */
interface FoundUser {
  user_id:  string;
  handle:   string | null;
  username: string | null;
}

export function AddStaffModal({
  open, onClose, locationId, locationName, existingIds, adminIds, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  locationId: string;
  locationName: string;
  /** Already on the roster — so we can say so instead of failing on the PK. */
  existingIds: string[];
  /** Venue admins — already have more access than staff, so adding them is a no-op. */
  adminIds: string[];
  onSaved: () => void;
}) {
  const [identifier, setIdentifier] = useState('');
  const [found,      setFound]      = useState<FoundUser | null>(null);
  const [searched,   setSearched]   = useState(false);
  const [searching,  setSearching]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIdentifier(''); setFound(null); setSearched(false); setError(null);
  }, [open]);

  // A new search invalidates whatever the last one turned up.
  const handleIdentifierChange = (v: string) => {
    setIdentifier(v);
    setFound(null); setSearched(false); setError(null);
  };

  const handleSearch = async () => {
    const needle = identifier.trim();
    if (!needle) return;
    setSearching(true);
    setError(null);
    setFound(null);

    // Email isn't in public_profiles by design, so matching one needs the
    // security-definer RPC. See 20260811020000.
    const { data, error: rpcErr } = await supabase
      .rpc('lookup_user_for_venue', { identifier: needle });

    setSearching(false);
    setSearched(true);
    if (rpcErr) { setError(rpcErr.message); return; }
    setFound(((data as FoundUser[] | null) ?? [])[0] ?? null);
  };

  const alreadyStaff = !!found && existingIds.includes(found.user_id);
  const alreadyAdmin = !!found && adminIds.includes(found.user_id);
  const canAdd       = !!found && !alreadyStaff && !alreadyAdmin && !saving;

  const handleAdd = async () => {
    if (!found) return;
    setSaving(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const { error: insErr } = await supabase.from('location_staff').insert({
      location_id: locationId,
      user_id:     found.user_id,
      added_by:    session?.user?.id ?? null,
    });
    setSaving(false);
    if (insErr) {
      setError(insErr.code === '23505'
        ? 'They’re already on your staff list.'
        : insErr.message);
      return;
    }
    onSaved();
  };

  const handleClose = () => { if (!saving && !searching) onClose(); };

  const label = found
    ? (found.username?.trim() || (found.handle ? `@${found.handle}` : 'this user'))
    : '';

  return (
    <Modal open={open} onClose={handleClose} className="max-w-md">
      <div className="flex flex-col gap-4 p-5">

        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-xl text-white">Add Staff Member</h2>
          <p className="font-body text-base text-neutral-300">
            Staff can see bookings at {locationName}. They can’t change your
            settings, your tables, or who works here.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Input
            label="Username or Email"
            type="text"
            placeholder="@their-handle or their@email.com"
            leftIcon={<UserRounded className="w-4 h-4" />}
            helperText="They need a BattlePlan account already."
            value={identifier}
            disabled={searching || saving}
            onChange={e => handleIdentifierChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
          />
          <Button
            variant="outline"
            color="primary"
            size="sm"
            className="self-start"
            loading={searching}
            disabled={!identifier.trim() || searching || saving}
            onClick={handleSearch}
          >
            Find User
          </Button>
        </div>

        {searched && !searching && !found && !error && (
          <p className="font-body text-sm text-yellow-400">
            No BattlePlan account matches that handle or email. Check the spelling —
            handles are exact, and the email has to be the one they signed up with.
          </p>
        )}

        {found && (
          <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-3 flex flex-col gap-1">
            <span className="font-heading text-base text-white">{label}</span>
            {found.handle && <span className="font-body text-xs text-neutral-400">@{found.handle}</span>}
            {alreadyAdmin && (
              <span className="font-body text-xs text-yellow-400">
                Already a venue admin here — they can see everything staff can and more.
              </span>
            )}
            {alreadyStaff && (
              <span className="font-body text-xs text-yellow-400">Already on your staff list.</span>
            )}
          </div>
        )}

        {error && <p className="font-body text-sm text-red-400">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-1">
          <Button variant="ghost" color="secondary" size="sm" disabled={saving} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            size="sm"
            loading={saving}
            disabled={!canAdd}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={handleAdd}
          >
            Add Staff
          </Button>
        </div>

      </div>
    </Modal>
  );
}
