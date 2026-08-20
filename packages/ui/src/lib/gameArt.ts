/**
 * gameArt.ts — Game artwork, auto-discovered from the shared assets folder.
 *
 * NOTE ON DUPLICATION: BattlePlan and BattleBench each carry a byte-identical
 * copy of this at src/components/gameIcons.ts. This shared copy was added when
 * BattlePack needed a third. Those two are left alone deliberately — they work,
 * and rewiring two shipped apps was not part of the change that created this —
 * but they should be pointed here and deleted.
 *
 * Drop two files per game into packages/ui/src/assets/games/ :
 *
 *   icons/<game> icon.png   → small thumbnail (game picker, booking cards)
 *   logos/<game>.png        → full-size banner / logo
 *
 * Both maps are keyed by the game's `slug` (as stored in the games table), so
 * adding a game is just dropping the files in — no code change needed.
 *
 * The slug is derived from the filename, which makes the naming forgiving:
 *   - a `logo-` prefix and an ` icon` / `-icon` / `_icon` suffix are stripped
 *   - anything in icons/ counts as an icon, anything else as a banner
 *   - the remainder is slugified exactly the way the database slugs were
 *     generated, so either the slug ("kill-team icon.png") or the display name
 *     ("Warhammer 40,000 Kill Team.png") resolves to the same key
 *   - SLUG_ALIASES covers the few games whose slug differs from their name
 *
 * See packages/ui/src/assets/games/README.md for the full slug list.
 */

import { classifyArtPath as classify } from './gameArtSlug';

const assets = import.meta.glob<{ default: string }>(
  '../assets/games/**/*.{png,svg,jpg,jpeg,webp}',
  { eager: true },
);

const icons:   Record<string, string> = {};
const banners: Record<string, string> = {};
// Tracks whether the winning file for a slug came from the export convention,
// so a legacy file can never clobber a newer export just by sorting later.
const iconIsExport:   Record<string, boolean> = {};
const bannerIsExport: Record<string, boolean> = {};

for (const [path, mod] of Object.entries(assets)) {
  const { slug, isIcon, exported } = classify(path);
  const target = isIcon ? icons : banners;
  const rank   = isIcon ? iconIsExport : bannerIsExport;

  const existing = target[slug];
  if (existing) {
    // A legacy file never beats an export. Same-rank collisions are a mistake.
    if (rank[slug] && !exported) continue;
    if (import.meta.env.DEV && rank[slug] === exported) {
      console.warn(
        `[gameIcons] duplicate ${isIcon ? 'icon' : 'banner'} for slug "${slug}": ` +
        `${path} overrides an earlier file. Remove one.`,
      );
    }
  }

  target[slug] = mod.default;
  rank[slug]   = exported;
}

/** Maps a game slug to its small thumbnail icon. */
export const GAME_ICONS: Record<string, string> = icons;

/** Maps a game slug to its full-size banner / logo. */
export const GAME_BANNERS: Record<string, string> = banners;
