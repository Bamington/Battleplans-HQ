import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AdminRoute,
  AltArrowLeft,
  Button,
  Dropdown,
  DropdownDivider,
  DropdownItem,
  Home,
  Input,
  Letter,
  MenuDots,
  Modal,
  Pen2,
  SearchSelect,
  TrashBinMinimalistic,
  UploadMinimalistic,
  UsersGroupRounded,
  supabase,
} from '@battleplans/ui';
import AppNavbar from '../../components/AppNavbar';

type LocationRow = {
  id: string;
  name: string;
  address: string;
  icon: string | null;
  store_email: string | null;
  admins: string[] | null;
};

/** Shape returned by the admin_list_users RPC. */
type UserRow = {
  id:    string;
  email: string;
};

type LocationFormState = {
  name: string;
  address: string;    // required — the column is NOT NULL
  icon: string;       // URL or empty string
  store_email: string;
  admins: string[];   // user ids
};

const EMPTY_FORM: LocationFormState = { name: '', address: '', icon: '', store_email: '', admins: [] };

const BattlePlanLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattlePlan</span>
);

// ── Icon upload widget ──────────────────────────────────────────────────────

interface IconUploadProps {
  name: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

function IconUpload({ name, value, onChange, disabled }: IconUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const isUrl = value.startsWith('http');
  const preview = isUrl ? value : null;
  const initial = name?.[0]?.toUpperCase() ?? '?';

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);

    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('location-icons')
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      setUploadError(uploadErr.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('location-icons').getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
    // Reset so the same file can be re-selected if needed
    e.target.value = '';
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="font-body text-xs text-neutral-500 uppercase tracking-wider">Icon</p>
      <div className="flex items-center gap-4 mt-1">
        {/* Preview */}
        <div className="shrink-0 size-16 rounded-xl overflow-hidden bg-neutral-800 flex items-center justify-center">
          {preview ? (
            <img src={preview} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="font-heading text-xl text-primary-300">{initial}</span>
          )}
        </div>

        {/* Upload button + error */}
        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            variant="outline"
            color="secondary"
            size="sm"
            leftIcon={<UploadMinimalistic className="size-3.5" />}
            loading={uploading}
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {preview ? 'Replace image' : 'Upload image'}
          </Button>
          <p className="font-body text-xs text-neutral-600">JPG, PNG or WebP · max 2 MB</p>
          {uploadError && (
            <p className="font-body text-xs text-red-400">{uploadError}</p>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFile}
          disabled={disabled || uploading}
        />
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

function ManageLocationsInner() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Add modal ───────────────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<LocationFormState>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // ── Edit modal ──────────────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<LocationRow | null>(null);
  const [editForm, setEditForm] = useState<LocationFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // ── Delete modal ────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<LocationRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => { fetchLocations(); fetchUsers(); }, []);

  /**
   * Venue admins are picked from the full user list. RLS on user_profiles is
   * select-own, so this has to go through the admin_list_users security-definer
   * RPC — the same one Manage Users uses.
   */
  async function fetchUsers() {
    const { data, error } = await supabase.rpc('admin_list_users');
    if (!error) setUsers(((data ?? []) as UserRow[]).slice().sort((a, b) => a.email.localeCompare(b.email)));
  }

  async function fetchLocations() {
    setLoading(true);
    const { data, error } = await supabase
      .from('locations')
      .select('id, name, address, icon, store_email, admins')
      .order('name');
    if (error) setError(error.message);
    else setLocations((data ?? []) as LocationRow[]);
    setLoading(false);
  }

  // ── Add ─────────────────────────────────────────────────────────────────────

  function openAdd() {
    setAddForm(EMPTY_FORM);
    setAddError(null);
    setAddOpen(true);
  }

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.address.trim()) return;
    setAdding(true);
    setAddError(null);
    const { data, error } = await supabase
      .from('locations')
      .insert({
        name: addForm.name.trim(),
        address: addForm.address.trim(),
        icon: addForm.icon || null,
        store_email: addForm.store_email.trim() || null,
      })
      .select()
      .single();
    if (error) { setAddError(error.message); setAdding(false); return; }
    setLocations(prev => [...prev, data as LocationRow].sort((a, b) => a.name.localeCompare(b.name)));
    setAdding(false);
    setAddOpen(false);
  }

  // ── Edit ────────────────────────────────────────────────────────────────────

  function openEdit(loc: LocationRow) {
    setEditTarget(loc);
    setEditForm({
      name: loc.name,
      address: loc.address ?? '',
      icon: loc.icon ?? '',
      store_email: loc.store_email ?? '',
      admins: loc.admins ?? [],
    });
    setEditError(null);
  }

