/**
 * ClubMembers.tsx — a club's roll.
 *
 * Deliberately the same shape as LocationStaff: a row per person, a menu to
 * remove them, and a find-by-handle-or-email modal to add one. A club admin
 * moves between the two columns without learning anything new.
 *
 * What it is NOT is the same list. Staff and organisers are a few people with
 * powers; members are potentially hundreds with none, and membership only
 * decides which nights they may book — see 20260817000000.
 *
 * There is no join flow yet. A club adds people by hand; browsing clubs and
 * asking to join is a separate thing, and building half of it here would mean
 * guessing at the rest.
 */

import { useEffect, useState } from 'react';
import {
  supabase, Button, Modal, Dropdown, DropdownItem, Input, Avatar, avatarUrl,
  TrashBinMinimalistic, ArrowRight, UserRounded,
} from '@battleplans/ui';
import type { ClubMember } from '../hooks/useBookingData';

const MenuDotsIcon = () => (
  <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="3" r="1.2"/>
    <circle cx="8" cy="8" r="1.2"/>
    <circle cx="8" cy="13" r="1.2"/>
  </svg>
);

/** Column header icon — a membership card, matching the other columns' weight. */
export const MembersIcon = () => (
  <svg className="w-12 h-12 text-primary-500" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="10" width="38" height="28" rx="3" stroke="currentColor" strokeWidth="2.5"/>
    <circle cx="17" cy="22" r="5" stroke="currentColor" strokeWidth="2.5"/>
    <path d="M9 33c0-3.9 3.6-6.5 8-6.5s8 2.6 8 6.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M30 20h9M30 27h9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

/** Their real name where the club is entitled to it, else their @handle. */
export function memberLabel(m: ClubMember): string {
  return m.username?.trim() || (m.handle ? `@${m.handle}` : 'Unknown user');
}

// ── MemberItem ────────────────────────────────────────────────────────────────

export function MemberItem({ member, locationId, clubName, onChanged }: {
  member: ClubMember;
  locationId: string;
  clubName: string;
  onChanged: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing,    setRemoving]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);
    const { error: delErr } = await supabase
      .from('location_members')
      .delete()
      .eq('location_id', locationId)
      .eq('user_id', member.userId);
    setRemoving(false);
    if (delErr) { setError(delErr.message); return; }
    setConfirmOpen(false);
    onChanged();
  };

  return (
    <>
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-[13px] flex gap-2.5 items-center shadow-md">

        <Avatar
          src={avatarUrl(member.avatarPath) ?? undefined}
          initials={(member.username?.trim() || member.handle || '?').slice(0, 2).toUpperCase()}
          size="lg"
          alt=""
          className="shrink-0"
        />

        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-heading text-lg text-white leading-6 truncate">{memberLabel(member)}</span>
          {/* The handle underneath, but only when the line above isn't already
              it — two identical lines would just look like a rendering fault. */}
          {member.handle && member.username?.trim() && (
            <span className="font-body text-xs text-neutral-400 leading-4 truncate">@{member.handle}</span>
          )}
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

      <Modal open={confirmOpen} onClose={() => !removing && setConfirmOpen(false)} className="max-w-xs">
        <div className="flex flex-col gap-3 p-5">
          <TrashBinMinimalistic className="w-8 h-8 text-primary-500" />
          <h2 className="font-heading text-xl text-white">Remove Member</h2>
          <p className="font-body text-base text-neutral-300">
            {memberLabel(member)} will no longer be able to book {clubName}’s members-only
            nights. Bookings they’ve already made are kept.
          </p>
          {error && <p className="font-body text-sm text-red-400">{error}</p>}
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button variant="ghost" color="secondary" size="sm" disabled={removing} onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button color="danger" size="sm" loading={removing} onClick={handleRemove}>
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ── AddMemberModal ────────────────────────────────────────────────────────────

/** Shape returned by lookup_user_for_venue. */
type FoundUser = {
  user_id:  string;
  handle:   string | null;
  username: string | null;
};

export function AddMemberModal({ open, onClose, locationId, clubName, existingIds, onSaved }: {
  open: boolean;
  onClose: () => void;
  locationId: string;
  clubName: string;
  /** Already on the roll — so we can say so instead of failing on the PK. */
  existingIds: string[];
  onSaved: () => void;
}) {
  const [identifier, setIdentifier] = useState('');
  const [searching,  setSearching]  = useState(false);
  const [searched,   setSearched]   = useState(false);
  const [found,      setFound]      = useState<FoundUser | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIdentifier(''); setFound(null); setSearched(false); setError(null);
  }, [open]);

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
    // security-definer RPC — the same one the staff list uses.
    const { data, error: rpcErr } = await supabase
      .rpc('lookup_user_for_venue', { identifier: needle });

    setSearching(false);
    setSearched(true);
    if (rpcErr) { setError(rpcErr.message); return; }
    setFound(((data as FoundUser[] | null) ?? [])[0] ?? null);
  };

  const alreadyMember = !!found && existingIds.includes(found.user_id);
  const canAdd        = !!found && !alreadyMember && !saving;

  const handleAdd = async () => {
    if (!found) return;
    setSaving(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const { error: insErr } = await supabase.from('location_members').insert({
      location_id: locationId,
      user_id:     found.user_id,
      added_by:    session?.user?.id ?? null,
    });
    setSaving(false);
    if (insErr) {
      setError(insErr.code === '23505'
        ? 'They’re already a member.'
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
          <h2 className="font-heading text-xl text-white">Add Member</h2>
          <p className="font-body text-base text-neutral-300">
            Members can book {clubName}’s members-only nights. They can’t change
            anything about the club.
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

        {searched && !found && !error && (
          <p className="font-body text-sm text-neutral-400">
            No account matches that. Check the spelling, or ask them to sign up first.
          </p>
        )}

        {found && (
          <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-3 flex flex-col gap-1">
            <span className="font-heading text-base text-white">{label}</span>
            {alreadyMember && (
              <span className="font-body text-sm text-amber-300">Already a member.</span>
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
            Add Member
          </Button>
        </div>

      </div>
    </Modal>
  );
}
