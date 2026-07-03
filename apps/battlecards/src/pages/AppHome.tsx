/**
 * AppHome.tsx — Main app dashboard (logged-in home screen)
 *
 * Three-panel layout:
 *   Left   — "Packs"          — public packs the user hasn't imported (and didn't author) + create / manage CTAs
 *   Middle — "Your Decks"     — user's decks fetched from Supabase + create button
 *   Right  — "News & Updates" — latest blog / release-note preview
 *
 * Packs panel states:
 *   Loading  — spinner while the initial fetch is in flight
 *   Error    — brief message if the fetch fails
 *   Empty    — soft-CTA copy when no public packs are available
 *   Populated — list of PackListItem + Create / (conditional) Manage CTAs
 *
 * Deck panel states:
 *   Loading  — spinner while the initial fetch is in flight
 *   Error    — brief message if the fetch fails
 *   Empty    — onboarding copy when the user has no decks yet (Figma node 293:3712)
 *   Populated — deck list + "Create New Deck" button
 *
 * Responsive behaviour (matches Figma):
 *   Desktop / Tablet (≥ md, 768 px+)
 *     Panels sit side-by-side, centred in the viewport, max-w-[384px] each.
 *     Body padding: 36px desktop, 12px tablet.
 *
 *   Mobile (< md)
 *     Panels remain side-by-side but the container overflows horizontally,
 *     so the user can swipe to see the second panel.
 *     Each panel has a minimum width of 300px.
 *
 * Matches Figma:
 *   Desktop — node 191:8220
 *   Tablet  — node 289:2461
 *   Mobile  — node 289:2459
 *
 * Route: /app
 */

import { useState, useEffect } from 'react';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Button from '../components/Button';
import DeckListItem from '../components/DeckListItem';
import PackListItem, { type PackBadge } from '../components/PackListItem';
import BlogEntryPreview from '../components/BlogEntryPreview';
import Modal from '../components/Modal';
import GamePickerItem from '../components/GamePickerItem';
import Input from '../components/Input';
import HR from '../components/HR';
import ImportListModal from '../components/ImportListModal';
import AddCircle from '../icons/AddCircle';
import Pen2 from '../icons/Pen2';
import Box from '../icons/Box';
import Widget2 from '../icons/Widget2';
import Layers from '../icons/Layers';
import InfoCircle from '../icons/InfoCircle';
import AltArrowRight from '../icons/AltArrowRight';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';
import UserRounded from '../icons/UserRounded';
import FileText from '../icons/FileText';
import Star from '../icons/Star';
import { supabase } from '../lib/supabase';
import { duplicateDeck } from '../lib/duplicateDeck';
import type { DeckWithGame, PackWithGame } from '../lib/database.types';

/** Deck with nested game + aggregated card count from Supabase. */
type DeckWithCards = DeckWithGame & { cards: [{ count: number }] };

/** A pack ready to render in the home-screen list. Combines the
 *  pack row + joined game + a pre-computed list of content badges.
 *  `source` is set on rows in the "Your Packs" section and drives
 *  the delete behaviour (own → DELETE pack; imported → DELETE
 *  pack_imports row). Browse-list rows leave it undefined. */
type PackSource = 'own' | 'imported';
type PackForList = PackWithGame & {
  badges: PackBadge[];
  source?: PackSource;
};

// ── Asset imports ─────────────────────────────────────────────────────────────
// Vite resolves these statically at build time.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — path contains spaces, TS path resolver struggles but Vite handles fine
import iconBloodBowl from '../assets/games/card assets/blood-bowl/icon.png';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import iconHalo from '../assets/games/card assets/halo/icon.png';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import iconKillTeam from '../assets/games/card assets/kill-team/icon.png';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — path contains spaces
import iconStarcraft from '../assets/games/card assets/starcraft/icon.svg';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — path contains spaces
import iconRyg from '../assets/games/card assets/ryg/icon.svg';
import logoRyg from '../assets/games/logo-ryg.png';
import logoHaloFlashpoint from '../assets/games/logo-halo-flashpoint.png';
import logoBloodBowl from '../assets/games/logo-blood-bowl.png';
import logoKillTeam from '../assets/games/logo-kill-team.png';
// Placeholder SVG for now — swap to logo-starcraft.png once branded art lands.
import logoStarcraft from '../assets/games/logo-starcraft.svg';

// ── Game definitions ──────────────────────────────────────────────────────────
// Keyed by the game's slug (matches the value seeded into public.games).
// Holds UI-only data (logos, thumbnails) that lives in the app, not the DB.

const GAMES = [
  {
    id: 'halo-flashpoint',
    name: 'Halo: Flashpoint',
    logoSrc: logoHaloFlashpoint,
    thumbnailSrc: iconHalo as string,
    thumbnailBg: 'bg-gradient-to-b from-[#252525] to-[#181d24]',
  },
  {
    id: 'blood-bowl',
    name: 'Blood Bowl',
    logoSrc: logoBloodBowl,
    thumbnailSrc: iconBloodBowl as string,
    thumbnailBg: 'bg-[#15417e]',
  },
  {
    id: 'kill-team',
    name: 'Kill Team',
    logoSrc: logoKillTeam,
    thumbnailSrc: iconKillTeam as string,
    thumbnailBg: 'bg-gray-800',
  },
  {
    id: 'starcraft',
    name: 'StarCraft',
    logoSrc: logoStarcraft,
    thumbnailSrc: iconStarcraft as string,
    thumbnailBg: 'bg-gradient-to-b from-[#0b1a33] to-[#061020]',
  },
  {
    id: 'ryg',
    name: 'Repent Ye Foolish Gods',
    logoSrc: logoRyg,
    thumbnailSrc: iconRyg as string,
    thumbnailBg: 'bg-[#1a1612]',
  },
] as const;

