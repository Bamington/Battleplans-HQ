import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import Dropdown, { DropdownItem, DropdownDivider } from '../components/Dropdown';
import AltArrowLeft from '../icons/AltArrowLeft';
import Box from '../icons/Box';
import MenuDots from '../icons/MenuDots';
import Pen2 from '../icons/Pen2';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';
import type { PackWithGame } from '../lib/database.types';

export default function ManagePacks() {
  const navigate = useNavigate();
  const [packs, setPacks]     = useState<PackWithGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // ── Edit modal state ────────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<PackWithGame | null>(null);
  const [editPublic, setEditPublic] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [editError, setEditError]   = useState<string | null>(null);

  // ── Delete modal state ──────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<PackWithGame | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState<string | null>(null);

  useEffect(() => {
    fetchPacks();
  }, []);

  async function fetchPacks() {
    setLoading(true);
    const { data, error } = await supabase
      .from('packs')
      .select('*, game:games(*)')
      .order('name');
    if (error) { setError(error.message); }
    else        { setPacks((data ?? []) as PackWithGame[]); }
    setLoading(false);
  }

  // ── Edit ────────────────────────────────────────────────────────────────────

  function openEdit(pack: PackWithGame) {
    setEditTarget(pack);
    setEditPublic(pack.is_public);
    setEditError(null);
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    setSaving(true);
    setEditError(null);

    const { error } = await supabase
      .from('packs')
      .update({ is_public: editPublic })
      .eq('id', editTarget.id);

    if (error) {
      setEditError(error.message);
      setSaving(false);
      return;
    }

    setPacks(prev =>
      prev.map(p => p.id === editTarget.id ? { ...p, is_public: editPublic } : p)
    );
    setSaving(false);
    setEditTarget(null);
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  function openDelete(pack: PackWithGame) {
    setDeleteTarget(pack);
    setDeleteError(null);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);

    const { error } = await supabase
      .from('packs')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      setDeleteError(error.message);
      setDeleting(false);
      return;
    }

    setPacks(prev => prev.filter(p => p.id !== deleteTarget.id));
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
            <Box className="size-6 text-blue-400 shrink-0" />
            <h1 className="font-heading text-xl text-white">Manage Packs</h1>
            {!loading && (
              <span className="font-body text-sm text-gray-500 ml-auto">
                {packs.length} {packs.length === 1 ? 'pack' : 'packs'}
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

            {!loading && !error && packs.length === 0 && (
              <div className="px-5 py-8 text-center font-body text-sm text-gray-500">
                No packs found.
              </div>
            )}

            {!loading && !error && packs.map(p => (
              <div
                key={p.id}
                className="flex items-center gap-4 px-5 py-3.5 bg-gray-900 hover:bg-gray-800 transition-colors"
              >
                {/* Pack name + game */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="font-heading text-sm text-white truncate">{p.name}</span>
                  <span className="font-body text-xs text-gray-500">{p.game.name}</span>
                </div>

                {/* Public / Private badge */}
                <Badge color={p.is_public ? 'success' : 'gray'} variant="solid" size="sm">
                  {p.is_public ? 'Public' : 'Private'}
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
                        aria-label={`${p.name} options`}
                        className="p-1 opacity-50 hover:opacity-100 transition-opacity text-gray-300 hover:text-white"
                      >
                        <MenuDots className="size-4" />
                      </button>
                    }
                  >
                    <DropdownItem
                      icon={<Pen2 className="size-4" />}
                      onClick={() => openEdit(p)}
                    >
                      Edit Pack
                    </DropdownItem>
                    <DropdownDivider />
                    <DropdownItem
                      icon={<TrashBinMinimalistic className="size-4" />}
                      onClick={() => openDelete(p)}
                      className="!text-red-400 hover:!text-red-300"
                    >
                      Delete Pack
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

      {/* ── Edit Pack modal ────────────────────────────────────────────────── */}
      <Modal
        open={editTarget !== null}
        onClose={() => !saving && setEditTarget(null)}
        className="max-w-sm"
      >
        {editTarget && (
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-heading text-base text-white">Edit Pack</h2>
              <p className="font-body text-sm text-gray-400">{editTarget.name}</p>
            </div>

            {/* Visibility picker */}
            <div className="flex flex-col gap-2">
              <span className="font-body text-xs text-gray-400 uppercase tracking-wider">
                Visibility
              </span>
              <div className="flex flex-col gap-1.5">
                {([true, false] as const).map(isPublic => (
                  <button
                    key={String(isPublic)}
                    type="button"
                    disabled={saving}
                    onClick={() => setEditPublic(isPublic)}
                    className={[
                      'flex items-center gap-3 px-4 py-2.5 rounded-lg border text-left transition-colors',
                      editPublic === isPublic
                        ? 'border-blue-600 bg-blue-950/50'
                        : 'border-gray-700 bg-gray-900 hover:border-gray-600',
                      saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                    ].join(' ')}
                  >
                    <Badge color={isPublic ? 'success' : 'gray'} variant="solid" size="sm">
                      {isPublic ? 'Public' : 'Private'}
                    </Badge>
                    <span className="font-body text-sm text-gray-300">
                      {isPublic
                        ? 'Visible to all users in the pack browser'
                        : 'Only visible to the pack owner'}
                    </span>
                  </button>
                ))}
              </div>
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
              <h2 className="font-heading text-base text-white">Delete Pack?</h2>
              <p className="font-body text-sm text-gray-300">
                This will permanently delete{' '}
                <span className="text-white">{deleteTarget.name}</span> and all
                of its cards and content. This cannot be undone.
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
