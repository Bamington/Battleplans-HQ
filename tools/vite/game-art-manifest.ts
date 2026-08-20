/**
 * game-art-manifest.ts — writes the game artwork map somewhere a SERVER can read it.
 *
 * ── The problem ──────────────────────────────────────────────────────────
 *
 * A social preview has to name an image in a <meta> tag, and that tag has to be
 * in the HTML before any JavaScript runs, because no crawler runs any. So the
 * function that renders the preview has to be able to answer "what is the
 * artwork for the game `shatterpoint`?" from the server.
 *
 * It cannot. The artwork lives in packages/ui/src/assets/games/, is pulled in by
 * an `import.meta.glob` in gameArt.ts, and is emitted by the build under content
 * hashes — `Shatterpoint Logo-C7xK2f.png`. The hash is not knowable until the
 * build has run, and it changes whenever the file does. The database is no help
 * either: all 116 rows in `games` have a null `icon` and a null `image`, which
 * is precisely why the shared artwork maps exist.
 *
 * ── The approach ─────────────────────────────────────────────────────────
 *
 * After the bundle is generated, Rollup knows both halves — the original path of
 * every asset and the hashed name it was written under. This walks that, keys it
 * by game slug through the SAME classifier the browser map uses, and emits
 * `game-art.json` alongside the app:
 *
 *   { "banners": { "shatterpoint": "/assets/Shatterpoint Logo-C7xK2f.png" },
 *     "icons":   { "shatterpoint": "/assets/Shatterpoint Icon-D9a1b2.png"  } }
 *
 * Deliberately NOT a second copy of the images into `public/`. That would double
 * their weight in the deployment and give the server a set of files that could
 * drift from the set the browser is using; this describes the ones already
 * there.
 *
 * The classifier is imported rather than reimplemented — see gameArtSlug.ts.
 * A manifest keyed differently from the map it describes would be worse than no
 * manifest, because it would be wrong only for some games.
 */

import type { Plugin } from 'vite';
import { classifyArtPath } from '../../packages/ui/src/lib/gameArtSlug';

export interface GameArtManifest {
  banners: Record<string, string>;
  icons: Record<string, string>;
}

/** Where the manifest is written, relative to the site root. */
export const GAME_ART_MANIFEST = 'game-art.json';

export function gameArtManifest(): Plugin {
  return {
    name: 'game-art-manifest',
    // The client build only. `apply: 'build'` keeps it out of dev, where there
    // is no bundle to walk and the dev server serves the source paths anyway.
    apply: 'build',

    /**
     * Game artwork is never inlined, however small it is.
     *
     * Vite turns any asset under `assetsInlineLimit` (4KB by default) into a
     * base64 data URI, which means it never becomes a file and never appears in
     * the bundle for this plugin to find. Eight of the smaller logos and icons
     * vanished from the manifest that way — and a data URI would be no use even
     * if it were listed, since a social preview has to give a crawler a URL it
     * can fetch.
     *
     * Returning `undefined` for everything else leaves Vite's own rule in place
     * for the rest of the app.
     */
    config() {
      return {
        build: {
          assetsInlineLimit: (filePath: string) =>
            filePath.replace(/\\/g, '/').includes('assets/games/') ? false : undefined,
        },
      };
    },

    generateBundle(_options, bundle) {
      const banners: Record<string, string> = {};
      const icons: Record<string, string> = {};
      // Same tie-break as gameArt.ts: a file following the export convention
      // beats a legacy hand-added one, whatever order they are walked in.
      const rank: Record<string, boolean> = {};

      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type !== 'asset') continue;

        // Rollup 4 reports every source that produced the asset; older shapes
        // carry a single name. Both are checked so a version bump cannot
        // silently empty the manifest.
        const sources = [
          ...((output as { originalFileNames?: string[] }).originalFileNames ?? []),
          (output as { originalFileName?: string | null }).originalFileName ?? '',
        ].filter(Boolean);

        // EVERY matching source, not the first. Rollup deduplicates assets by
        // content, so two games whose artwork is byte-identical share one output
        // file with both names on it — "Warcrow Icon.png" and "Warcrow
        // Adventures Icon.png" are the same 41KB image, and taking only the
        // first silently dropped one of the two games from the manifest.
        for (const raw of sources) {
          const source = raw.replace(/\\/g, '/');
          if (!source.includes('assets/games/')) continue;

          const { slug, isIcon, exported } = classifyArtPath(source);
          const target = isIcon ? icons : banners;
          const key = `${isIcon ? 'i' : 'b'}:${slug}`;

          if (target[slug] && rank[key] && !exported) continue;
          target[slug] = `/${fileName}`;
          rank[key] = exported;
        }
      }

      const total = Object.keys(banners).length + Object.keys(icons).length;
      if (total === 0) {
        // Loud, because the failure is silent otherwise: every social preview
        // would simply lose its fallback image and nothing would say why.
        this.warn(
          'game-art-manifest: no game artwork found in the bundle. ' +
          'The social preview will have no fallback image.',
        );
      }

      this.emitFile({
        type: 'asset',
        fileName: GAME_ART_MANIFEST,
        source: JSON.stringify({ banners, icons } satisfies GameArtManifest),
      });
    },
  };
}
