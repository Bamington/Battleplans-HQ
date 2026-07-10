import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AdminRoute,
  AltArrowLeft,
  Button,
  Widget2,
  supabase,
} from '@battleplans/ui';
import AppNavbar from '../../components/AppNavbar';
import { GAME_ICONS } from '../../components/gameIcons';

type GameRow = {
  id: string;
  name: string;
  slug: string;
  enabled_battleplan: boolean;
};

const BattlePlanLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattlePlan</span>
);

function ManageGamesInner() {
  const navigate = useNavigate();
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGames();
  }, []);

  async function fetchGames() {
    setLoading(true);
    const { data, error } = await supabase
      .from('games')
      .select('id, name, slug, enabled_battleplan')
      .order('name');
    if (error) setError(error.message);
    else setGames((data ?? []) as GameRow[]);
    setLoading(false);
  }

  async function toggleGame(game: GameRow) {
    setToggling(game.id);
    const newValue = !game.enabled_battleplan;
    const { error } = await supabase
      .from('games')
      .update({ enabled_battleplan: newValue })
      .eq('id', game.id);
    if (!error) {
      setGames(prev =>
        prev.map(g => g.id === game.id ? { ...g, enabled_battleplan: newValue } : g)
      );
    }
    setToggling(null);
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">
      <AppNavbar fixed={false} logo={<BattlePlanLogo />} />

      <div className="flex-1 flex flex-col items-center p-8 pt-10">
        <div className="w-full max-w-2xl flex flex-col gap-6">

          <div className="flex items-center gap-3">
            <h1 className="font-heading text-xl text-white">Manage Games</h1>
            {!loading && (
              <span className="font-body text-sm text-neutral-500 ml-auto">
                {games.length} {games.length === 1 ? 'game' : 'games'}
              </span>
            )}
          </div>

          <div className="flex flex-col divide-y divide-neutral-800 border border-neutral-800 rounded-xl overflow-hidden">
            {loading && (
              <div className="px-5 py-8 text-center font-body text-sm text-neutral-500">Loading…</div>
            )}
            {!loading && error && (
              <div className="px-5 py-8 text-center font-body text-sm text-red-400">{error}</div>
            )}
            {!loading && !error && games.length === 0 && (
              <div className="px-5 py-8 text-center font-body text-sm text-neutral-500">No games found.</div>
            )}
            {!loading && !error && games.map(game => (
              <div key={game.id} className="flex items-center gap-4 px-5 py-3.5 bg-neutral-900">
                {/* Icon — falls back to a placeholder for games without artwork yet */}
                <span className="size-10 shrink-0 rounded overflow-hidden bg-neutral-700 flex items-center justify-center">
                  {GAME_ICONS[game.slug]
                    ? <img src={GAME_ICONS[game.slug]} alt="" className="w-full h-full object-cover" />
                    : <Widget2 className="w-4 h-4 text-neutral-400" />}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm text-white">{game.name}</p>
                  <p className="font-body text-xs text-neutral-500">{game.slug}</p>
                </div>

                <button
                  type="button"
                  disabled={toggling === game.id}
                  onClick={() => toggleGame(game)}
                  className={[
                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
                    'transition-colors duration-200 focus:outline-none',
                    toggling === game.id ? 'opacity-50 cursor-not-allowed' : '',
                    game.enabled_battleplan ? 'bg-primary-600' : 'bg-neutral-700',
                  ].join(' ')}
                  role="switch"
                  aria-checked={game.enabled_battleplan}
                  aria-label={`${game.enabled_battleplan ? 'Disable' : 'Enable'} ${game.name}`}
                >
                  <span
                    className={[
                      'pointer-events-none inline-block size-4 rounded-full bg-white shadow',
                      'transform transition-transform duration-200',
                      game.enabled_battleplan ? 'translate-x-4' : 'translate-x-0',
                    ].join(' ')}
                  />
                </button>

                <span className={`font-body text-xs w-14 text-right ${game.enabled_battleplan ? 'text-primary-400' : 'text-neutral-500'}`}>
                  {game.enabled_battleplan ? 'Enabled' : 'Disabled'}
                </span>
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
    </div>
  );
}

export default function ManageGames() {
  return (
    <AdminRoute>
      <ManageGamesInner />
    </AdminRoute>
  );
}
