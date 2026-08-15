import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AdminRoute,
  AltArrowLeft,
  Badge,
  Button,
  Checkbox,
  Select,
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
  kind: LocationKind;
  owner_location_id: string | null;
};

/**
 * What a location row is.
 *
 * 'club' exists in the database constraint but is not offered here yet —
 * nothing knows how to run one, and a half-supported club row would be worse
 * than no club at all.
 */
type LocationKind = 'venue' | 'club' | 'space';

const KIND_OPTIONS = [
  { value: 'venue', label: 'Venue — a shop, listed publicly' },
  { value: 'space', label: 'Space — a borrowed room, never public' },
];

/** Shape returned by the admin_list_users RPC. */
type UserRow = {
  id:    string;
  email: string;
};

/**
 * An app a venue can be given.
 *
 * Only apps granted to the `store_admin` pseudo-role appear — those are the
 * ones where a `location_apps` row actually does something. Offering a switch
 * for BattlePlan or BattleCards would be a control that changes nothing.
 */
type StoreApp = {
  slug: string;
  name: string;
};

type LocationFormState = {
  name: string;
  address: string;    // required — the column is NOT NULL
  icon: string;       // URL or empty string
  store_email: string;
  admins: string[];   // user ids
  apps: string[];     // app slugs switched on for this venue
  kind: LocationKind;
  /** Required for a space, meaningless otherwise. */
  owner_location_id: string;
};

const EMPTY_FORM: LocationFormState = {
  name: '', address: '', icon: '', store_email: '', admins: [], apps: [],
  kind: 'venue', owner_location_id: '',
};

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

// ── Apps switch ─────────────────────────────────────────────────────────────

/**
 * Which of the platform's apps this venue gets.
 *
 * Ticking one is what gives the venue's admins the app in their switcher AND
 * the matching surfaces inside BattlePlan — the Upcoming Events column for
 * BattlePack. Both read the same `location_apps` row, so they cannot disagree.
 *
 * Renders nothing when no app is granted to store admins, rather than an empty
 * heading over a blank space.
 */
function AppsField({ apps, value, onChange, disabled }: {
  apps: StoreApp[];
  value: string[];
  onChange: (slugs: string[]) => void;
  disabled?: boolean;
}) {
  if (apps.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <p className="font-body text-xs text-neutral-500 uppercase tracking-wider">Apps</p>
      <div className="flex flex-col gap-2 mt-1">
        {apps.map(app => (
          <Checkbox
            key={app.slug}
            label={app.name}
            checked={value.includes(app.slug)}
            disabled={disabled}
            onChange={e => onChange(
              e.target.checked
                ? [...value, app.slug]
                : value.filter(s => s !== app.slug),
            )}
          />
        ))}
      </div>
      <p className="font-body text-xs text-neutral-600 mt-1">
        This venue's admins get the app in their switcher, and see it inside BattlePlan.
      </p>
    </div>
  );
}

// ── Kind ────────────────────────────────────────────────────────────────────

/**
 * What this row is, and — for a space — who looks after it.
 *
 * A SPACE MUST HAVE AN OWNER. Reading a space is granted either by being in its
 * own `admins` or by administering its owner; a space with neither is a row
 * nobody can see, edit or delete. Platform admins are not stopped by the
 * insert policy the way a venue admin is, so the form is what enforces it here.
 */
