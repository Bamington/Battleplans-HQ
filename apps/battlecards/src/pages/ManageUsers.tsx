import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@battleplans/ui';
import { Navbar } from '@battleplans/ui';
import { Button } from '@battleplans/ui';
import { Badge } from '@battleplans/ui';
import { Modal } from '@battleplans/ui';
import { Checkbox } from '@battleplans/ui';
import { Dropdown, DropdownItem, DropdownDivider } from '@battleplans/ui';
import type { BadgeColor } from '@battleplans/ui';
import { AltArrowLeft } from '@battleplans/ui';
import { UsersGroupRounded } from '@battleplans/ui';
import { MenuDots } from '@battleplans/ui';
import { Pen2 } from '@battleplans/ui';
import { TrashBinMinimalistic } from '@battleplans/ui';

type UserRow = {
  id:         string;
  email:      string;
  role:       'user' | 'beta_tester' | 'admin';
  created_at: string;
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

export default function ManageUsers() {
  const navigate = useNavigate();
  const [users, setUsers]     = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // ── Edit modal state ────────────────────────────────────────────────────────
  const [editTarget, setEditTarget]     = useState<UserRow | null>(null);
  const [editAdmin, setEditAdmin]       = useState(false);
  const [editBeta, setEditBeta]         = useState(false);
  const [saving, setSaving]             = useState(false);
  const [editError, setEditError]       = useState<string | null>(null);

  // ── Delete modal state ──────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_list_users');
    if (error) { setError(error.message); }
    else        { setUsers((data ?? []) as UserRow[]); }
    setLoading(false);
  }

  // ── Edit ────────────────────────────────────────────────────────────────────

  function openEdit(user: UserRow) {
    setEditTarget(user);
    setEditAdmin(user.role === 'admin');
    setEditBeta(user.role === 'beta_tester');
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
    const newRole = resolveRole();
    const { error } = await supabase.rpc('admin_update_user_role', {
      target_user_id: editTarget.id,
      new_role: newRole,
    });
    if (error) {
      setEditError(error.message);
      setSaving(false);
      return;
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
    <div className="min-h-screen flex flex-col bg-gray-950">

      <Navbar fixed={false} />

      <div className="flex-1 flex flex-col items-center p-8 pt-10">
        <div className="w-full max-w-2xl flex flex-col gap-6">

          {/* Header */}
          <div className="flex items-center gap-3">
            <UsersGroupRounded className="size-6 text-blue-400 shrink-0" />
            <h1 className="font-heading text-xl text-white">Manage Users</h1>
            {!loading && (
              <span className="font-body text-sm text-gray-500 ml-auto">
                {users.length} {users.length === 1 ? 'user' : 'users'}
              </span>
            )}
          </div>

          {/* List */}
          <div className="flex flex-col divide-y divide-gray-800 border border-gray-800 rounded-xl overflow-hidden">
            {loading && (
              <div className="px-5 py-8 text-center font-body text-sm text-gray-500">
                Loading…
              </div>
            )}

            {!loading && error && (
              <div className="px-5 py-8 text-center font-body text-sm text-red-400">
                {error}
              </div>
            )}

            {!loading && !error && users.length === 0 && (
              <div className="px-5 py-8 text-center font-body text-sm text-gray-500">
                No users found.
              </div>
            )}

            {!loading && !error && users.map(u => (
              <div
                key={u.id}
                className="flex items-center gap-4 px-5 py-3.5 bg-gray-900 hover:bg-gray-800 transition-colors"
              >
                {/* Avatar initials */}
                <div className="shrink-0 size-8 rounded-full bg-blue-900 flex items-center justify-center">
                  <span className="font-body font-bold text-xs text-gray-300 uppercase tracking-wide">
                    {u.email[0]}
                  </span>
                </div>

                {/* Email + date */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="font-body text-sm text-white truncate">{u.email}</span>
                  <span className="font-body text-xs text-gray-500">
                    Joined {new Date(u.created_at).toLocaleDateString()}
                  </span>
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
                        className="p-1 opacity-50 hover:opacity-100 transition-opacity text-gray-300 hover:text-white"
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
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-heading text-base text-white">Edit User</h2>
              <p className="font-body text-sm text-gray-400 truncate">{editTarget.email}</p>
            </div>

            <div className="flex flex-col gap-3">
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

            {editError && (
              <p className="font-body text-sm text-red-400">{editError}</p>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
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
              <p className="font-body text-sm text-gray-300">
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
