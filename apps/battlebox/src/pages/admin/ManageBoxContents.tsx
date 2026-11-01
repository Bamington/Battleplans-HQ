/**
 * ManageBoxContents.tsx — Admin: the stored answers behind "Suggest contents".
 *
 * Every box anyone has looked up is kept in box_contents and shared. Here an
 * admin can run a lookup by hand (to check how a box comes out), correct an
 * answer's models and counts, or delete it so the next lookup searches again.
 * A corrected answer is locked: lookups never overwrite it.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminRoute, AltArrowLeft, Button, Input, Magnifer } from '@battleplans/ui';
import AppNavbar from '../../components/AppNavbar';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { GamePicker } from '../../components/GamePicker';
import { PlusIcon, TrashIcon } from '../../components/paintPickerBits';
import { useUserId } from '../../hooks/useCollection';
import { deleteBoxContents, fetchBoxContentsRows, lookupBoxContents, saveBoxContents } from '../../lib/boxContents';
import type { BoxContentsRow, BoxItem } from '../../lib/boxContents';

const BattleBenchLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattleBench</span>
);

const CRUMBS = [
  { label: 'Home', href: '/app' },
  { label: 'Admin Tools', href: '/app/admin' },
  { label: 'Box Contents' },
];

function Pill({ children, color }: { children: React.ReactNode; color: 'emerald' | 'amber' | 'neutral' }) {
  const map = {
    emerald: 'bg-emerald-600/20 text-emerald-300',
    amber:   'bg-amber-600/20 text-amber-300',
    neutral: 'bg-neutral-700 text-neutral-300',
  } as const;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-body ${map[color]}`}>{children}</span>;
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** One stored answer, expanded for editing. */
function BoxContentsEditor({ row, userId, onSaved, onDelete }: {
  row: BoxContentsRow;
  userId: string | null;
  onSaved: (items: BoxItem[]) => void;
  onDelete: () => void;
}) {
  const [items, setItems] = useState<BoxItem[]>(row.items);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (i: number, patch: Partial<BoxItem>) => setItems(prev => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  const save = async () => {
    setSaving(true); setError(null);
    const { error: err } = await saveBoxContents(row.id, items, userId);
    setSaving(false);
    if (err) { setError('Could not save.'); return; }
    onSaved(items.filter(i => i.name.trim()));
  };

  return (
    <div className="flex flex-col gap-2 px-5 pb-4 bg-neutral-900">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <input value={it.name} onChange={e => set(i, { name: e.target.value })} placeholder="Model name" aria-label="Model name"
            className="flex-1 min-w-0 bg-neutral-800 border border-neutral-700 rounded-md px-2.5 py-1.5 font-body text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
          <input type="number" min={1} max={999} value={it.count} aria-label="How many"
            onChange={e => set(i, { count: Math.max(1, Math.min(999, Number(e.target.value) || 1)) })}
            className="w-16 bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1.5 font-body text-sm text-white text-center [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-primary-500" />
          <button type="button" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} aria-label="Remove model"
            className="p-1.5 text-neutral-500 hover:text-red-400"><TrashIcon /></button>
        </div>
      ))}
      <button type="button" onClick={() => setItems(prev => [...prev, { name: '', count: 1 }])}
        className="self-start flex items-center gap-1 font-body text-sm text-primary-400 hover:text-primary-300">
        <PlusIcon className="w-4 h-4" /> Add model
      </button>

      {row.sources.length > 0 && (
        <p className="font-body text-xs text-neutral-500">
          Sources:{' '}
          {row.sources.map((s, i) => (
            <span key={s.url}>{i > 0 && ', '}<a href={s.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-neutral-300">{s.title || s.url}</a></span>
          ))}
        </p>
      )}

      {error && <p className="font-body text-sm text-red-400">{error}</p>}
      <div className="flex gap-2 pt-1">
        <Button size="sm" color="primary" loading={saving} disabled={saving} onClick={save}>Save Correction</Button>
        <Button size="sm" variant="outline" color="secondary" onClick={onDelete}>Delete</Button>
      </div>
      <p className="font-body text-xs text-neutral-500">
        Saving locks this answer, so new lookups won’t change it. Delete it to have the next lookup search again.
      </p>
    </div>
  );
}