function KindField({ value, owner, owners, onChange, disabled }: {
  value: LocationKind;
  owner: string;
  /** Candidate owners — anything that is not itself a space. */
  owners: LocationRow[];
  onChange: (patch: { kind?: LocationKind; owner_location_id?: string }) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-body text-xs text-neutral-500 uppercase tracking-wider">Kind</p>
      <div className="flex flex-col gap-3 mt-1">
        <Select
          options={KIND_OPTIONS}
          value={value}
          onChange={e => onChange({ kind: e.target.value as LocationKind })}
          disabled={disabled}
        />

        {value === 'space' && (
          <SearchSelect
            placeholder="Choose an owner"
            searchPlaceholder="Search venues…"
            helperText="The venue or club that meets here and looks after this room."
            emptyLabel="No venues match that search."
            options={owners.map(o => ({ value: o.id, label: o.name }))}
            value={owner}
            onChange={id => onChange({ owner_location_id: id })}
            disabled={disabled}
          />
        )}

        {value === 'space' && (
          <p className="font-body text-xs text-neutral-600">
            Never appears publicly, and never in a booking or venue picker.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Whether the form can be saved. A space needs an owner on top of the usual
 * name and address.
 */
function formIsValid(f: LocationFormState): boolean {
  if (!f.name.trim() || !f.address.trim()) return false;
  if (f.kind === 'space' && !f.owner_location_id) return false;
  return true;
}

// ── Main component ──────────────────────────────────────────────────────────

function ManageLocationsInner() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [storeApps, setStoreApps] = useState<StoreApp[]>([]);
  const [appsByLocation, setAppsByLocation] = useState<Map<string, string[]>>(new Map());
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

  useEffect(() => { fetchLocations(); fetchUsers(); fetchStoreApps(); fetchLocationApps(); }, []);

  /**
   * The apps a venue can be given: those granted to the 'store_admin'
   * pseudo-role. Read from the grant table rather than hardcoded, so granting a
   * second app to store admins makes its switch appear here on its own.
   */
  async function fetchStoreApps() {
    const { data, error } = await supabase
      .from('platform_app_roles')
      .select('app_slug, app:platform_apps(slug, name)')
      .eq('role', 'store_admin');
    if (error) return;
    const rows = (data ?? []) as unknown as { app: { slug: string; name: string } | null }[];
    setStoreApps(
      rows.map(r => r.app).filter((a): a is StoreApp => !!a)
          .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  /** Which apps each venue currently has, keyed by venue. */
  async function fetchLocationApps() {
    const { data, error } = await supabase.from('location_apps').select('location_id, app_slug');
    if (error) return;
    const map = new Map<string, string[]>();
    for (const row of ((data ?? []) as { location_id: string; app_slug: string }[])) {
      map.set(row.location_id, [...(map.get(row.location_id) ?? []), row.app_slug]);
    }
    setAppsByLocation(map);
  }

  /**
   * Make a venue's rows match `next`.
   *
   * Written as an add/remove diff rather than delete-then-insert: this table is
   * what decides whether a venue admin can open the app at all, and a failed
   * insert after a successful delete would quietly take it away from them.
   */
  async function syncLocationApps(locationId: string, next: string[]) {
    const current = appsByLocation.get(locationId) ?? [];
    const toAdd    = next.filter(s => !current.includes(s));
    const toRemove = current.filter(s => !next.includes(s));

    if (toAdd.length) {
      const { error } = await supabase
        .from('location_apps')
        .insert(toAdd.map(app_slug => ({ location_id: locationId, app_slug })));
      if (error) throw error;
    }
    if (toRemove.length) {
      const { error } = await supabase
        .from('location_apps')
        .delete()
        .eq('location_id', locationId)
        .in('app_slug', toRemove);
      if (error) throw error;
    }
    setAppsByLocation(prev => new Map(prev).set(locationId, next));
  }

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
      // Every kind, unfiltered — this is the one screen where a space is
      // supposed to be visible.
      .select('id, name, address, icon, store_email, admins, kind, owner_location_id')
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
        kind: addForm.kind,
        // An ownerless space is readable by nobody, so it would sit there
        // unseeable and undeletable. The form requires an owner for a space.
        owner_location_id: addForm.kind === 'space' ? addForm.owner_location_id : null,
      })
      .select()
      .single();
    if (error) { setAddError(error.message); setAdding(false); return; }

    // After the insert, because the rows are keyed by an id that did not exist
    // until now. The venue is already saved at this point, so a failure here is
    // reported without discarding it — the switches can be set from Edit.
    const created = data as LocationRow;
    if (addForm.apps.length > 0) {
      try {
        await syncLocationApps(created.id, addForm.apps);
      } catch (e) {
        setAddError(`Location saved, but its apps could not be set: ${(e as Error).message}`);
        setAdding(false);
        setLocations(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        return;
      }
    }

    setLocations(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
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
      apps: appsByLocation.get(loc.id) ?? [],
      kind: loc.kind,
      owner_location_id: loc.owner_location_id ?? '',
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
      kind: editForm.kind,
      owner_location_id: editForm.kind === 'space' ? editForm.owner_location_id : null,
    };
    const { error } = await supabase
      .from('locations')
      .update(next)
      .eq('id', editTarget.id);
    if (error) { setEditError(error.message); setSaving(false); return; }

    try {
      await syncLocationApps(editTarget.id, editForm.apps);
    } catch (e) {
      setEditError(`Details saved, but the apps could not be updated: ${(e as Error).message}`);
      setSaving(false);
      return;
    }

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
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-body text-sm font-medium text-white leading-none truncate">{loc.name}</p>
                      {/* Venues are the norm and go unlabelled; anything else is
                          worth calling out, because a space is invisible
                          everywhere but this screen. */}
                      {loc.kind !== 'venue' && (
                        <Badge variant="outline" color="gray">
                          {loc.kind === 'space' ? 'Space' : 'Club'}
                        </Badge>
                      )}
                    </div>
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
                      {/* Which apps this venue has been given. Rolling it out one
                          shop at a time only works if the list says who has it. */}
                      {(appsByLocation.get(loc.id) ?? []).map(slug => (
                        <Badge key={slug} variant="outline" color="primary">
                          {storeApps.find(a => a.slug === slug)?.name ?? slug}
                        </Badge>
                      ))}
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

          <KindField
            value={addForm.kind}
            owner={addForm.owner_location_id}
            owners={locations.filter(l => l.kind !== 'space')}
            onChange={patch => setAddForm(f => ({ ...f, ...patch }))}
            disabled={adding}
          />

          {/* A space has no staff, no apps and no store email — it is a room. */}
          {addForm.kind !== 'space' && (
            <AppsField
              apps={storeApps}
              value={addForm.apps}
              onChange={slugs => setAddForm(f => ({ ...f, apps: slugs }))}
              disabled={adding}
            />
          )}

          {addError && <p className="font-body text-sm text-red-400">{addError}</p>}

          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" color="secondary" disabled={adding} onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" loading={adding} disabled={!formIsValid(addForm)} onClick={handleAdd}>
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

            <KindField
              value={editForm.kind}
              owner={editForm.owner_location_id}
              // Never itself, or a space could end up owning itself and become
              // unreachable through the owner branch.
              owners={locations.filter(l => l.kind !== 'space' && l.id !== editTarget.id)}
              onChange={patch => setEditForm(f => ({ ...f, ...patch }))}
              disabled={saving}
            />

            {editForm.kind !== 'space' && (
              <AppsField
                apps={storeApps}
                value={editForm.apps}
                onChange={slugs => setEditForm(f => ({ ...f, apps: slugs }))}
                disabled={saving}
              />
            )}

            {editError && <p className="font-body text-sm text-red-400">{editError}</p>}

            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" color="secondary" disabled={saving} onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button color="primary" loading={saving} disabled={!formIsValid(editForm)} onClick={handleSaveEdit}>
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
