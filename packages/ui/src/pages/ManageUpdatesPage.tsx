/**
 * ManageUpdatesPage.tsx — Admin screen for News & Updates release notes.
 *
 * Shared by both apps (mounted at /app/admin/updates) because an update is
 * cross-app: `apps` tags which apps it appears in. Admins see drafts too — the
 * `updates_admin_all` RLS policy grants that.
 *
 * Authorship: `published_by` / `published_by_name` are stamped from the current
 * admin the first time an update is published, and never overwritten afterwards,
 * so editing someone else's note doesn't steal their byline. The name is
 * denormalised because RLS on user_profiles is select-own.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AltArrowLeft from '../icons/AltArrowLeft';
import Pen2 from '../icons/Pen2';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';
import AddCircle from '../icons/AddCircle';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Checkbox from '../components/Checkbox';
import Input from '../components/Input';
import Modal from '../components/Modal';
import Navbar from '../components/Navbar';
import RichTextEditor from '../components/RichTextEditor';
import type { Breadcrumb } from '../components/Navbar';
import type { UpdateApp } from '../hooks/useUpdates';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UpdateRow {
  id:                string;
  title:             string;
  body:              string | null;
  version:           string | null;
  apps:              string[];
  published:         boolean;
  /** Show/hide switch, independent of the draft/published state. */
  visible:           boolean;
  published_by:      string | null;
  published_by_name: string | null;
  published_at:      string | null;
  created_at:        string;
}

const ALL_APPS: { value: UpdateApp; label: string }[] = [
  { value: 'battlecards', label: 'BattleCards' },
  { value: 'battleplan',  label: 'BattlePlan'  },
  { value: 'battlepack',  label: 'BattlePack'  },
  { value: 'battlebox',   label: 'BattleBox'   },
];

const APP_LABEL = Object.fromEntries(ALL_APPS.map(a => [a.value, a.label]));

const EMPTY_FORM = { title: '', body: '', version: '', apps: [] as string[], published: false, visible: true };

interface ManageUpdatesPageProps {
  logo?: React.ReactNode;
  /** Breadcrumb trail. Defaults to Home / Admin Tools / Manage Updates. */
  breadcrumbs?: Breadcrumb[];
}

