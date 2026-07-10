/**
 * gameIcons.ts — Game artwork, auto-discovered from the shared assets folder.
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

const assets = import.meta.glob<{ default: string }>(
  '../../../../packages/ui/src/assets/games/**/*.{png,svg,jpg,jpeg,webp}',
  { eager: true },
);

/** Games whose slug can't be derived from their display name. */
const SLUG_ALIASES: Record<string, string> = {
  'halo':                          'halo-flashpoint',
  'warhammer-40-000-kill-team':    'kill-team',
  'starcraft-the-miniatures-game': 'starcraft',
  'repent-ye-foolish-gods':        'ryg',
  // Files exported under the game's common abbreviation.
  'asoiaf':                        'song-of-ice-and-fire',
  'dnd':                           'dungeons-and-dragons',
};

const ICON_SUFFIX = /[\s_-]icon$/i;
const LOGO_SUFFIX = /[\s_-]logo$/i;
const LOGO_PREFIX = /^logo-/i;

/** Same rule used to generate the `games.slug` column. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function classify(path: string): { slug: string; isIcon: boolean; exported: boolean } {
  const base = path.split('/').pop()!.replace(/\.[^.]+$/, '');

  // The folder is authoritative — a file named "X Icon.png" that was dropped
  // into logos/ is still a banner. Only fall back to the name when neither
  // folder applies (a file sitting at the games/ root).
  const isIcon = path.includes('/icons/') ? true
               : path.includes('/logos/') ? false
               : ICON_SUFFIX.test(base);

  const name = base
    .replace(LOGO_PREFIX, '')
    .replace(ICON_SUFFIX, '')
    .replace(LOGO_SUFFIX, '');

  const slug = slugify(name);

  // Files following the drop-in convention ("<Game> Icon.png" / "<Game> Logo.png")
  // are the current exports; a bare "slug.png" is a legacy hand-added file.
  const exported = ICON_SUFFIX.test(base) || LOGO_SUFFIX.test(base);

  return { slug: SLUG_ALIASES[slug] ?? slug, isIcon, exported };
}

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
