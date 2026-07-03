/**
 * tokenIcons.ts — Game-agnostic token icon resolver
 *
 * `token_definitions.icon` and `token_definitions.icon_off` store asset paths
 * like:
 *
 *     src/assets/games/card assets/halo/tokens/Token Type=Damage, State=Default.svg
 *
 * Eagerly loaded once via `import.meta.glob` so any game's `tokens/*.svg`
 * resolves automatically — drop a new SVG into a game's tokens folder and
 * it's immediately available without code edits.
 */

// Eagerly import every SVG under any game's tokens directory.
const ICONS = import.meta.glob(
  '../assets/games/card assets/*/tokens/*.svg',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>;

/**
 * Resolve a token's `icon` / `icon_off` DB value to a runtime asset URL.
 *
 * The DB stores paths rooted at `src/`. `import.meta.glob` keys are rooted
 * at the file calling it (so they start with `../assets/...`). We strip
 * leading `./` and `../` from glob keys and the leading `src/` from the DB
 * value, then match.
 */
export const resolveTokenIcon = (assetPath: string | null | undefined): string | undefined => {
  if (!assetPath) return undefined;
  const wanted = assetPath.replace(/^src\//, '');
  for (const [key, url] of Object.entries(ICONS)) {
    const norm = key.replace(/^[./]+/, '');
    if (norm === wanted) return url;
  }
  return undefined;
};
