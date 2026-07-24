import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AltArrowLeft from '../icons/AltArrowLeft';
import UsersGroupRounded from '../icons/UsersGroupRounded';
import MenuDots from '../icons/MenuDots';
import Pen2 from '../icons/Pen2';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';
import Badge from '../components/Badge';
import type { BadgeColor } from '../components/Badge';
import Button from '../components/Button';
import Checkbox from '../components/Checkbox';
import Dropdown, { DropdownItem, DropdownDivider } from '../components/Dropdown';
import Modal from '../components/Modal';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import Navbar from '../components/Navbar';
import type { Breadcrumb } from '../components/Navbar';

type UserRow = {
  id:         string;
  email:      string;
  role:       'user' | 'beta_tester' | 'admin';
  /** Public @username. */
  handle:     string | null;
  /** "Your Name" — private display name, shown to admins here. */
  username:   string | null;
  created_at: string;
};

type LocationRow = {
  id:     string;
  name:   string;
  icon:   string | null;
  admins: string[] | null;
};

const ROLE_COLOR: Record<UserRow['role'], BadgeColor> = {
  admin:       'purple',
  beta_tester: 'warning',
  user:        'gray',
};

const ROLE_LABEL: Record<UserRow['role'], string> = {
  admin:       'Admin',
  beta_tester: 'Beta Tester',
  user:        'User',
};

interface ManageUsersPageProps {
  logo?: React.ReactNode;
  /** Breadcrumb trail. Defaults to Home / Admin Tools / Manage Users. */
  breadcrumbs?: Breadcrumb[];
}

const DEFAULT_CRUMBS: Breadcrumb[] = [
  { label: 'Home',        href: '/app' },
  { label: 'Admin Tools', href: '/app/admin' },
  { label: 'Manage Users' },
];

