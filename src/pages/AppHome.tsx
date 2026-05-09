/**
 * AppHome.tsx — Main app dashboard (logged-in home screen)
 *
 * Two-panel layout:
 *   Left  — "Your Decks"     — user's decks fetched from Supabase + create button
 *   Right — "News & Updates" — latest blog / release-note preview
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
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Button from '../components/Button';
import DeckListItem from '../components/DeckListItem';
import BlogEntryPreview from '../components/BlogEntryPreview';
import Modal from '../components/Modal';
import GamePickerItem from '../components/GamePickerItem';
import Input from '../components/Input';
import HR from '../components/HR';
import ImportListModal from '../components/ImportListModal';
import AddCircle from '../icons/AddCircle';
import Widget2 from '../icons/Widget2';
import Layers from '../icons/Layers';
import InfoCircle from '../icons/InfoCircle';
import AltArrowRight from '../icons/AltArrowRight';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';
import { supabase } from '../lib/supabase';
import type { DeckWithGame } from '../lib/database.types';

/** Deck with nested game + aggregated card count from Supabase. */
type DeckWithCards = DeckWithGame & { cards: [{ count: number }] };

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

  // ── Deck list state ────────────────────────────────────────────────────────
  const [decks,      setDecks]      = useState<DeckWithCards[]>([]);
  const [gameIdMap,  setGameIdMap]  = useState<Record<string, string>>({});
  const [userId,     setUserId]     = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Delete confirmation state ──────────────────────────────────────────────
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting,        setDeleting]        = useState(false);

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
      setUserId(user?.id ?? null);

      // Fetch all games to build a slug → UUID map for the create flow
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select('id, slug');
      if (gamesError) throw gamesError;

      const idMap: Record<string, string> = {};
      gamesData?.forEach(g => { idMap[g.slug] = g.id; });
      setGameIdMap(idMap);

      // Fetch the user's decks, joined with their game row + card count
      const { data: decksData, error: decksError } = await supabase
        .from('decks')
        .select('*, game:games(id, name, slug, stat_schema, created_at), cards(count)')
        .order('created_at', { ascending: false });
      if (decksError) throw decksError;

      setDecks((decksData ?? []) as DeckWithCards[]);
    } catch {
      setFetchError('Failed to load your decks. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }

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

            {/* ── Left panel: Your Decks ──────────────────────────────── */}
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
                    <div className="flex flex-col gap-3 w-full">
                      {decks.map(deck => {
                        const assets = gameAssets(deck.game.slug);
                        return (
                          <DeckListItem
                            key={deck.id}
                            name={deck.name}
                            cardCount={deck.cards[0]?.count ?? 0}
                            thumbnailBg={assets?.thumbnailBg ?? 'bg-gray-800'}
                            thumbnail={
                              assets?.thumbnailSrc
                                ? <img src={assets.thumbnailSrc} alt="" className="size-full object-cover" />
                                : undefined
                            }
                            onClick={() => navigate(`/app/builder/${deck.game.slug}?deckId=${deck.id}`)}
                            onDelete={() => confirmDelete(deck.id)}
                          />
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
          <span>Battlecards version 0.10</span>
          <span>–</span>
          <span>Build date 31/03/2026</span>
        </div>

      </div>

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

    </div>
  );
}
