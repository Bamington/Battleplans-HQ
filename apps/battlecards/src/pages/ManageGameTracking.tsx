/**
 * ManageGameTracking.tsx — Admin: a game's play-mode bars and tokens
 *
 * Route: /app/admin/games/:gameId/tracking (admin only). Opened from the
 * Edit Game modal in Manage Games.
 *
 * Lists the game's built-in token_definitions (deck_id = null). Admins can add,
 * edit and delete them; the form is <TokenDefinitionForm>. Player-made tokens
 * on individual decks (deck_id set) are not shown here.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppNavbar from '../components/AppNavbar';
import TokenDefinitionForm, {
  emptyTokenDraft, tokenDraftError, tokenDraftFrom, tokenDraftToRow, type TokenDraft,
} from '../components/TokenDefinitionForm';
import TokenBadge from '../components/TokenBadge';
import { paletteFromColorSet, resolveTokenPalette } from '../lib/tokenColorSets';
import {
  supabase, Button, Badge, Modal, Text,
  Dropdown, DropdownItem, DropdownDivider,
  AltArrowLeft, AddCircle, MenuDots, Pen2, TrashBinMinimalistic, Flag,
} from '@battleplans/ui';
import type { Game, TokenDefinition } from '../lib/database.types';

const STYLE_LABEL: Record<TokenDefinition['display_style'], string> = {
  bar: 'Bar', badge: 'Badge', icon: 'Icon', pips: 'Pips',
};

/** One-line summary of a token's numbers, e.g. "0–hp · starts 0 · −1 per turn". */
const summary = (t: TokenDefinition): string => {
  const max = t.stat_role === 'max' && t.stat_key ? t.stat_key : t.max_value != null ? String(t.max_value) : '∞';
  const parts = [`${t.min_value ?? 0}–${max}`];
  if (t.starting_value != null) parts.push(`starts ${t.starting_value}`);
  if (t.refresh_on_turn) parts.push(`${t.refresh_on_turn > 0 ? '+' : '−'}${Math.abs(t.refresh_on_turn)} per turn`);
  if (t.is_toggle) parts.push('on/off');
  if (t.is_activation_token) parts.push('activation');
  return parts.join(' · ');
};

