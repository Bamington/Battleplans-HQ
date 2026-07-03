import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@battleplans/ui';
import Navbar from '@battleplans/ui';
import Button from '@battleplans/ui';
import Badge from '@battleplans/ui';
import Modal from '@battleplans/ui';
import Dropdown, { DropdownItem, DropdownDivider } from '@battleplans/ui';
import type { BadgeColor } from '@battleplans/ui';
import AltArrowLeft from '@battleplans/ui';
import Flag from '@battleplans/ui';
import MenuDots from '@battleplans/ui';
import Pen2 from '@battleplans/ui';
import TrashBinMinimalistic from '@battleplans/ui';
import type { Game, GameStatus } from '../lib/database.types';

const STATUS_COLOR: Record<GameStatus, BadgeColor> = {
  published: 'success',
  beta:      'warning',
  draft:     'gray',
};

const STATUS_LABEL: Record<GameStatus, string> = {
  published: 'Published',
  beta:      'Beta',
  draft:     'Draft',
};

const ALL_STATUSES: GameStatus[] = ['published', 'beta', 'draft'];

export default function ManageGames() {
  const navigate = useNavigate();
  const [games, setGames]     = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // ── Edit modal state ────────────────────────────────────────────────────────
  const [editTarget, setEditTarget]   = useState<Game | null>(null);
  const [editStatus, setEditStatus]   = useState<GameStatus>('draft');
  const [saving, setSaving]           = useState(false);
  const [editError, setEditError]     = useState<string | null>(null);

  // ── Delete modal state ──────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Game | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState<string | null>(null);

  useEffect(() => {
    fetchGames();
  }, []);

  async function fetchGames() {
    setLoading(true);
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('name');
    if (error) { setError(error.message); }
    else        { setGames(data ?? []); }
    setLoading(false);
  }

  // ── Edit ────────────────────────────────────────────────────────────────────

  function openEdit(game: Game) {
    setEditTarget(game);
    setEditStatus(game.status);
    setEditError(null);
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    setSaving(true);
    setEditError(null);

    const { data: updated, error } = await supabase
      .from('games')
      .update({ status: editStatus })
      .eq('id', editTarget.id)
      .select('id');

    if (error) {
      setEditError(error.message);
      setSaving(false);
      return;
    }

    if (!updated || updated.length === 0) {
      setEditError('Update was blocked — you may not have permission to edit games. Check that the games_update RLS policy has been applied in Supabase.');
      setSaving(false);
      return;
    }

    setGames(prev =>
      prev.map(g => g.id === editTarget.id ? { ...g, status: editStatus } : g)
    );
    setSaving(false);
    setEditTarget(null);
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  function openDelete(game: Game) {
    setDeleteTarget(game);
    setDeleteError(null);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);

    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      setDeleteError(error.message);
      setDeleting(false);
      return;
    }

    setGames(prev => prev.filter(g => g.id !== deleteTarget.id));
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
            <Flag className="size-6 text-blue-400 shrink-0" />
            <h1 className="font-heading text-xl text-white">Manage Games</h1>
            {!loading && (
              <span className="font-body text-sm text-gray-500 ml-auto">
                {games.length} {games.length === 1 ? 'game' : 'games'}
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

            {!loading && !error && games.length === 0 && (
              <div className="px-5 py-8 text-center font-body text-sm text-gray-500">
                No games found.
              </div>
            )}

            {!loading && !error && games.map(g => (
              <div
                key={g.id}
                className="flex items-center gap-4 px-5 py-3.5 bg-gray-900 hover:bg-gray-800 transition-colors"
              >
                {/* Game name + slug */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="font-heading text-sm text-white truncate">{g.name}</span>
                  <span className="font-body text-xs text-gray-500">{g.slug}</span>
                </div>

                {/* Status badge */}
                <Badge color={STATUS_COLOR[g.status]} variant="solid" size="sm">
                  {STATUS_LABEL[g.status]}
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
                        aria-label={`${g.name} options`}
                        className="p-1 opacity-50 hover:opacity-100 transition-opacity text-gray-300 hover:text-white"
                      >
                        <MenuDots className="size-4" />
                      </button>
                    }
                  >
                    <DropdownItem
                      icon={<Pen2 className="size-4" />}
                      onClick={() => openEdit(g)}
                    >
                      Edit Game
                    </DropdownItem>
                    <DropdownDivider />
                    <DropdownItem
                      icon={<TrashBinMinimalistic className="size-4" />}
                      onClick={() => openDelete(g)}
                      className="!text-red-400 hover:!text-red-300"
                    >
                      Delete Game
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

      {/* ── Edit Game modal ────────────────────────────────────────────────── */}
      <Modal
        open={editTarget !== null}
        onClose={() => !saving && setEditTarget(null)}
        className="max-w-sm"
      >
        {editTarget && (
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-heading text-base text-white">Edit Game</h2>
              <p className="font-body text-sm text-gray-400">{editTarget.name}</p>
            </div>

            {/* Status picker */}
            <div className="flex flex-col gap-2">
              <span className="font-body text-xs text-gray-400 uppercase tracking-wider">
                Visibility Status
              </span>
              <div className="flex flex-col gap-1.5">
                {ALL_STATUSES.map(s => (
                  <button
                    key={s}
                    type="button"
                    disabled={saving}
                    onClick={() => setEditStatus(s)}
                    className={[
                      'flex items-center gap-3 px-4 py-2.5 rounded-lg border text-left transition-colors',
                      editStatus === s
                        ? 'border-blue-600 bg-blue-950/50'
                        : 'border-gray-700 bg-gray-900 hover:border-gray-600',
                      saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                    ].join(' ')}
                  >
                    <Badge color={STATUS_COLOR[s]} variant="solid" size="sm">
                      {STATUS_LABEL[s]}
                    </Badge>
                    <span className="font-body text-sm text-gray-300">
                      {s === 'published' && 'Visible to all users'}
                      {s === 'beta'      && 'Visible to admins and beta testers'}
                      {s === 'draft'     && 'Visible to admins and draft testers only'}
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
              <h2 className="font-heading text-base text-white">Delete Game?</h2>
              <p className="font-body text-sm text-gray-300">
                This will permanently delete{' '}
                <span className="text-white">{deleteTarget.name}</span> and all
                associated data. This cannot be undone.
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
