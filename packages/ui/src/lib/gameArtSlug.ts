/**
 * gameArtSlug.ts — how a game artwork FILENAME becomes a game slug.
 *
 * Split out of gameArt.ts so it can be used somewhere gameArt.ts cannot go.
 * That file's first statement is an `import.meta.glob`, which only Vite's
 * transform understands — so it can never be imported from plain Node, and the
 * build-time plugin that writes `game-art.json` (tools/vite/game-art-manifest)
 * runs in exactly that place.
 *
 * This file has no imports and no side effects on purpose: it is the one part
 * both the browser bundle and the build script need, and duplicating it is how
 * the manifest ends up keyed differently from the map it is meant to describe.
 */

/** Games whose slug can't be derived from their display name. */
export const SLUG_ALIASES: Record<string, string> = {
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
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface ArtClassification {
  slug: string;
  isIcon: boolean;
  /** Follows the drop-in export convention, rather than being a legacy file. */
  exported: boolean;
}

/** What game, and which of the two kinds, a file under assets/games/ is. */
export function classifyArtPath(path: string): ArtClassification {
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