export default function ManageGameTracking() {
  const { gameId = '' } = useParams();
  const navigate = useNavigate();

  const [game, setGame]       = useState<Game | null>(null);
  const [tokens, setTokens]   = useState<TokenDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Edit / add modal: editing = row being edited, or 'new'.
  const [editing, setEditing]     = useState<TokenDefinition | 'new' | null>(null);
  const [draft, setDraft]         = useState<TokenDraft>(emptyTokenDraft());
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<TokenDefinition | null>(null);
  const [deleting, setDeleting]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [g, t] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).maybeSingle(),
      supabase.from('token_definitions').select('*')
        .eq('game_id', gameId).is('deck_id', null).order('sort_order', { nullsFirst: false }),
    ]);
    if (g.error || !g.data) setError('Game not found.');
    else if (t.error) setError('Could not load tokens.');
    else { setGame(g.data as Game); setTokens((t.data ?? []) as TokenDefinition[]); setError(null); }
    setLoading(false);
  }, [gameId]);

  useEffect(() => { load(); }, [load]);

  const statKeys = useMemo(
    () => (game?.stat_schema ?? []).filter(f => f.type === 'number').map(f => f.key),
    [game],
  );

  const openNew = () => { setDraft(emptyTokenDraft()); setSaveError(null); setEditing('new'); };
  const openEdit = (t: TokenDefinition) => { setDraft(tokenDraftFrom(t)); setSaveError(null); setEditing(t); };

  const handleSave = async () => {
    const problem = tokenDraftError(draft);
    if (problem) { setSaveError(problem); return; }
    setSaving(true);
    setSaveError(null);
    const row = tokenDraftToRow(draft);
    const nextOrder = tokens.reduce((m, t) => Math.max(m, t.sort_order ?? 0), 0) + 1;
    const { error: err } = editing === 'new'
      ? await supabase.from('token_definitions').insert({ ...row, game_id: gameId, deck_id: null, sort_order: nextOrder })
      : await supabase.from('token_definitions').update(row).eq('id', (editing as TokenDefinition).id);
    setSaving(false);
    if (err) { console.error('[ManageGameTracking] save failed:', err); setSaveError('Could not save. Please try again.'); return; }
    setEditing(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error: err } = await supabase.from('token_definitions').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (err) { console.error('[ManageGameTracking] delete failed:', err); return; }
    setDeleteTarget(null);
    load();
  };

  const preview = (t: TokenDefinition) => {
    const palette = resolveTokenPalette(t) ?? paletteFromColorSet('Slate')!;
    if (t.display_style === 'badge') {
      return <TokenBadge color={t.display_color ?? palette.active.bg} glyph={(t.display_glyph ?? t.name.slice(0, 2)).toUpperCase()} size={28} shadow={false} />;
    }
    if (t.display_style === 'bar') {
      return <div className="w-2.5 h-7 rounded-full border-2" style={{ background: palette.active.bg, borderColor: palette.active.stroke }} />;
    }
    return <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700" />;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <AppNavbar fixed={false} breadcrumbs={[
        { label: 'Home', href: '/app' },
        { label: 'Admin Tools', href: '/app/admin' },
        { label: 'Manage Games', href: '/app/admin/games' },
        { label: game ? `${game.name} Tracking` : 'Tracking' },
      ]} />

      <div className="flex-1 flex flex-col items-center p-8 pt-10">
        <div className="w-full max-w-2xl flex flex-col gap-6">

          <div className="flex items-center gap-3">
            <Flag className="size-6 text-blue-400 shrink-0" />
            <div className="flex flex-col min-w-0">
              <h1 className="font-heading text-xl text-white">Tracking</h1>
              {game && <span className="font-body text-sm text-gray-400 truncate">{game.name}</span>}
            </div>
            <Button className="ml-auto" size="sm" leftIcon={<AddCircle className="size-4" />} onClick={openNew} disabled={!game}>
              Add token
            </Button>
          </div>

          <Text size="sm" color="secondary">
            Bars and tokens players use in Play mode for every deck of this game. Tokens players create on their own decks aren’t shown here.
          </Text>

          <div className="flex flex-col divide-y divide-gray-800 border border-gray-800 rounded-xl overflow-hidden">
            {loading && <div className="px-5 py-8 text-center font-body text-sm text-gray-500">Loading…</div>}
            {!loading && error && <div className="px-5 py-8 text-center font-body text-sm text-red-400">{error}</div>}
            {!loading && !error && tokens.length === 0 && (
              <div className="px-5 py-8 text-center font-body text-sm text-gray-500">No bars or tokens yet.</div>
            )}
            {!loading && !error && tokens.map(t => (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                aria-label={`Edit ${t.name}`}
                onClick={() => openEdit(t)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(t); } }}
                className="flex items-center gap-4 px-5 py-3.5 bg-gray-900 hover:bg-gray-800 transition-colors cursor-pointer focus:outline-none focus-visible:bg-gray-800"
              >
                <div className="w-8 flex justify-center shrink-0">{preview(t)}</div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="font-heading text-sm text-white truncate">{t.name}</span>
                  <span className="font-body text-xs text-gray-500 truncate">{summary(t)}</span>
                </div>
                <Badge color="gray" variant="outline" size="sm">{STYLE_LABEL[t.display_style]}</Badge>
                <div onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                  <Dropdown
                    align="right"
                    menuClassName="w-40"
                    trigger={
                      <button type="button" aria-label={`${t.name} options`}
                        className="p-1 opacity-50 hover:opacity-100 transition-opacity text-gray-300 hover:text-white">
                        <MenuDots className="size-4" />
                      </button>
                    }
                  >
                    <DropdownItem icon={<Pen2 className="size-4" />} onClick={() => openEdit(t)}>Edit</DropdownItem>
                    <DropdownDivider />
                    <DropdownItem icon={<TrashBinMinimalistic className="size-4" />} onClick={() => setDeleteTarget(t)}
                      className="!text-red-400 hover:!text-red-300">
                      Delete
                    </DropdownItem>
                  </Dropdown>
                </div>
              </div>
            ))}
          </div>

          <div className="flex">
            <Button variant="outline" color="secondary" leftIcon={<AltArrowLeft className="size-4" />}
              onClick={() => navigate('/app/admin/games')}>
              Back to Manage Games
            </Button>
          </div>
        </div>
      </div>

      {/* ── Add / edit token ─────────────────────────────────────────────── */}
      <Modal open={editing !== null} onClose={() => !saving && setEditing(null)} className="max-w-lg w-full">
        {editing !== null && (
          <form className="flex flex-col gap-4 p-5 max-h-[85vh] overflow-y-auto" onSubmit={e => { e.preventDefault(); handleSave(); }}>
            <h2 className="font-heading text-base text-white">{editing === 'new' ? 'Add token' : `Edit ${editing.name}`}</h2>
            <TokenDefinitionForm value={draft} onChange={setDraft} disabled={saving} statKeys={statKeys} />
            {saveError && <p className="font-body text-sm text-red-400">{saveError}</p>}
            <div className="flex items-center justify-end gap-3 pt-1">
              <Button type="button" variant="ghost" color="secondary" disabled={saving} onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" color="primary" loading={saving}>{editing === 'new' ? 'Add token' : 'Save'}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Delete confirmation ──────────────────────────────────────────── */}
      <Modal open={deleteTarget !== null} onClose={() => !deleting && setDeleteTarget(null)} className="max-w-sm">
        {deleteTarget && (
          <div className="flex flex-col gap-3 p-5">
            <TrashBinMinimalistic className="w-8 h-8 text-red-400" />
            <h3 className="font-heading text-xl text-white tracking-tight">Delete {deleteTarget.name}?</h3>
            <p className="font-body text-base text-gray-300">
              It disappears from Play mode for every {game?.name ?? ''} deck, and any values players have tracked with it are lost. This can’t be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" size="sm" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button color="danger" size="sm" loading={deleting} onClick={handleDelete}>Delete token</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