export default function ManageUsersPage({ logo, breadcrumbs = DEFAULT_CRUMBS }: ManageUsersPageProps) {
  const navigate = useNavigate();
  const [users, setUsers]         = useState<UserRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // ── Edit modal state ────────────────────────────────────────────────────────
  const [editTarget, setEditTarget]           = useState<UserRow | null>(null);
  const [editAdmin, setEditAdmin]             = useState(false);
  const [editBeta, setEditBeta]               = useState(false);
  const [editLocationIds, setEditLocationIds] = useState<Set<string>>(new Set());
  const [origLocationIds, setOrigLocationIds] = useState<Set<string>>(new Set());
  const [saving, setSaving]                   = useState(false);
  const [editError, setEditError]             = useState<string | null>(null);

  // ── Delete modal state ──────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchLocations();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_list_users');
    if (error) setError(error.message);
    else setUsers((data ?? []) as UserRow[]);
    setLoading(false);
  }

  async function fetchLocations() {
    const { data } = await supabase
      .from('locations')
      .select('id, name, icon, admins')
      .order('name');
    if (data) setLocations(data as LocationRow[]);
  }

  // ── Edit ────────────────────────────────────────────────────────────────────

  function openEdit(user: UserRow) {
    setEditTarget(user);
    setEditAdmin(user.role === 'admin');
    setEditBeta(user.role === 'beta_tester');
    const adminOf = new Set(
      locations.filter(l => l.admins?.includes(user.id)).map(l => l.id)
    );
    setEditLocationIds(adminOf);
    setOrigLocationIds(adminOf);
    setEditError(null);
  }

  function handleEditAdminChange(checked: boolean) {
    setEditAdmin(checked);
    if (checked) setEditBeta(false);
  }

  function handleEditBetaChange(checked: boolean) {
    setEditBeta(checked);
    if (checked) setEditAdmin(false);
  }

  function resolveRole(): UserRow['role'] {
    if (editAdmin) return 'admin';
    if (editBeta)  return 'beta_tester';
    return 'user';
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    setSaving(true);
    setEditError(null);

    // Update role only if it changed
    const newRole = resolveRole();
    if (newRole !== editTarget.role) {
      const { error: roleError } = await supabase.rpc('admin_update_user_role', {
        target_user_id: editTarget.id,
        new_role: newRole,
      });
      if (roleError) {
        setEditError(roleError.message);
        setSaving(false);
        return;
      }
    }

    // Update location admins — only touch locations where membership changed
    const added   = [...editLocationIds].filter(id => !origLocationIds.has(id));
    const removed = [...origLocationIds].filter(id => !editLocationIds.has(id));

    for (const locId of added) {
      const loc = locations.find(l => l.id === locId);
      if (!loc) continue;
      const next = [...new Set([...(loc.admins ?? []), editTarget.id])];
      const { error } = await supabase.from('locations').update({ admins: next }).eq('id', locId);
      if (error) { setEditError(error.message); setSaving(false); return; }
      setLocations(prev => prev.map(l => l.id === locId ? { ...l, admins: next } : l));
    }

    for (const locId of removed) {
      const loc = locations.find(l => l.id === locId);
      if (!loc) continue;
      const next = (loc.admins ?? []).filter(id => id !== editTarget.id);
      const { error } = await supabase.from('locations').update({ admins: next }).eq('id', locId);
      if (error) { setEditError(error.message); setSaving(false); return; }
      setLocations(prev => prev.map(l => l.id === locId ? { ...l, admins: next } : l));
    }

    setUsers(prev => prev.map(u => u.id === editTarget.id ? { ...u, role: newRole } : u));
    setSaving(false);
    setEditTarget(null);
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  function openDelete(user: UserRow) {
    setDeleteTarget(user);
    setDeleteError(null);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.rpc('admin_delete_user', {
      target_user_id: deleteTarget.id,
    });
    if (error) {
      setDeleteError(error.message);
      setDeleting(false);
      return;
    }
    setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
    setDeleting(false);
    setDeleteTarget(null);
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">

      <Navbar fixed={false} logo={logo} breadcrumbs={breadcrumbs} />

      <div className="flex-1 flex flex-col items-center p-8 pt-10">
        <div className="w-full max-w-2xl flex flex-col gap-6">

          {/* Header */}
          <div className="flex items-center gap-3">
            <UsersGroupRounded className="size-6 text-primary-400 shrink-0" />
            <h1 className="font-heading text-xl text-white">Manage Users</h1>
            {!loading && (
              <span className="font-body text-sm text-neutral-500 ml-auto">
                {users.length} {users.length === 1 ? 'user' : 'users'}
              </span>
            )}
          </div>

          {/* List */}
          <div className="flex flex-col divide-y divide-neutral-800 border border-neutral-800 rounded-xl overflow-hidden">
            {loading && (
              <div className="px-5 py-8 text-center font-body text-sm text-neutral-500">
                Loading…
              </div>
            )}

            {!loading && error && (
              <div className="px-5 py-8 text-center font-body text-sm text-red-400">
                {error}
              </div>
            )}

            {!loading && !error && users.length === 0 && (
              <div className="px-5 py-8 text-center font-body text-sm text-neutral-500">
                No users found.
              </div>
            )}

            {!loading && !error && users.map(u => (
              <div
                key={u.id}
                className="flex items-center gap-4 px-5 py-3.5 bg-neutral-900 hover:bg-neutral-800 transition-colors"
              >
                {/* Avatar initials */}
                <div className="shrink-0 size-8 rounded-sm bg-primary-900 flex items-center justify-center">
                  <span className="font-body font-bold text-xs text-neutral-300 uppercase tracking-wide">
                    {(u.handle ?? u.email)[0]}
                  </span>
                </div>

                {/* @username (real name) over email */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="font-body text-sm truncate">
                    <span className="text-primary-400">@{u.handle ?? '—'}</span>
                    {u.username && <span className="text-white"> ({u.username})</span>}
                  </span>
                  <span className="font-body text-xs text-neutral-500 truncate">{u.email}</span>
                </div>

                {/* Role badge */}
                <Badge color={ROLE_COLOR[u.role]} variant="solid" size="sm">
                  {ROLE_LABEL[u.role]}
                </Badge>

                {/* ⋯ menu */}
                <div
                  onClick={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                >
                  <Dropdown
                    align="right"
                    menuClassName="w-44"
                    trigger={
                      <button
                        type="button"
                        aria-label={`${u.email} options`}
                        className="p-1 opacity-50 hover:opacity-100 transition-opacity text-neutral-300 hover:text-white"
                      >
                        <MenuDots className="size-4" />
                      </button>
                    }
                  >
                    <DropdownItem
                      icon={<Pen2 className="size-4" />}
                      onClick={() => openEdit(u)}
                    >
                      Edit User
                    </DropdownItem>
                    <DropdownDivider />
                    <DropdownItem
                      icon={<TrashBinMinimalistic className="size-4" />}
                      onClick={() => openDelete(u)}
                      className="!text-red-400 hover:!text-red-300"
                    >
                      Delete User
                    </DropdownItem>
                  </Dropdown>
                </div>
              </div>
            ))}
          </div>

          {/* Back */}
          <div className="flex">
            <Button
              variant="outline"
              color="secondary"
              leftIcon={<AltArrowLeft className="size-4" />}
              onClick={() => navigate('/app/admin')}
            >
              Back to Admin Tools
            </Button>
          </div>

        </div>
      </div>

      {/* ── Edit User modal ────────────────────────────────────────────────── */}
      <Modal
        open={editTarget !== null}
        onClose={() => !saving && setEditTarget(null)}
        className="max-w-sm"
      >
        {editTarget && (
          <div className="flex flex-col gap-5 p-5">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-heading text-base text-white">Edit User</h2>
              <p className="font-body text-sm text-neutral-400 truncate">{editTarget.email}</p>
            </div>

            {/* Role */}
            <div className="flex flex-col gap-1">
              <p className="font-body text-xs text-neutral-500 uppercase tracking-wider">Role</p>
              <div className="flex flex-col gap-3 mt-1">
                <Checkbox
                  color="purple"
                  label="Admin"
                  helperText="Full access to admin tools and all content."
                  checked={editAdmin}
                  onChange={e => handleEditAdminChange(e.target.checked)}
                  disabled={saving}
                />
                <Checkbox
                  color="yellow"
                  label="Beta Tester"
                  helperText="Can see games in Beta status."
                  checked={editBeta}
                  onChange={e => handleEditBetaChange(e.target.checked)}
                  disabled={saving}
                />
              </div>
            </div>

            {/* Location admin */}
            {locations.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="font-body text-xs text-neutral-500 uppercase tracking-wider">Location Admin</p>
                <MultiSelectDropdown
                  label=""
                  placeholder="No locations"
                  options={locations.map(l => l.name)}
                  selected={locations.filter(l => editLocationIds.has(l.id)).map(l => l.name)}
                  onChange={names => {
                    const next = new Set(
                      locations.filter(l => names.includes(l.name)).map(l => l.id)
                    );
                    setEditLocationIds(next);
                  }}
                />
              </div>
            )}

            {editError && (
              <p className="font-body text-sm text-red-400">{editError}</p>
            )}

            <div className="flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                color="secondary"
                disabled={saving}
                onClick={() => setEditTarget(null)}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                loading={saving}
                onClick={handleSaveEdit}
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete confirmation modal ──────────────────────────────────────── */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => !deleting && setDeleteTarget(null)}
        className="max-w-xs"
      >
        {deleteTarget && (
          <div className="flex flex-col gap-3 p-5">
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-base text-white">Delete User?</h2>
              <p className="font-body text-sm text-neutral-300">
                This will permanently delete{' '}
                <span className="text-white">{deleteTarget.email}</span> and all
                of their data. This cannot be undone.
              </p>
            </div>

            {deleteError && (
              <p className="font-body text-sm text-red-400">{deleteError}</p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="ghost"
                color="secondary"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                color="danger"
                loading={deleting}
                onClick={handleConfirmDelete}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
