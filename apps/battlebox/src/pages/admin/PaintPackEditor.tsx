import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminRoute, AltArrowLeft, Button, Input, Sheet, AddCircle } from '@battleplans/ui';
import AppNavbar from '../../components/AppNavbar';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ExistingPaintPicker, CloseIcon } from '../../components/paintPickerBits';
import {
  fetchPaintPackEdit, updatePaintPack, deletePaintPack,
  fetchPackPaints, addPackItems, removePackItem,
} from '../../hooks/usePaintPacks';
import type { LibraryPaint } from '../../hooks/usePaintPacks';

const HEX = /^#[0-9a-fA-F]{6}$/;

const BattleBoxLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattleBox</span>
);

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="flex items-center gap-3">
      <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-primary-600' : 'bg-neutral-700'}`}>
        <span className={`pointer-events-none inline-block size-4 rounded-full bg-white shadow transform transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </span>
      <span className="font-body text-sm text-white">{label}</span>
    </button>
  );
}

function TrashIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M3 4.5h10M6.5 4V3h3v1M5 4.5l.5 8h5l.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaintPackEditorInner() {
  const navigate = useNavigate();
  const { packId } = useParams<{ packId: string }>();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isOfficial, setIsOfficial] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(false);

  const [paints, setPaints] = useState<LibraryPaint[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function refreshPaints() {
    if (!packId) return;
    setPaints(await fetchPackPaints(packId));
  }

  useEffect(() => {
    if (!packId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const meta = await fetchPaintPackEdit(packId);
      if (cancelled) return;
      if (!meta) { setNotFound(true); setLoading(false); return; }
      setName(meta.name); setBrand(meta.brand ?? ''); setDescription(meta.description ?? '');
      setIsPublic(meta.is_public); setIsOfficial(meta.is_official);
      await refreshPaints();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId]);

  const save = async () => {
    if (!packId) return;
    setSaving(true); setSavedAt(false);
    const { error } = await updatePaintPack(packId, {
      name: name.trim(), brand: brand.trim() || null, description: description.trim() || null,
      is_public: isPublic, is_official: isOfficial,
    });
    setSaving(false);
    if (!error) { setSavedAt(true); setTimeout(() => setSavedAt(false), 2000); }
  };

  const handleAdd = async () => {
    if (!packId || !selectedIds.length) return;
    setAdding(true);
    await addPackItems(packId, selectedIds, paints.length);
    setAdding(false);
    setSelectedIds([]);
    setAddOpen(false);
    refreshPaints();
  };

  const handleRemove = async (id: number) => {
    if (!packId) return;
    await removePackItem(packId, id);
    setPaints(prev => prev.filter(p => p.id !== id));
  };

  const doDelete = async () => {
    if (!packId) return;
    await deletePaintPack(packId);
    setConfirmDelete(false);
    navigate('/app/admin/paint-packs');
  };

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">
      <AppNavbar fixed={false} logo={<BattleBoxLogo />} breadcrumbs={[
        { label: 'Home', href: '/app' },
        { label: 'Admin Tools', href: '/app/admin' },
        { label: 'Paint Packs', href: '/app/admin/paint-packs' },
        { label: loading ? 'Edit' : name || 'Edit' },
      ]} />

      <div className="flex-1 flex flex-col items-center p-8 pt-10">
        <div className="w-full max-w-2xl flex flex-col gap-6">

          {loading ? (
            <p className="py-12 text-center font-body text-sm text-neutral-500">Loading…</p>
          ) : notFound ? (
            <p className="py-12 text-center font-body text-sm text-red-400">Pack not found.</p>
          ) : (
            <>
              {/* Metadata */}
              <div className="flex flex-col gap-4">
                <Input label="Name" required value={name} onChange={e => setName(e.target.value)} />
                <Input label="Brand" placeholder="e.g. Citadel" value={brand} onChange={e => setBrand(e.target.value)} />
                <div className="flex flex-col gap-1.5">
                  <span className="font-body text-sm font-medium text-white">Description</span>
                  <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="A short blurb about this pack…"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 font-body text-sm text-white placeholder-neutral-500 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div className="flex flex-col gap-3">
                  <Switch checked={isPublic} onChange={setIsPublic} label="Public — visible to all users" />
                  <Switch checked={isOfficial} onChange={setIsOfficial} label="Official — show the Official badge" />
                </div>
                <div className="flex items-center gap-3">
                  <Button color="primary" loading={saving} disabled={saving || name.trim() === ''} onClick={save}>Save</Button>
                  {savedAt && <span className="font-body text-sm text-emerald-400">Saved</span>}
                </div>
              </div>

              {/* Paints */}
              <div className="flex flex-col gap-2 border-t border-neutral-800 pt-5">
                <div className="flex items-center gap-3">
                  <h2 className="font-heading text-lg text-white">Paints</h2>
                  <span className="font-body text-sm text-neutral-500">{paints.length}</span>
                  <Button variant="outline" color="primary" size="sm" leftIcon={<AddCircle className="w-4 h-4" />} onClick={() => setAddOpen(true)} className="ml-auto">
                    Add Paints
                  </Button>
                </div>

                {paints.length === 0 ? (
                  <p className="py-6 text-center font-body text-sm text-neutral-500">No paints yet. Add some.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {paints.map(p => (
                      <div key={p.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-neutral-700 bg-neutral-900">
                        <span className="w-5 h-5 rounded-full shrink-0 border border-neutral-600"
                          style={HEX.test(p.swatch) ? { backgroundColor: p.swatch } : undefined} aria-hidden="true" />
                        <span className="flex-1 min-w-0 flex flex-col">
                          <span className="font-body text-sm text-white truncate">{p.name}</span>
                          <span className="font-body text-xs text-neutral-400 truncate">{[p.brand, p.sub_brand].filter(Boolean).join(' ')} · {p.type}</span>
                        </span>
                        <button type="button" onClick={() => handleRemove(p.id)} aria-label={`Remove ${p.name}`} className="p-1 rounded-md text-red-400 hover:bg-white/5">
                          <TrashIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Danger zone */}
              <div className="flex items-center justify-between border-t border-neutral-800 pt-5">
                <Button variant="outline" color="secondary" leftIcon={<AltArrowLeft className="size-4" />} onClick={() => navigate('/app/admin/paint-packs')}>
                  Back to Paint Packs
                </Button>
                <Button variant="ghost" color="danger" leftIcon={<TrashIcon />} onClick={() => setConfirmDelete(true)}>
                  Delete Pack
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add-paints sheet */}
      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        className="max-w-lg"
        footer={
          <div className="p-4 border-t border-neutral-800">
            <Button color="primary" disabled={selectedIds.length === 0 || adding} loading={adding} onClick={handleAdd} className="w-full justify-center">
              Add{selectedIds.length ? ` ${selectedIds.length}` : ''} {selectedIds.length === 1 ? 'paint' : 'paints'}
            </Button>
          </div>
        }
      >
        <div className="px-5 pt-4 pb-2 flex items-center justify-between shrink-0">
          <h2 className="font-heading text-xl text-white">Add Paints</h2>
          <button type="button" onClick={() => setAddOpen(false)} aria-label="Close" className="text-neutral-400 hover:text-white"><CloseIcon /></button>
        </div>
        <div className="px-5 pb-4 lg:overflow-y-auto lg:flex-1 lg:min-h-0">
          <ExistingPaintPicker
            selectedIds={selectedIds}
            onToggle={id => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
            excludeIds={paints.map(p => p.id)}
          />
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete pack?"
        message={`Permanently delete “${name}”? Users who added it will lose it. This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

export default function PaintPackEditor() {
  return (
    <AdminRoute>
      <PaintPackEditorInner />
    </AdminRoute>
  );
}
