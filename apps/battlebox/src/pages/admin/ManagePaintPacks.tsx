import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminRoute, AltArrowLeft, Button, AddCircle } from '@battleplans/ui';
import AppNavbar from '../../components/AppNavbar';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { KebabMenu } from '../../components/KebabMenu';
import { fetchAllPacks, createPaintPack, deletePaintPack, paintPackImageUrl } from '../../hooks/usePaintPacks';
import type { PaintPack } from '../../hooks/usePaintPacks';

const BattleBenchLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattleBench</span>
);

const CRUMBS = [
  { label: 'Home', href: '/app' },
  { label: 'Admin Tools', href: '/app/admin' },
  { label: 'Paint Packs' },
];

function Pill({ children, color }: { children: React.ReactNode; color: 'emerald' | 'sky' | 'neutral' }) {
  const map = {
    emerald: 'bg-emerald-600/20 text-emerald-300',
    sky:     'bg-sky-600/20 text-sky-300',
    neutral: 'bg-neutral-700 text-neutral-300',
  } as const;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-body ${map[color]}`}>{children}</span>;
}

function ManagePaintPacksInner() {
  const navigate = useNavigate();
  const [packs, setPacks] = useState<PaintPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PaintPack | null>(null);

  async function load() {
    setLoading(true);
    try { setPacks(await fetchAllPacks()); }
    catch { setError('Failed to load packs.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    const { id, error: err } = await createPaintPack({
      name: 'Untitled Pack', brand: null, description: null, is_public: false, is_official: false,
    });
    setCreating(false);
    if (err || !id) { setError('Could not create the pack.'); return; }
    navigate(`/app/admin/paint-packs/${id}`);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const { error: err } = await deletePaintPack(confirmDelete.id);
    if (!err) setPacks(prev => prev.filter(p => p.id !== confirmDelete.id));
    setConfirmDelete(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">
      <AppNavbar fixed={false} logo={<BattleBenchLogo />} breadcrumbs={CRUMBS} />

      <div className="flex-1 flex flex-col items-center p-8 pt-10">
        <div className="w-full max-w-2xl flex flex-col gap-6">

          <div className="flex items-center gap-3">
            <h1 className="font-heading text-xl text-white">Paint Packs</h1>
            {!loading && <span className="font-body text-sm text-neutral-500 ml-auto">{packs.length} {packs.length === 1 ? 'pack' : 'packs'}</span>}
          </div>

          <Button color="primary" leftIcon={<AddCircle className="w-4 h-4" />} loading={creating} disabled={creating} onClick={handleCreate} className="self-start">
            New Pack
          </Button>

          <div className="flex flex-col divide-y divide-neutral-800 border border-neutral-800 rounded-xl overflow-hidden">
            {loading && <div className="px-5 py-8 text-center font-body text-sm text-neutral-500">Loading…</div>}
            {!loading && error && <div className="px-5 py-8 text-center font-body text-sm text-red-400">{error}</div>}
            {!loading && !error && packs.length === 0 && (
              <div className="px-5 py-8 text-center font-body text-sm text-neutral-500">No packs yet. Create one to get started.</div>
            )}
            {!loading && !error && packs.map(pack => (
              <div key={pack.id} className="flex items-center gap-3 px-5 py-3.5 bg-neutral-900">
                <div className="shrink-0 size-9 rounded-md overflow-hidden bg-neutral-800 border border-neutral-700 flex items-center justify-center font-heading text-sm text-primary-400">
                  {paintPackImageUrl(pack.image_path)
                    ? <img src={paintPackImageUrl(pack.image_path)!} alt="" className="w-full h-full object-cover" />
                    : (pack.brand || pack.name).trim().charAt(0).toUpperCase()}
                </div>
                <button type="button" onClick={() => navigate(`/app/admin/paint-packs/${pack.id}`)} className="flex-1 min-w-0 text-left">
                  <p className="font-body text-sm text-white truncate">{pack.name}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <Pill color="neutral">{pack.item_count} {pack.item_count === 1 ? 'paint' : 'paints'}</Pill>
                    {pack.is_official && <Pill color="emerald">Official</Pill>}
                    <Pill color={pack.is_public ? 'sky' : 'neutral'}>{pack.is_public ? 'Public' : 'Draft'}</Pill>
                  </div>
                </button>
                <KebabMenu
                  label={`${pack.name} actions`}
                  items={[
                    { label: 'Edit', onClick: () => navigate(`/app/admin/paint-packs/${pack.id}`) },
                    { label: 'Delete', onClick: () => setConfirmDelete(pack), danger: true },
                  ]}
                />
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
        title="Delete pack?"
        message={confirmDelete ? `Permanently delete “${confirmDelete.name}”? Users who added it will lose it. This can't be undone.` : ''}
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

export default function ManagePaintPacks() {
  return (
    <AdminRoute>
      <ManagePaintPacksInner />
    </AdminRoute>
  );
}