  async function handleSaveEdit() {
    if (!editTarget || !editForm.name.trim() || !editForm.address.trim()) return;
    setSaving(true);
    setEditError(null);
    const next = {
      name: editForm.name.trim(),
      address: editForm.address.trim(),
      icon: editForm.icon || null,
      store_email: editForm.store_email.trim() || null,
      admins: editForm.admins,
    };
    const { error } = await supabase
      .from('locations')
      .update(next)
      .eq('id', editTarget.id);
    if (error) { setEditError(error.message); setSaving(false); return; }
    setLocations(prev =>
      prev.map(l => l.id === editTarget.id ? { ...l, ...next } : l)
          .sort((a, b) => a.name.localeCompare(b.name))
    );
    setSaving(false);
    setEditTarget(null);
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  function openDelete(loc: LocationRow) {
    setDeleteTarget(loc);
    setDeleteError(null);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.from('locations').delete().eq('id', deleteTarget.id);
    if (error) { setDeleteError(error.message); setDeleting(false); return; }
    setLocations(prev => prev.filter(l => l.id !== deleteTarget.id));
    setDeleting(false);
    setDeleteTarget(null);
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">
      <AppNavbar fixed={false} logo={<BattlePlanLogo />} />

      <div className="flex-1 flex flex-col items-center p-8 pt-10">
        <div className="w-full max-w-2xl flex flex-col gap-6">

          <div className="flex items-center gap-3">
            <h1 className="font-heading text-xl text-white">Manage Locations</h1>
            <div className="ml-auto flex items-center gap-3">
              {!loading && (
                <span className="font-body text-sm text-neutral-500">
                  {locations.length} {locations.length === 1 ? 'location' : 'locations'}
                </span>
              )}
              <Button color="primary" size="sm" onClick={openAdd}>Add Location</Button>
            </div>
          </div>

          <div className="flex flex-col divide-y divide-neutral-800 border border-neutral-800 rounded-xl overflow-hidden">
            {loading && (
              <div className="px-5 py-8 text-center font-body text-sm text-neutral-500">Loading…</div>
            )}
            {!loading && error && (
              <div className="px-5 py-8 text-center font-body text-sm text-red-400">{error}</div>
            )}
            {!loading && !error && locations.length === 0 && (
              <div className="px-5 py-8 text-center font-body text-sm text-neutral-500">No locations yet.</div>
            )}
            {!loading && !error && locations.map(loc => {
              const isUrl = loc.icon?.startsWith('http');
              return (
                <div key={loc.id} className="flex items-center gap-4 px-5 py-4 bg-neutral-900 hover:bg-neutral-800 transition-colors">

                  {isUrl ? (
                    <img src={loc.icon!} alt={loc.name} className="shrink-0 size-10 rounded-lg object-cover bg-neutral-800" />
                  ) : loc.icon ? (
                    <div className="shrink-0 size-10 rounded-lg bg-neutral-800 flex items-center justify-center text-xl">{loc.icon}</div>
                  ) : (
                    <div className="shrink-0 size-10 rounded-lg bg-primary-900 flex items-center justify-center">
                      <span className="font-body font-bold text-sm text-primary-300 uppercase">{loc.name[0]}</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <p className="font-body text-sm font-medium text-white leading-none">{loc.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      {loc.address && (
                        <span className="flex items-center gap-1 font-body text-xs text-neutral-400 truncate">
                          <Home className="size-3 shrink-0" />
                          {loc.address}
                        </span>
                      )}
                      {loc.store_email && (
                        <span className="flex items-center gap-1 font-body text-xs text-neutral-400 truncate">
                          <Letter className="size-3 shrink-0" />
                          {loc.store_email}
                        </span>
                      )}
                      {loc.admins && loc.admins.length > 0 && (
                        <span className="flex items-center gap-1 font-body text-xs text-neutral-500">
                          <UsersGroupRounded className="size-3 shrink-0" />
                          {loc.admins.length} {loc.admins.length === 1 ? 'admin' : 'admins'}
                        </span>
                      )}
                      {!loc.address && !loc.store_email && (!loc.admins || loc.admins.length === 0) && (
                        <span className="font-body text-xs text-neutral-600">No details set</span>
                      )}
                    </div>
                  </div>

                  <div onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                    <Dropdown
                      align="right"
                      menuClassName="w-44"
                      trigger={
                        <button
                          type="button"
                          aria-label={`${loc.name} options`}
                          className="p-1 opacity-50 hover:opacity-100 transition-opacity text-neutral-300 hover:text-white"
                        >
                          <MenuDots className="size-4" />
                        </button>
                      }
                    >
                      <DropdownItem icon={<Pen2 className="size-4" />} onClick={() => openEdit(loc)}>
                        Edit Location
                      </DropdownItem>
                      <DropdownDivider />
                      <DropdownItem
                        icon={<TrashBinMinimalistic className="size-4" />}
                        onClick={() => openDelete(loc)}
                        className="!text-red-400 hover:!text-red-300"
                      >
                        Delete Location
                      </DropdownItem>
                    </Dropdown>
                  </div>

                </div>
              );
            })}
          </div>

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

      {/* ── Add Location modal ─────────────────────────────────────────────── */}
      <Modal open={addOpen} onClose={() => !adding && setAddOpen(false)} className="max-w-sm">
        <div className="flex flex-col gap-5 p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-heading text-base text-white">Add Location</h2>
            <p className="font-body text-sm text-neutral-400">Fill in the details for the new venue.</p>
          </div>

          <div className="flex flex-col gap-1">
            <p className="font-body text-xs text-neutral-500 uppercase tracking-wider">Details</p>
            <div className="flex flex-col gap-3 mt-1">
              <Input
                label="Name"
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. The Dice Den"
                disabled={adding}
              />
              <Input
                label="Address"
                value={addForm.address}
                onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))}
                placeholder="e.g. 12 Main Street, Werribee VIC"
                disabled={adding}
              />
              <Input
                label="Store Email"
                type="email"
                value={addForm.store_email}
                onChange={e => setAddForm(f => ({ ...f, store_email: e.target.value }))}
                placeholder="hello@venue.com"
                disabled={adding}
              />
            </div>
          </div>

          <IconUpload
            name={addForm.name}
            value={addForm.icon}
            onChange={url => setAddForm(f => ({ ...f, icon: url }))}
            disabled={adding}
          />

          {addError && <p className="font-body text-sm text-red-400">{addError}</p>}

          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" color="secondary" disabled={adding} onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" loading={adding} disabled={!addForm.name.trim() || !addForm.address.trim()} onClick={handleAdd}>
              Add Location
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Location modal ────────────────────────────────────────────── */}
      <Modal open={editTarget !== null} onClose={() => !saving && setEditTarget(null)} className="max-w-sm">
        {editTarget && (
          <div className="flex flex-col gap-5 p-5">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-heading text-base text-white">Edit Location</h2>
              <p className="font-body text-sm text-neutral-400 truncate">{editTarget.name}</p>
            </div>

            <div className="flex flex-col gap-1">
              <p className="font-body text-xs text-neutral-500 uppercase tracking-wider">Details</p>
              <div className="flex flex-col gap-3 mt-1">
                <Input
                  label="Name"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  disabled={saving}
                />
                <Input
                  label="Address"
                  value={editForm.address}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                  disabled={saving}
                />
                <Input
                  label="Store Email"
                  type="email"
                  value={editForm.store_email}
                  onChange={e => setEditForm(f => ({ ...f, store_email: e.target.value }))}
                  disabled={saving}
                />
              </div>
            </div>

            <IconUpload
              name={editForm.name}
              value={editForm.icon}
              onChange={url => setEditForm(f => ({ ...f, icon: url }))}
              disabled={saving}
            />

            {/* Venue admins — searchable multi-select, keyed by user id so
                nothing depends on email strings staying unique. */}
            <div className="flex flex-col gap-1">
              <p className="font-body text-xs text-neutral-500 uppercase tracking-wider">Venue Admins</p>
              <SearchSelect
                multiple
                placeholder="No venue admins"
                searchPlaceholder="Search users…"
                helperText="These users can manage bookings and tables for this venue."
                emptyLabel="No users match that search."
                options={users.map(u => ({ value: u.id, label: u.email }))}
                value={editForm.admins}
                onChange={ids => setEditForm(f => ({ ...f, admins: ids }))}
                disabled={saving}
              />
            </div>

            {editError && <p className="font-body text-sm text-red-400">{editError}</p>}

            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" color="secondary" disabled={saving} onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button color="primary" loading={saving} disabled={!editForm.name.trim() || !editForm.address.trim()} onClick={handleSaveEdit}>
                Save
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete confirmation modal ──────────────────────────────────────── */}
      <Modal open={deleteTarget !== null} onClose={() => !deleting && setDeleteTarget(null)} className="max-w-xs">
        {deleteTarget && (
          <div className="flex flex-col gap-3 p-5">
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-base text-white">Delete Location?</h2>
              <p className="font-body text-sm text-neutral-300">
                This will permanently delete{' '}
                <span className="text-white">{deleteTarget.name}</span> and all
                associated data. This cannot be undone.
              </p>
            </div>
            {deleteError && <p className="font-body text-sm text-red-400">{deleteError}</p>}
            <div className="flex items-center gap-3 pt-1">
              <Button variant="ghost" color="secondary" disabled={deleting} onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button color="danger" loading={deleting} onClick={handleConfirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}

export default function ManageLocations() {
  return (
    <AdminRoute>
      <ManageLocationsInner />
    </AdminRoute>
  );
}
