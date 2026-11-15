import { useEffect, useState } from 'react';
import AppNavbar from '../components/AppNavbar';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@battleplans/ui';
import { Button } from '@battleplans/ui';
import { Badge } from '@battleplans/ui';
import { Modal } from '@battleplans/ui';
import { Dropdown, DropdownItem, DropdownDivider } from '@battleplans/ui';
import type { BadgeColor } from '@battleplans/ui';
import { AltArrowLeft } from '@battleplans/ui';
import { Flag } from '@battleplans/ui';
import { MenuDots } from '@battleplans/ui';
import { Pen2 } from '@battleplans/ui';
import { TrashBinMinimalistic } from '@battleplans/ui';
import { Select } from '@battleplans/ui';
import { Input } from '@battleplans/ui';
import { Magnifer } from '@battleplans/ui';
import { GAME_PAGES } from './DeckPage';
import type { Game, AccessLevel } from '../lib/database.types';

// Each game has two capabilities, each with its own access level.
//   Simple cards   — static card faces from packs (ListBuilder)
//   Custom builder — the game's custom card builder page
const ACCESS_COLOR: Record<AccessLevel, BadgeColor> = {
  everyone: 'success',
  beta:     'warning',
  admin:    'purple',
  off:      'gray',
};

const ACCESS_LABEL: Record<AccessLevel, string> = {
  everyone: 'Everyone',
  beta:     'Beta',
  admin:    'Admin',
  off:      'Off',
};

const ACCESS_OPTIONS = [
  { value: 'off',      label: 'Off — nobody' },
  { value: 'admin',    label: 'Admin — admins only' },
  { value: 'beta',     label: 'Beta — admins + beta testers' },
  { value: 'everyone', label: 'Everyone — all users' },
];

const isEnabled = (g: Game) => g.simple_access !== 'off' || g.custom_access !== 'off';

export default function ManageGames() {
  const navigate = useNavigate();
  const [games, setGames]     = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // ── Edit modal state ────────────────────────────────────────────────────────
  const [editTarget, setEditTarget]   = useState<Game | null>(null);
  const [editSimple, setEditSimple]   = useState<AccessLevel>('off');
  const [editCustom, setEditCustom]   = useState<AccessLevel>('off');
  const [showAll, setShowAll]         = useState(false);
  const [query, setQuery]             = useState('');
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const visibleGames = searching
    ? games.filter(g => g.name.toLowerCase().includes(q) || g.slug.toLowerCase().includes(q))
    : games.filter(g => showAll || isEnabled(g));
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
    setEditSimple(game.simple_access ?? 'off');
    setEditCustom(game.custom_access ?? 'off');
    setEditError(null);
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    setSaving(true);
    setEditError(null);

    const { data: updated, error } = await supabase
      .from('games')
      .update({ simple_access: editSimple, custom_access: editCustom })
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
      prev.map(g => g.id === editTarget.id ? { ...g, simple_access: editSimple, custom_access: editCustom } : g)
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

      <AppNavbar fixed={false} />

      <div className="flex-1 flex flex-col items-center p-8 pt-10">
        <div className="w-full max-w-2xl flex flex-col gap-6">

          {/* Header */}
          <div className="flex items-center gap-3">
            <Flag className="size-6 text-blue-400 shrink-0" />
            <h1 className="font-heading text-xl text-white">Manage Games</h1>
            {!loading && (
              <span className="font-body text-sm text-gray-500 ml-auto">
                {games.filter(isEnabled).length} enabled of {games.length}
              </span>
            )}
          </div>

          {/* Search — matches name or slug across ALL games (the catalog is
              shared, so finding a game to enable is the common case). */}
          <Input
            leftIcon={<Magnifer className="w-4 h-4" />}
            placeholder="Search games by name or slug"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search games"
          />

          {/* The games catalog is shared with other apps — default to enabled ones. */}
          {!searching && (
            <div className="flex items-center gap-3">
              <Button size="xs" variant={showAll ? 'outline' : 'filled'} color="secondary" onClick={() => setShowAll(false)}>
                Enabled in BattleCards
              </Button>
              <Button size="xs" variant={showAll ? 'filled' : 'outline'} color="secondary" onClick={() => setShowAll(true)}>
                All games
              </Button>
            </div>
          )}

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

            {!loading && !error && visibleGames.length === 0 && (
              <div className="px-5 py-8 text-center font-body text-sm text-gray-500">
                {searching ? `No games match “${query.trim()}”.` : 'No games found.'}
              </div>
            )}

            {!loading && !error && visibleGames.map(g => (
              <div
                key={g.id}
                role="button"
                tabIndex={0}
                aria-label={`Edit ${g.name}`}
                onClick={() => openEdit(g)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(g); } }}
                className="flex items-center gap-4 px-5 py-3.5 bg-gray-900 hover:bg-gray-800 transition-colors cursor-pointer focus:outline-none focus-visible:bg-gray-800"
              >
                {/* Game name + slug */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="font-heading text-sm text-white truncate">{g.name}</span>
                  <span className="font-body text-xs text-gray-500">{g.slug}</span>
                </div>

                {/* Capability badges */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge color={ACCESS_COLOR[g.simple_access ?? 'off']} variant="solid" size="sm">
                    Simple: {ACCESS_LABEL[g.simple_access ?? 'off']}
                  </Badge>
                  <Badge color={ACCESS_COLOR[g.custom_access ?? 'off']} variant="solid" size="sm">
                    Custom: {ACCESS_LABEL[g.custom_access ?? 'off']}
                  </Badge>
                </div>

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

            {/* Capability access levels */}
            <Select
              label="Simple cards"
              helperText="Build decks from static card images in packs."
              options={ACCESS_OPTIONS}
              value={editSimple}
              disabled={saving}
              onChange={e => setEditSimple(e.target.value as AccessLevel)}
            />
            <Select
              label="Custom builder"
              helperText={GAME_PAGES[editTarget.slug]
                ? 'Design cards with this game\'s custom card builder.'
                : 'This game has no custom builder in the app yet, so this has no effect until one is built.'}
              options={ACCESS_OPTIONS}
              value={editCustom}
              disabled={saving}
              onChange={e => setEditCustom(e.target.value as AccessLevel)}
            />
            <p className="font-body text-xs text-gray-500">
              Beta testers are users with the Beta Tester role, or testers added for this game.
              The game is listed for anyone who can use at least one option.
            </p>

            <Button
              variant="outline"
              color="secondary"
              size="sm"
              disabled={saving}
              onClick={() => navigate(`/app/admin/games/${editTarget.id}/tracking`)}
            >
              Manage bars &amp; tokens
            </Button>

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