function ManageBoxContentsInner() {
  const navigate = useNavigate();
  const userId = useUserId();
  const [rows, setRows] = useState<BoxContentsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BoxContentsRow | null>(null);

  // Manual lookup
  const [lookupName, setLookupName] = useState('');
  const [lookupGame, setLookupGame] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setRows(await fetchBoxContentsRows()); setError(null); }
    catch { setError('Failed to load box contents.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const runLookup = async () => {
    if (!lookupName.trim() || looking) return;
    setLooking(true); setLookupMsg(null);
    const { result, error: err } = await lookupBoxContents(lookupName.trim(), lookupGame);
    setLooking(false);
    if (err || !result) { setLookupMsg(err ?? 'Lookup failed.'); return; }
    setLookupMsg(result.found ? `Found ${result.items.length} ${result.items.length === 1 ? 'model' : 'models'}.` : 'Nothing reliable found.');
    await load();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const { error: err } = await deleteBoxContents(confirmDelete.id);
    if (!err) setRows(prev => prev.filter(r => r.id !== confirmDelete.id));
    setConfirmDelete(null);
  };

  const q = search.trim().toLowerCase();
  const shown = q ? rows.filter(r => `${r.box_name} ${r.game_name ?? ''}`.toLowerCase().includes(q)) : rows;

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">
      <AppNavbar fixed={false} logo={<BattleBenchLogo />} breadcrumbs={CRUMBS} />

      <div className="flex-1 flex flex-col items-center p-4 sm:p-8 pt-10">
        <div className="w-full max-w-2xl flex flex-col gap-6">

          <div className="flex items-center gap-3">
            <h1 className="font-heading text-xl text-white">Box Contents</h1>
            {!loading && <span className="font-body text-sm text-neutral-500 ml-auto">{rows.length} {rows.length === 1 ? 'box' : 'boxes'}</span>}
          </div>
          <p className="font-body text-sm text-neutral-400 -mt-3">
            What “Suggest contents” has found for each box, shared by everyone. Correct an answer to lock it.
          </p>

          {/* Run a lookup by hand — same path users take, counts against your daily lookups. */}
          <div className="flex flex-col gap-3 bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <span className="font-body text-sm font-medium text-white">Look up a box</span>
            <Input size="sm" placeholder="e.g. Starter Set 01 Gundam Assemble" value={lookupName} onChange={e => setLookupName(e.target.value)} />
            <GamePicker value={lookupGame} onChange={setLookupGame} enabled />
            <div className="flex items-center gap-3">
              <Button size="sm" color="primary" leftIcon={<Magnifer className="w-4 h-4" />} loading={looking} disabled={!lookupName.trim() || looking} onClick={runLookup}>
                Look Up
              </Button>
              {lookupMsg && <span className="font-body text-sm text-neutral-300">{lookupMsg}</span>}
            </div>
          </div>

          <Input size="sm" type="search" placeholder="Search boxes…" leftIcon={<Magnifer className="w-4 h-4" />}
            value={search} onChange={e => setSearch(e.target.value)} />

          <div className="flex flex-col divide-y divide-neutral-800 border border-neutral-800 rounded-xl overflow-hidden">
            {loading && <div className="px-5 py-8 text-center font-body text-sm text-neutral-500">Loading…</div>}
            {!loading && error && <div className="px-5 py-8 text-center font-body text-sm text-red-400">{error}</div>}
            {!loading && !error && shown.length === 0 && (
              <div className="px-5 py-8 text-center font-body text-sm text-neutral-500">
                {rows.length === 0 ? 'No boxes looked up yet.' : 'No boxes match your search.'}
              </div>
            )}
            {!loading && !error && shown.map(row => (
              <div key={row.id} className="flex flex-col">
                <button type="button" onClick={() => setOpenId(openId === row.id ? null : row.id)}
                  aria-expanded={openId === row.id}
                  className="flex flex-col gap-1 px-5 py-3.5 bg-neutral-900 text-left hover:bg-neutral-800/60">
                  <span className="font-body text-sm text-white truncate">{row.box_name}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {row.game_name && <span className="font-body text-xs text-neutral-400">{row.game_name}</span>}
                    {row.found
                      ? <Pill color="neutral">{row.items.length} {row.items.length === 1 ? 'model' : 'models'}</Pill>
                      : <Pill color="amber">Not found</Pill>}
                    {row.edited_at && <Pill color="emerald">Corrected</Pill>}
                    <span className="font-body text-xs text-neutral-500">{shortDate(row.edited_at ?? row.fetched_at)}</span>
                  </span>
                </button>
                {openId === row.id && (
                  <BoxContentsEditor
                    key={row.fetched_at}
                    row={row}
                    userId={userId}
                    onSaved={items => setRows(prev => prev.map(r => (r.id === row.id
                      ? { ...r, items, found: items.length > 0, edited_at: new Date().toISOString() } : r)))}
                    onDelete={() => setConfirmDelete(row)}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex">
            <Button variant="outline" color="secondary" leftIcon={<AltArrowLeft className="size-4" />} onClick={() => navigate('/app/admin')}>
              Back to Admin Tools
            </Button>
          </div>

        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete this answer?"
        message={confirmDelete ? `Forget what was found for “${confirmDelete.box_name}”? The next lookup will search the web again.` : ''}
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

export default function ManageBoxContents() {
  return (
    <AdminRoute>
      <ManageBoxContentsInner />
    </AdminRoute>
  );
}