const DEFAULT_CRUMBS: Breadcrumb[] = [
  { label: 'Home',        href: '/app' },
  { label: 'Admin Tools', href: '/app/admin' },
  { label: 'Manage Updates' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ManageUpdatesPage({ logo, breadcrumbs = DEFAULT_CRUMBS }: ManageUpdatesPageProps) {
  const navigate = useNavigate();

  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Editor modal
  const [editing,  setEditing]  = useState<UpdateRow | null>(null);  // null = creating
  const [formOpen, setFormOpen] = useState(false);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<UpdateRow | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  useEffect(() => { fetchUpdates(); }, []);

  async function fetchUpdates() {
    setLoading(true);
    const { data, error } = await supabase
      .from('updates')
      .select('id, title, body, version, apps, published, visible, published_by, published_by_name, published_at, created_at')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setUpdates((data ?? []) as UpdateRow[]);
    setLoading(false);
  }

  /** Current admin's id + display name, for stamping the byline on first publish. */
  async function currentAuthor(): Promise<{ id: string; name: string } | null> {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return null;
    const { data: profile } = await supabase
      .from('user_profiles').select('username').eq('id', user.id).single();
    const name =
      profile?.username ??
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      user.email ??
      'Unknown';
    return { id: user.id, name };
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(u: UpdateRow) {
    setEditing(u);
    setForm({
      title:     u.title,
      body:      u.body ?? '',
      version:   u.version ?? '',
      apps:      u.apps ?? [],
      published: u.published,
      visible:   u.visible ?? true,
    });
    setFormError(null);
    setFormOpen(true);
  }

  function toggleApp(app: string) {
    setForm(f => ({
      ...f,
      apps: f.apps.includes(app) ? f.apps.filter(a => a !== app) : [...f.apps, app],
    }));
  }

  async function handleSave() {
    setFormError(null);
    if (!form.title.trim()) { setFormError('Please enter a title.'); return; }

    setSaving(true);

    const payload: Record<string, unknown> = {
      title:     form.title.trim(),
      body:      form.body.trim() || null,
      version:   form.version.trim() || null,
      apps:      form.apps,
      published: form.published,
      visible:   form.visible,
    };

    // Stamp the byline only on the transition into "published" — never overwrite
    // an existing author when editing.
    const becomingPublished = form.published && !editing?.published;
    if (becomingPublished) {
      const author = await currentAuthor();
      if (author) {
        payload.published_by      = author.id;
        payload.published_by_name = author.name;
      }
      payload.published_at = new Date().toISOString();
    }

    const { error } = editing
      ? await supabase.from('updates').update(payload).eq('id', editing.id)
      : await supabase.from('updates').insert(payload);

    setSaving(false);
    if (error) { setFormError(error.message); return; }
    setFormOpen(false);
    fetchUpdates();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('updates').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { setError(error.message); return; }
    setDeleteTarget(null);
    fetchUpdates();
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <Navbar fixed={false} logo={logo} breadcrumbs={breadcrumbs} />

      <div className="flex-1 flex flex-col items-center p-8 pt-10">
        <div className="w-full max-w-3xl flex flex-col gap-6">

          <div className="flex items-center gap-3">
            <h1 className="font-heading text-xl text-white">Manage Updates</h1>
            <span className="font-body text-sm text-gray-500 ml-auto">
              {loading ? '' : `${updates.length} ${updates.length === 1 ? 'update' : 'updates'}`}
            </span>
            <Button size="sm" leftIcon={<AddCircle className="size-4" />} onClick={openCreate}>
              New Update
            </Button>
          </div>

          <div className="flex flex-col divide-y divide-gray-800 border border-gray-800 rounded-xl overflow-hidden">
            {loading && (
              <div className="px-5 py-8 text-center font-body text-sm text-gray-500">Loading…</div>
            )}
            {!loading && error && (
              <div className="px-5 py-8 text-center font-body text-sm text-red-400">{error}</div>
            )}
            {!loading && !error && updates.length === 0 && (
              <div className="px-5 py-8 text-center font-body text-sm text-gray-500">
                No updates yet. Create the first one.
              </div>
            )}
            {!loading && !error && updates.map(u => (
              <div key={u.id} className="flex items-center gap-4 px-5 py-3.5 bg-gray-900">

                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-body text-sm text-white truncate">{u.title}</p>
                    {u.version && <Badge color="gray" size="sm">v{u.version}</Badge>}
                    <Badge color={u.published ? 'success' : 'warning'} size="sm">
                      {u.published ? 'Published' : 'Draft'}
                    </Badge>
                    {/* Only worth flagging on published posts — a draft is
                        already hidden regardless. */}
                    {u.published && !u.visible && (
                      <Badge color="gray" size="sm">Hidden</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {u.apps.length === 0
                      ? <span className="font-body text-xs text-gray-600">No apps — hidden everywhere</span>
                      : u.apps.map(a => (
                          <Badge key={a} color="primary" variant="outline" size="sm">
                            {APP_LABEL[a] ?? a}
                          </Badge>
                        ))}
                  </div>

                  <p className="font-body text-xs text-gray-500">
                    {formatDate(u.published_at ?? u.created_at)}
                    {u.published_by_name ? ` • ${u.published_by_name}` : ''}
                  </p>
                </div>

                <button
                  type="button"
                  aria-label={`Edit ${u.title}`}
                  className="p-1.5 rounded hover:bg-gray-800 transition-colors"
                  onClick={() => openEdit(u)}
                >
                  <Pen2 className="size-4 text-gray-400" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${u.title}`}
                  className="p-1.5 rounded hover:bg-gray-800 transition-colors"
                  onClick={() => setDeleteTarget(u)}
                >
                  <TrashBinMinimalistic className="size-4 text-red-400" />
                </button>

              </div>
            ))}
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

      {/* ── Create / edit ─────────────────────────────────────────────── */}
      <Modal open={formOpen} onClose={() => !saving && setFormOpen(false)} className="max-w-2xl">
        <div className="p-5 flex flex-col gap-4">

          <h2 className="font-heading text-xl text-white">
            {editing ? 'Edit Update' : 'New Update'}
          </h2>

          <Input
            label="Title"
            placeholder="e.g. Collection Covers"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            state={formError ? 'error' : 'default'}
            required
          />

          <Input
            label="Version (optional)"
            placeholder="e.g. 1.09.0"
            value={form.version}
            onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
          />

          <div className="flex flex-col gap-2">
            <label className="block text-sm font-medium font-body text-white">Body</label>
            <RichTextEditor
              value={form.body}
              onChange={md => setForm(f => ({ ...f, body: md }))}
              placeholder="What changed in this release?"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="block text-sm font-medium font-body text-white">Apps</label>
            <p className="font-body text-xs text-gray-500">
              Which apps show this update. Select none and it appears nowhere.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_APPS.map(a => (
                <Checkbox
                  key={a.value}
                  label={a.label}
                  checked={form.apps.includes(a.value)}
                  onChange={() => toggleApp(a.value)}
                />
              ))}
            </div>
          </div>

          <Checkbox
            label="Published"
            helperText={
              editing?.published
                ? `Published ${formatDate(editing.published_at)} by ${editing.published_by_name ?? 'unknown'}`
                : 'Publishing stamps you as the author.'
            }
            checked={form.published}
            onChange={e => setForm(f => ({ ...f, published: e.target.checked }))}
          />

          <Checkbox
            label="Visible"
            helperText="Uncheck to pull this from the in-app News & Updates column without unpublishing it."
            checked={form.visible}
            onChange={e => setForm(f => ({ ...f, visible: e.target.checked }))}
          />

          {formError && <p className="font-body text-sm text-red-400">{formError}</p>}

          <div className="flex justify-end gap-3">
            <Button variant="outline" color="secondary" disabled={saving} onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={handleSave}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create update'}
            </Button>
          </div>

        </div>
      </Modal>

      {/* ── Delete confirmation ───────────────────────────────────────── */}
      <Modal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}>
        <div className="p-5 flex flex-col gap-3">
          <TrashBinMinimalistic className="size-8 text-red-400" />
          <h2 className="font-heading text-xl text-white">Delete Update</h2>
          <p className="font-body text-base text-gray-300">
            Permanently delete “{deleteTarget?.title}”? This can't be undone.
          </p>
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button variant="ghost" size="sm" disabled={deleting} onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button color="danger" size="sm" disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