type GameSlug = typeof GAMES[number]['id'];

/** Returns the UI assets for a game slug, or undefined if unknown. */
const gameAssets = (slug: string) => GAMES.find(g => g.id === slug);

// ── Placeholder news post ─────────────────────────────────────────────────────

const PLACEHOLDER_POST = {
  title: 'Example Release Note',
  body: "This is a placeholder release note. It has a maximum of 3 lines, after which the text will be truncated. But don't worry, there's a button to view the full update!",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AppHome() {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();

  // ── Deck list state ────────────────────────────────────────────────────────
  const [decks,      setDecks]      = useState<DeckWithCards[]>([]);
  const [gameIdMap,  setGameIdMap]  = useState<Record<string, string>>({});
  const [userId,     setUserId]     = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Packs list state ───────────────────────────────────────────────────────
  // Packs displayed here are: is_public = true AND owner != current user AND
  // not yet imported by current user. The Manage button below the list is
  // shown only when the user has authored or imported at least one pack.
  // The home screen shows two sections:
  //   yourPacks: every pack the user owns or has imported — these
  //              navigate to the editor on click instead of showing a
  //              download button.
  //   packs:     the public browse list (excludes the above).
  const [yourPacks,         setYourPacks]         = useState<PackForList[]>([]);
  const [packs,             setPacks]             = useState<PackForList[]>([]);
  const [packsLoading,      setPacksLoading]      = useState(true);
  const [packsError,        setPacksError]        = useState<string | null>(null);
// While a download is in flight: ID of the pack being imported (used to
  // ignore concurrent clicks and show a spinner) + inline error from the
  // most recent failed import. Cleared on next successful import or refresh.
  const [importingId,       setImportingId]       = useState<string | null>(null);
  const [importError,       setImportError]       = useState<string | null>(null);

  // Pack delete / uninstall confirmation state. Shared by both Your
  // Packs row actions. Drives the modal copy and decides whether
  // Continue deletes the pack row outright (own) or just the
  // pack_imports row (imported uninstall).
  const [packToDelete,      setPackToDelete]      = useState<PackForList | null>(null);
  const [deletingPack,      setDeletingPack]      = useState(false);
  const [deletePackError,   setDeletePackError]   = useState<string | null>(null);

  // ── Create-pack flow state ────────────────────────────────────────────────
  // Two sequential modals: a confirmation step, then the form.
  const [showPackConfirm,   setShowPackConfirm]   = useState(false);
  const [showPackCreate,    setShowPackCreate]    = useState(false);
  const [packName,          setPackName]          = useState('');
  const [packDescription,   setPackDescription]   = useState('');
  const [packGame,          setPackGame]          = useState<GameSlug | null>(null);
  const [creatingPack,      setCreatingPack]      = useState(false);
  const [packCreateError,   setPackCreateError]   = useState<string | null>(null);

  const packNameTrimmed = packName.trim();
  const packDescTrimmed = packDescription.trim();
  const canCreatePack =
    packNameTrimmed.length >= 1 && packNameTrimmed.length <= 99 &&
    packDescTrimmed.length >= 1 && packDescTrimmed.length <= 500 &&
    packGame !== null;

  // ── Delete confirmation state ──────────────────────────────────────────────
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting,        setDeleting]        = useState(false);

  // ── Duplicate state ────────────────────────────────────────────────────────
  // ID of the deck currently being duplicated (guards against concurrent
  // clicks) + inline error from the most recent failed duplication.
  const [duplicatingId,  setDuplicatingId]  = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  // ── Import modal state ──────────────────────────────────────────────────────
  const [showImport,   setShowImport]   = useState(false);

  // ── Modal state ────────────────────────────────────────────────────────────
  const [showModal,    setShowModal]    = useState(false);
  const [deckName,     setDeckName]     = useState('');
  const [selectedGame, setSelectedGame] = useState<GameSlug | null>(null);
  const [creating,     setCreating]     = useState(false);
  const [createError,  setCreateError]  = useState<string | null>(null);

  const trimmed   = deckName.trim();
  const canCreate = trimmed.length >= 1 && trimmed.length <= 99 && selectedGame !== null;

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setFetchError(null);
    try {
      // Get the current user's ID (needed for inserts; RLS filters selects automatically)
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? null;
      setUserId(uid);

      // Fetch all games to build a slug → UUID map for the create flow
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select('id, slug');
      if (gamesError) throw gamesError;

      const idMap: Record<string, string> = {};
      gamesData?.forEach(g => { idMap[g.slug] = g.id; });
      setGameIdMap(idMap);

      // Fetch the user's decks, joined with their game row + card count
      await reloadDecks();

      // Packs fetch runs independently so deck rendering isn't blocked
      // by pack errors (and vice versa).
      loadPacks(uid);
    } catch {
      setFetchError('Failed to load your decks. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }

  // Fetch the user's decks (joined with game + card count) into state.
  // Throws on error so loadData's catch can surface the failure; callers
  // refreshing in the background can ignore the rejection.
  async function reloadDecks() {
    const { data, error } = await supabase
      .from('decks')
      .select('*, game:games(id, name, slug, stat_schema, created_at), cards(count)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    setDecks((data ?? []) as DeckWithCards[]);
  }

  // ── Load packs ─────────────────────────────────────────────────────────────
  //
  // 1. Fetch public packs the user did not author (joined with game).
  // 2. Fetch the user's pack_imports + their own packs to derive:
  //      a) which packs to exclude from the browse list
  //      b) whether to show the "Manage your packs" button
  // 3. For each surviving pack, fetch its cards (card_type) and addons
  //    (addon_type) — used to build the content badges. N+1 is fine at
  //    early-stage data volume; revisit with a view if packs grow large.

  /** Build the per-pack content-summary badges (Units / per addon-type /
   *  Rules) by counting joined rows. Shared by both lists. */
  async function enrichPackWithBadges(pack: PackWithGame): Promise<PackForList> {
    const [cardsRes, addonsRes] = await Promise.all([
      supabase.from('cards').select('card_type').eq('pack_id', pack.id),
      supabase
        .from('addons')
        .select('addon_type:addon_types(id, name)')
        .eq('pack_id', pack.id),
    ]);
    const cards  = cardsRes.data ?? [];
    const addons = addonsRes.data ?? [];

    const operatives = cards.filter(c => c.card_type === 'operative').length;
    const rules      = cards.filter(c => c.card_type === 'rule').length;

    // Bucket addons by type name (per-game, e.g. "Skills", "Weapons", "Abilities").
    // Supabase types the nested select as an array (it can't infer many-to-one
    // from the column metadata alone), but the FK is many-to-one so we know
    // it's either a single object or wrapped in a one-element array. Handle both.
    const byType = new Map<string, number>();
    for (const a of addons) {
      const raw = (a as unknown as { addon_type: { name: string } | { name: string }[] | null }).addon_type;
      const name = Array.isArray(raw) ? raw[0]?.name : raw?.name;
      if (!name) continue;
      byType.set(name, (byType.get(name) ?? 0) + 1);
    }

    const badges: PackBadge[] = [];
    if (operatives > 0) badges.push({ label: `${operatives} Units`, icon: <UserRounded className="size-3.5" /> });
    for (const [name, count] of byType) {
      badges.push({ label: `${count} ${name}`, icon: <Star className="size-3.5" /> });
    }
    if (rules > 0) badges.push({ label: `${rules} Rules`, icon: <FileText className="size-3.5" /> });

    return { ...pack, badges };
  }

  async function loadPacks(uid: string | null) {
    setPacksLoading(true);
    setPacksError(null);
    try {
      const packSelect = '*, game:games(id, name, slug, stat_schema, print_size, bleed_size, created_at)';

      // Three parallel fetches:
      //   a) Public packs not owned by me — candidates for the browse list.
      //   b) Packs I own — first half of "Your Packs".
      //   c) My pack_imports — second half of "Your Packs".
      const [publicRes, ownRes, importsRes] = await Promise.all([
        (uid
          ? supabase.from('packs').select(packSelect).eq('is_public', true).neq('owner_user_id', uid)
          : supabase.from('packs').select(packSelect).eq('is_public', true)
        ).order('created_at', { ascending: false }),
        uid
          ? supabase.from('packs').select(packSelect).eq('owner_user_id', uid).order('created_at', { ascending: false })
          : Promise.resolve({ data: [] as PackWithGame[], error: null }),
        supabase.from('pack_imports').select('pack_id'),
      ]);
      if (publicRes.error) throw publicRes.error;
      if (ownRes.error)    throw ownRes.error;
      if (importsRes.error) throw importsRes.error;

      const importedIds = new Set((importsRes.data ?? []).map(r => r.pack_id));

      // Fetch the full pack rows for imported packs (separate query — can't
      // join through pack_imports cleanly, and the in() filter skips empty).
      let importedPacks: PackWithGame[] = [];
      if (importedIds.size > 0) {
        const { data, error } = await supabase
          .from('packs')
          .select(packSelect)
          .in('id', Array.from(importedIds))
          .order('created_at', { ascending: false });
        if (error) throw error;
        importedPacks = (data ?? []) as PackWithGame[];
      }

      // Tag each Your Packs row with its source so the menu can show
      // "Delete Pack" (own) or "Uninstall Pack" (imported). When a pack
      // is both owned and imported (rare but possible), prefer 'own' so
      // the user gets the full delete option.
      const ownIds = new Set(((ownRes.data ?? []) as PackWithGame[]).map(p => p.id));
      const yourMap = new Map<string, PackWithGame>();
      for (const p of (ownRes.data ?? []) as PackWithGame[]) yourMap.set(p.id, p);
      for (const p of importedPacks)                        yourMap.set(p.id, p);

      // Browse list excludes anything already in Your Packs (own + imported).
      const browseable = ((publicRes.data ?? []) as PackWithGame[])
        .filter(p => !yourMap.has(p.id));

      // Enrich both lists with badges in parallel.
      const [yourEnriched, browseEnriched] = await Promise.all([
        Promise.all(Array.from(yourMap.values()).map(async pack => ({
          ...await enrichPackWithBadges(pack),
          source: ownIds.has(pack.id) ? 'own' : 'imported' as PackSource,
        }))),
        Promise.all(browseable.map(enrichPackWithBadges)),
      ]);

      setYourPacks(yourEnriched);
      setPacks(browseEnriched);
    } catch {
      setPacksError('Failed to load packs. Please refresh and try again.');
    } finally {
      setPacksLoading(false);
    }
  }

  // ── Import pack ───────────────────────────────────────────────────────────
  //
  // Calls the import_pack RPC, which atomically deep-clones the pack into
  // the user's tables. Optimistic UI: the pack is removed from the browse
  // list immediately on click and the Manage button appears (if not already
  // visible). On error we restore both pieces of state and surface the
  // message inline. import_pack runs as SECURITY DEFINER, so the success
  // path is "no error returned" rather than a row payload.

  // ── Delete / uninstall an owned-or-imported pack ──────────────────────
  // The same UX surface ("…" → Delete) covers two different DB operations
  // depending on whether the pack is owned or imported. Confirmation is
  // gated by a small modal so it's a deliberate action.

  function requestDeletePack(pack: PackForList) {
    setDeletePackError(null);
    setPackToDelete(pack);
  }

  function cancelDeletePack() {
    if (deletingPack) return;
    setPackToDelete(null);
    setDeletePackError(null);
  }

  async function handleConfirmDeletePack() {
    if (!packToDelete) return;
    setDeletingPack(true);
    setDeletePackError(null);

    const { error } = packToDelete.source === 'own'
      // Own: cascade removes pack contents (cards / addons / keywords)
      // via the existing FK ON DELETE CASCADE chain.
      ? await supabase.from('packs').delete().eq('id', packToDelete.id)
      // Imported: remove only the pack_imports row. The pack stays in
      // the DB (still public for others) and our local clones survive.
      : await supabase.from('pack_imports')
          .delete()
          .eq('pack_id', packToDelete.id)
          .eq('user_id', userId!);

    setDeletingPack(false);

    if (error) {
      setDeletePackError(`Couldn't ${packToDelete.source === 'own' ? 'delete' : 'uninstall'} "${packToDelete.name}". Please try again.`);
      return;
    }

    // Optimistic: drop the row from yourPacks; reload to refresh
    // anything else (browse list might now have this pack visible
    // again after an uninstall).
    setYourPacks(prev => prev.filter(p => p.id !== packToDelete.id));
    setPackToDelete(null);
    loadPacks(userId);
  }

  const handleImport = async (pack: PackForList) => {
    if (importingId) return; // ignore concurrent clicks
    setImportingId(pack.id);
    setImportError(null);

    // Optimistic update: remove from browse, add to "Your Packs".
    setPacks(prev => prev.filter(p => p.id !== pack.id));
    setYourPacks(prev => [pack, ...prev]);

    const { error } = await supabase.rpc('import_pack', { p_pack_id: pack.id });
    setImportingId(null);

    if (error) {
      // Revert both lists.
      setPacks(prev => [pack, ...prev]);
      setYourPacks(prev => prev.filter(p => p.id !== pack.id));
      setImportError(`Couldn't import "${pack.name}". Please try again.`);
    }
  };

  // ── Create pack flow ──────────────────────────────────────────────────────
  // Two-step modal flow. Step 1 (confirm) reassures the user that they
  // don't need a pack just to make a deck. Step 2 (form) collects name,
  // description, and game, then INSERTs and navigates to the editor.

  const openPackConfirm = () => {
    // Reset form state every time we open so a previously cancelled
    // attempt doesn't leak in.
    setPackName('');
    setPackDescription('');
    setPackGame(null);
    setPackCreateError(null);
    setShowPackConfirm(true);
  };

  const advanceToPackForm = () => {
    setShowPackConfirm(false);
    setShowPackCreate(true);
  };

  const cancelPackFlow = () => {
    if (creatingPack) return;
    setShowPackConfirm(false);
    setShowPackCreate(false);
  };

  const handleCreatePack = async () => {
    if (!canCreatePack || !userId) return;
    const gameId = gameIdMap[packGame!];
    if (!gameId) return;

    setCreatingPack(true);
    setPackCreateError(null);

    const { data, error } = await supabase
      .from('packs')
      .insert({
        name:          packNameTrimmed,
        description:   packDescTrimmed,
        game_id:       gameId,
        owner_user_id: userId,
        // is_public stays false on creation; the author publishes from the
        // editor / manage view when they're ready to share.
      })
      .select('id')
      .single();

    if (error || !data) {
      setCreatingPack(false);
      setPackCreateError('Something went wrong. Please try again.');
      return;
    }

    // Navigate to the placeholder pack editor route. The page will be
    // replaced once the editor UI is built.
    navigate(`/app/packs/${data.id}/edit`);
  };

  // ── Delete deck ───────────────────────────────────────────────────────────

  const confirmDelete = (deckId: string) => setConfirmDeleteId(deckId);

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    // Optimistic: remove from UI immediately
    setDecks(prev => prev.filter(d => d.id !== confirmDeleteId));
    await supabase.from('decks').delete().eq('id', confirmDeleteId);
    setDeleting(false);
    setConfirmDeleteId(null);
  };

  // ── Duplicate deck ────────────────────────────────────────────────────────
  //
  // Deep-clones the deck (cards + their addons/keywords/images, deck rules and
  // deck-scoped tokens) via duplicateDeck, then refreshes the list so the copy
  // appears. duplicatingId guards against concurrent clicks; failures surface
  // inline above the list.

  const handleDuplicate = async (deckId: string) => {
    if (duplicatingId) return; // ignore concurrent clicks
    setDuplicatingId(deckId);
    setDuplicateError(null);
    try {
      await duplicateDeck(deckId);
      await reloadDecks();
    } catch {
      const source = decks.find(d => d.id === deckId);
      setDuplicateError(`Couldn't duplicate "${source?.name ?? 'deck'}". Please try again.`);
    } finally {
      setDuplicatingId(null);
    }
  };

  // ── Open modal (reset form state each time) ────────────────────────────────

  const openModal = () => {
    setDeckName('');
    setSelectedGame(null);
    setCreateError(null);
    setShowModal(true);
  };

  // ── Create deck ────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!canCreate || !userId) return;
    const gameId = gameIdMap[selectedGame!];
    if (!gameId) return;

    setCreating(true);
    setCreateError(null);

    const { data, error } = await supabase
      .from('decks')
      .insert({ name: trimmed, game_id: gameId, user_id: userId })
      .select('*, game:games(id, name, slug, stat_schema, created_at)')
      .single();

    if (error) {
      setCreating(false);
      setCreateError('Something went wrong. Please try again.');
      return;
    }

    // Auto-import any official packs for this game that the user doesn't have yet.
    const { data: officialPacks } = await supabase
      .from('packs')
      .select('id')
      .eq('game_id', gameId)
      .eq('is_official', true);

    if (officialPacks && officialPacks.length > 0) {
      const { data: existingImports } = await supabase
        .from('pack_imports')
        .select('pack_id')
        .in('pack_id', officialPacks.map((p: { id: string }) => p.id));

      const importedIds = new Set((existingImports ?? []).map((r: { pack_id: string }) => r.pack_id));

      await Promise.all(
        officialPacks
          .filter((p: { id: string }) => !importedIds.has(p.id))
          .map((p: { id: string }) => supabase.rpc('import_pack', { p_pack_id: p.id }))
      );
    }

    navigate(`/app/builder/${selectedGame}?deckId=${(data as DeckWithGame).id}`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">

      {/* Navbar — in-flow (not fixed) so content sits naturally below it */}
      <Navbar fixed={false} />

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 md:pt-9 md:px-9 pt-3 px-3">

        {/* ── Main content ─────────────────────────────────────────────────
            On desktop/tablet: fills remaining height, centres panels both
            horizontally and vertically.
            On mobile: allows horizontal scroll so both panels are reachable.
        ─────────────────────────────────────────────────────────────────── */}
        <div className="flex flex-1 items-stretch md:justify-center">

          {/* ── Panel row ─────────────────────────────────────────────────
              Mobile: overflows horizontally (horizontal-scroll UX)
              Desktop: centred flex row with gap
          ────────────────────────────────────────────────────────────── */}
          <div className="flex gap-2.5 items-stretch overflow-x-auto md:overflow-x-visible w-full md:w-auto md:flex-1 md:justify-center">

            {/* ── Left panel: Packs ───────────────────────────────────── */}
            <div
              className={[
                'shrink-0 min-w-[300px]',
                'md:flex-1 md:max-w-[384px] md:min-w-0',
                'self-stretch flex flex-col',
                'bg-gray-900 border border-gray-700 rounded-lg shadow-sm overflow-hidden',
              ].join(' ')}
            >
              <div className="flex flex-col gap-4 items-center p-5 h-full">

                <Box className="size-12 text-blue-400" />

                <h2 className="font-heading text-[20px] leading-7 text-white text-center whitespace-nowrap">
                  Packs
                </h2>

                {packsLoading ? (

                  // ── Loading ──────────────────────────────────────────
                  <div className="flex items-center justify-center py-4 w-full">
                    <svg
                      className="animate-spin size-6 text-blue-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-label="Loading"
                    >
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>

                ) : packsError ? (

                  // ── Error ─────────────────────────────────────────────
                  <>
                    <p className="font-body text-sm text-red-400 text-center">{packsError}</p>
                    <Button variant="outline" color="secondary" onClick={() => loadPacks(userId)}>
                      Retry
                    </Button>
                  </>

                ) : (

                  // ── Populated or Empty ────────────────────────────────
                  // Two stacked sections: Your Packs (owned + imported,
                  // click to open editor) and More Packs (public browse,
                  // download button). Section headers only show when
                  // both sections have content, so a fresh user just
                  // sees one list. Empty state covers "nothing anywhere".
                  <>
                    <p className="font-body text-base text-gray-300 text-center">
                      Sets of rules or homebrew cards that you can use in your own decks.
                    </p>

                    {/* Surface the most recent import failure inline; the
                        pack itself is re-added to the list below. */}
                    {importError && (
                      <p className="font-body text-sm text-red-400 text-center">{importError}</p>
                    )}

                    {yourPacks.length === 0 && packs.length === 0 ? (

                      // Empty — neither own/imported nor anything to browse.
                      <p className="font-body text-base text-gray-400 text-center flex-1">
                        No packs available yet.
                        <br />
                        Check back soon, or create your own to share.
                      </p>

                    ) : (

                      <div className="flex flex-col gap-4 w-full flex-1">

                        {/* Your Packs section — own + imported. Rows
                            navigate to the editor instead of showing
                            a download button. */}
                        {yourPacks.length > 0 && (
                          <div className="flex flex-col gap-2 w-full">
                            {packs.length > 0 && (
                              <p className="font-body font-bold text-xs text-gray-400 uppercase tracking-[1.2px] px-1">
                                Your Packs
                              </p>
                            )}
                            {yourPacks.filter(pack => pack.game != null).map(pack => {
                              const assets = gameAssets(pack.game.slug);
                              return (
                                <PackListItem
                                  key={pack.id}
                                  name={pack.name}
                                  gameName={pack.game.name}
                                  thumbnailBg={assets?.thumbnailBg ?? 'bg-gray-800'}
                                  thumbnail={
                                    assets?.thumbnailSrc
                                      ? <img src={assets.thumbnailSrc} alt="" className="size-full object-cover" />
                                      : undefined
                                  }
                                  badges={pack.badges}
                                  description={pack.description ?? undefined}
                                  official={pack.is_official}
                                  onDelete={() => requestDeletePack(pack)}
                                  deleteLabel={pack.source === 'imported' ? 'Uninstall Pack' : 'Delete Pack'}
                                  cta={pack.source === 'own'
                                    ? {
                                        label:   'Edit Pack',
                                        icon:    <Pen2 className="size-4" />,
                                        onClick: () => navigate(`/app/packs/${pack.id}/edit`),
                                      }
                                    : undefined}
                                />
                              );
                            })}
                          </div>
                        )}

                        {/* More Packs section — public browse list with
                            the download CTA. */}
                        {packs.length > 0 && (
                          <div className="flex flex-col gap-2 w-full">
                            {yourPacks.length > 0 && (
                              <p className="font-body font-bold text-xs text-gray-400 uppercase tracking-[1.2px] px-1">
                                More Packs
                              </p>
                            )}
                            {packs.filter(pack => pack.game != null).map(pack => {
                              const assets = gameAssets(pack.game.slug);
                              return (
                                <PackListItem
                                  key={pack.id}
                                  name={pack.name}
                                  gameName={pack.game.name}
                                  thumbnailBg={assets?.thumbnailBg ?? 'bg-gray-800'}
                                  thumbnail={
                                    assets?.thumbnailSrc
                                      ? <img src={assets.thumbnailSrc} alt="" className="size-full object-cover" />
                                      : undefined
                                  }
                                  badges={pack.badges}
                                  description={pack.description ?? undefined}
                                  official={pack.is_official}
                                  cta={{
                                    label:   'Download Pack',
                                    icon:    <AddCircle className="size-4" />,
                                    onClick: () => handleImport(pack),
                                  }}
                                />
                              );
                            })}
                          </div>
                        )}

                      </div>

                    )}

                    {isAdmin && (
                      <Button
                        className="w-full"
                        variant="outline"
                        color="primary"
                        leftIcon={<AddCircle className="size-4" />}
                        onClick={openPackConfirm}
                      >
                        Create Pack
                      </Button>
                    )}

                  </>

                )}

              </div>
            </div>

            {/* ── Middle panel: Your Decks ────────────────────────────── */}
            <div
              className={[
                'shrink-0 min-w-[300px]',
                'md:flex-1 md:max-w-[384px] md:min-w-0',
                'self-stretch flex flex-col',
                'bg-gray-900 border border-gray-700 rounded-lg shadow-sm overflow-hidden',
              ].join(' ')}
            >
              <div className="flex flex-col gap-4 items-center p-5 h-full">

                {loading ? (

                  // ── Loading ──────────────────────────────────────────
                  <>
                    <Widget2 className="size-12 text-blue-400" />
                    <h2 className="font-heading text-[20px] leading-7 text-white text-center whitespace-nowrap">
                      Your Decks
                    </h2>
                    <div className="flex items-center justify-center py-4 w-full">
                      <svg
                        className="animate-spin size-6 text-blue-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-label="Loading"
                      >
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  </>

                ) : fetchError ? (

                  // ── Error ─────────────────────────────────────────────
                  <>
                    <Widget2 className="size-12 text-blue-400" />
                    <h2 className="font-heading text-[20px] leading-7 text-white text-center whitespace-nowrap">
                      Your Decks
                    </h2>
                    <p className="font-body text-sm text-red-400 text-center">{fetchError}</p>
                    <Button variant="outline" color="secondary" onClick={loadData}>
                      Retry
                    </Button>
                  </>

                ) : decks.length === 0 ? (

                  // ── Empty state (Figma node 293:3712) ─────────────────
                  <>
                    <Layers className="size-12 text-blue-400" />
                    <h2 className="font-heading text-[20px] leading-7 text-white text-center whitespace-nowrap">
                      Your Decks
                    </h2>
                    <p className="font-body text-base text-gray-300 text-center">
                      Your cards live inside decks — usually, you'd create a deck for a
                      certain list or roster you're planning to play with (for example, a
                      Blood Bowl team).
                    </p>
                    <p className="font-body text-base text-gray-300 text-center">
                      When you're ready, use the button below to create your very first deck.
                    </p>
                    <Button
                      className="w-full"
                      leftIcon={<AddCircle className="size-4" />}
                      onClick={openModal}
                    >
                      Create New Deck
                    </Button>
                  </>

                ) : (

                  // ── Populated ─────────────────────────────────────────
                  <>
                    <Widget2 className="size-12 text-blue-400" />
                    <h2 className="font-heading text-[20px] leading-7 text-white text-center whitespace-nowrap">
                      Your Decks
                    </h2>
                    <p className="font-body text-base text-gray-300 text-center">
                      Manage your decks and cards.
                    </p>

                    {/* Surface the most recent duplicate failure inline. */}
                    {duplicateError && (
                      <p className="font-body text-sm text-red-400 text-center">{duplicateError}</p>
                    )}

                    <div className="flex flex-col gap-3 w-full">
                      {decks.map(deck => {
                        const assets = gameAssets(deck.game.slug);
                        return (
                          <div key={deck.id} className="flex flex-col gap-1">
                            <DeckListItem
                              name={deck.name}
                              cardCount={deck.cards[0]?.count ?? 0}
                              thumbnailBg={assets?.thumbnailBg ?? 'bg-gray-800'}
                              thumbnail={
                                assets?.thumbnailSrc
                                  ? <img src={assets.thumbnailSrc} alt="" className="size-full object-cover" />
                                  : undefined
                              }
                              onClick={() => navigate(`/app/builder/${deck.game.slug}?deckId=${deck.id}`)}
                              onDuplicate={() => handleDuplicate(deck.id)}
                              onDelete={() => confirmDelete(deck.id)}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <Button
                      className="w-full"
                      leftIcon={<AddCircle className="size-4" />}
                      onClick={openModal}
                    >
                      Create New Deck
                    </Button>
                  </>

                )}

              </div>
            </div>

            {/* ── Right panel: News & Updates ─────────────────────────── */}
            <div
              className={[
                'shrink-0 min-w-[300px]',
                'md:flex-1 md:max-w-[384px] md:min-w-0',
                'self-stretch flex flex-col',
                'bg-gray-900 border border-gray-700 rounded-lg shadow-sm overflow-hidden',
              ].join(' ')}
            >
              <div className="flex flex-col gap-4 items-center p-5 w-full">

                <InfoCircle className="size-12 text-blue-400" />

                <h2 className="font-heading text-[20px] leading-7 text-white text-center whitespace-nowrap">
                  News &amp; Updates
                </h2>

                <p className="font-body text-base text-gray-300 text-center">
                  Find out what's happening with Battlecards.
                </p>

                <BlogEntryPreview
                  title={PLACEHOLDER_POST.title}
                  body={PLACEHOLDER_POST.body}
                  onRead={() => {}}
                />

              </div>
            </div>

          </div>
        </div>

        {/* ── Version footer ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-3 py-1.5 font-body font-bold text-xs text-gray-800 tracking-[1.2px] uppercase whitespace-nowrap">
          <span>Battlecards version {__APP_VERSION__}</span>
          <span>–</span>
          <span>Build date {__APP_BUILD_DATE__}</span>
        </div>

      </div>

      {/* ── Duplicating progress modal ───────────────────────────────────── */}
      {/* Non-dismissible: stays up for the whole clone (which can be slow for
          large decks with images) and closes itself when duplicatingId clears. */}
      <Modal
        open={duplicatingId !== null}
        onClose={() => {}}
        className="max-w-xs"
      >
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <svg
            className="animate-spin size-8 text-blue-400"
            viewBox="0 0 24 24"
            fill="none"
            aria-label="Loading"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <h2 className="font-heading text-xl text-white">Duplicating Deck</h2>
          <p className="font-body text-sm text-gray-300">
            Copying your cards — this may take a moment for large decks.
          </p>
        </div>
      </Modal>

      {/* ── Delete confirmation modal ────────────────────────────────────── */}
      <Modal
        open={confirmDeleteId !== null}
        onClose={() => !deleting && setConfirmDeleteId(null)}
        className="max-w-xs"
      >
        <div className="flex flex-col gap-3 p-5">

          <TrashBinMinimalistic className="size-8 text-blue-400" />

          <h2 className="font-heading text-xl text-white">Delete this deck?</h2>

          <p className="font-body text-base text-gray-300">
            This will delete any cards in this deck, and cannot be undone.
          </p>

          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="ghost"
              color="danger"
              disabled={deleting}
              onClick={() => setConfirmDeleteId(null)}
            >
              Cancel
            </Button>
            <Button
              loading={deleting}
              rightIcon={<AltArrowRight className="size-4" />}
              onClick={handleDelete}
            >
              Continue
            </Button>
          </div>

        </div>
      </Modal>

      {/* ── Create New Deck modal ────────────────────────────────────────── */}
      <Modal open={showModal} onClose={() => !creating && setShowModal(false)}>
        <div className="flex flex-col gap-3 p-5">

          <h2 className="font-heading text-xl text-white">Create New Deck</h2>

          <Input
            label="Deck Name"
            required
            placeholder="Enter your deck name"
            value={deckName}
            onChange={e => setDeckName(e.target.value)}
            maxLength={99}
            autoFocus
            disabled={creating}
          />

          <HR />

          <p className="font-body text-sm text-gray-300">
            Choose which game this deck will belong to.
          </p>

          <div className="flex flex-col gap-1.5">
            {GAMES.map(game => (
              <GamePickerItem
                key={game.id}
                logoSrc={game.logoSrc}
                logoAlt={game.name}
                selected={selectedGame === game.id}
                onClick={() => !creating && setSelectedGame(game.id)}
              />
            ))}
          </div>

          {/* Inline error */}
          {createError && (
            <p className="font-body text-sm text-red-400">{createError}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              color="danger"
              disabled={creating}
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!canCreate}
              loading={creating}
              rightIcon={<AltArrowRight className="size-4" />}
              onClick={handleCreate}
            >
              Create New Deck
            </Button>
          </div>

        </div>
      </Modal>

      {/* ── Import List modal ────────────────────────────────────────────── */}
      <ImportListModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={(deckId, gameSlug) => {
          setShowImport(false);
          navigate(`/app/builder/${gameSlug}?deckId=${deckId}`);
        }}
      />

      {/* ── Delete / uninstall pack confirmation ────────────────────────── */}
      {/* One shared modal for both Delete (own) and Uninstall (imported).
          Copy + button labels switch based on packToDelete.source so the
          user knows what's about to happen. */}
      <Modal
        open={packToDelete !== null}
        onClose={cancelDeletePack}
        className="max-w-xs"
      >
        {packToDelete && (
          <div className="flex flex-col gap-3 p-5">

            <TrashBinMinimalistic className="size-8 text-blue-400" />

            <h2 className="font-heading text-xl text-white">
              {packToDelete.source === 'imported'
                ? 'Uninstall this pack?'
                : 'Delete this pack?'}
            </h2>

            <p className="font-body text-base text-gray-300">
              {packToDelete.source === 'imported' ? (
                <>
                  This removes
                  {' '}<span className="font-bold text-white">{packToDelete.name}</span>{' '}
                  from your library. It stays available to download again
                  later. Cards you've already added to decks aren't affected.
                </>
              ) : (
                <>
                  This permanently deletes
                  {' '}<span className="font-bold text-white">{packToDelete.name}</span>{' '}
                  and all of its cards, addons, and keywords. This cannot
                  be undone.
                </>
              )}
            </p>

            {deletePackError && (
              <p className="font-body text-sm text-red-400">{deletePackError}</p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="ghost"
                color="danger"
                disabled={deletingPack}
                onClick={cancelDeletePack}
              >
                Cancel
              </Button>
              <Button
                color="danger"
                loading={deletingPack}
                rightIcon={<AltArrowRight className="size-4" />}
                onClick={handleConfirmDeletePack}
              >
                Continue
              </Button>
            </div>

          </div>
        )}
      </Modal>

      {/* ── Create Pack — step 1: confirmation ───────────────────────────── */}
      {/* Reassures the user they don't need a pack just to make a deck.
          Modeled on the Delete-deck confirmation modal above. */}
      <Modal
        open={showPackConfirm}
        onClose={() => setShowPackConfirm(false)}
        className="max-w-xs"
      >
        <div className="flex flex-col gap-3 p-5">

          <Box className="size-8 text-blue-400" />

          <h2 className="font-heading text-xl text-white">
            Are you sure you want to create a pack?
          </h2>

          <p className="font-body text-base text-gray-300">
            Packs are sets of rules that can be used by you and other players.
          </p>

          <p className="font-body text-base text-gray-300">
            <strong className="font-bold text-white">
              If you're just trying to create a new deck, you don't need to
              create a pack
            </strong>
            {' '}— you can create rules directly when you create your decks.
          </p>

          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="ghost"
              color="danger"
              onClick={() => setShowPackConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              rightIcon={<AltArrowRight className="size-4" />}
              onClick={advanceToPackForm}
            >
              Continue
            </Button>
          </div>

        </div>
      </Modal>

      {/* ── Create Pack — step 2: form ───────────────────────────────────── */}
      {/* Mirrors the Create New Deck modal pattern (Input + game picker +
          buttons), with an added required Pack Description textarea. The
          textarea uses the same inline styling as the description field in
          AddKeywordModal so it reads consistently across the app. */}
      <Modal open={showPackCreate} onClose={cancelPackFlow}>
        <div className="flex flex-col gap-3 p-5">

          <h2 className="font-heading text-xl text-white">Create New Pack</h2>

          <Input
            label="Pack Name"
            required
            placeholder="Enter your pack name"
            value={packName}
            onChange={e => setPackName(e.target.value)}
            maxLength={99}
            autoFocus
            disabled={creatingPack}
          />

          {/* Plain textarea matching the AddKeywordModal description field
              styling — no Textarea component exists yet, and the keyword
              modal sets the convention. */}
          <div className="flex flex-col gap-1">
            <div className="flex gap-0.5 items-center font-body text-sm font-medium text-gray-900 dark:text-white">
              <span>Pack Description</span><span className="text-red-600">*</span>
            </div>
            <textarea
              rows={4}
              placeholder="What's contained in the pack"
              value={packDescription}
              maxLength={500}
              onChange={e => setPackDescription(e.target.value)}
              disabled={creatingPack}
              className="w-full px-3 py-2.5 rounded-lg bg-gray-700 border border-gray-600 font-body text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none overflow-y-auto disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <HR />

          <p className="font-body text-sm text-gray-300">
            Choose which game this pack will belong to.
          </p>

          <div className="flex flex-col gap-1.5">
            {GAMES.map(game => (
              <GamePickerItem
                key={game.id}
                logoSrc={game.logoSrc}
                logoAlt={game.name}
                selected={packGame === game.id}
                onClick={() => !creatingPack && setPackGame(game.id)}
              />
            ))}
          </div>

          {packCreateError && (
            <p className="font-body text-sm text-red-400">{packCreateError}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              color="danger"
              disabled={creatingPack}
              onClick={cancelPackFlow}
            >
              Cancel
            </Button>
            <Button
              disabled={!canCreatePack}
              loading={creatingPack}
              rightIcon={<AddCircle className="size-4" />}
              onClick={handleCreatePack}
            >
              Create New Pack
            </Button>
          </div>

        </div>
      </Modal>

    </div>
  );
}
