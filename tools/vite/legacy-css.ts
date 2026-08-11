/**
 * legacy-css.ts — a second stylesheet for browsers without cascade layers
 *
 * ── The problem ──────────────────────────────────────────────────────────
 *
 * Tailwind v4 emits its entire output inside cascade layers:
 *
 *   @layer properties{…} @layer theme{…} @layer base{…} @layer utilities{…}
 *
 * A browser that doesn't understand `@layer` drops the whole at-rule, so it
 * doesn't lose *some* styling — it loses all of it. Measured on this project:
 * 73% of the built stylesheet lives inside those blocks. The remaining 27% is
 * the marketing pages' own `--mk-*` CSS, which sits outside them, which is
 * exactly why battleplan.app/venue rendered unstyled-but-present on iOS 15
 * while the app itself was a blank white page.
 *
 * Cascade layers are the *only* thing that breaks. Tailwind already ships
 * `@supports` fallbacks for the other two modern features it depends on:
 *
 *   .bg-black\/40{background-color:#0006}                       ← plain fallback
 *   @supports (color:color-mix(in lab, red, red)){…}            ← modern path
 *
 * and a similar shim for `@property`. `oklch()` has worked since Safari 15.4.
 * So flattening the layers is the whole fix.
 *
 * ── The approach ─────────────────────────────────────────────────────────
 *
 * Deliberately NOT a transform of the stylesheet everyone gets. Flattening
 * changes how the cascade resolves, and while it looks safe here — the
 * unlayered `--mk-*` rules are emitted after the layers, so they still win
 * ties — "looks safe" is not something worth betting four apps on for the
 * 99% of visitors whose browsers were never broken.
 *
 * Instead: build a second, flattened copy alongside the original, and load it
 * only where it's needed. Modern browsers get a byte-for-byte unchanged
 * stylesheet and never fetch the fallback. This mirrors what the Tailwind
 * community settled on, since Tailwind Labs' own answer to older browsers is
 * still "use v3.4" and no compatibility mode has shipped.
 *
 * ── Scope ────────────────────────────────────────────────────────────────
 *
 * Fully fixes Safari 15.4–16.3 (and equivalent old Chrome/Firefox), which is
 * where cascade layers are the sole blocker. Safari 15.0–15.3 additionally
 * lacks `oklch()`, so Tailwind's stock palette (red-500 and friends) degrades
 * there — but this project overrides the colours it actually relies on with
 * plain hex (`--color-neutral-950:#030712`), so the apps stay legible. Fixing
 * 15.0–15.3 properly would mean adding Lightning CSS to downlevel the colour
 * functions; that's a native dependency for a sliver of a sliver, so it isn't
 * done here.
 */

import type { Plugin } from 'vite';

/** Suffix appended to a stylesheet's name to make its flattened twin. */
const LEGACY_SUFFIX = '.legacy.css';

/**
 * Remove cascade layers from a stylesheet, keeping every rule in source order.
 *
 * Flattening is sound for Tailwind's output specifically because Tailwind
 * already emits its layers in precedence order (properties, theme, base,
 * components, utilities). Once the wrappers are gone, later rules win ties,
 * which lands in the same place for everything except a higher-specificity
 * rule in an earlier layer — a case Tailwind's own output doesn't create.
 *
 * Written as a character scanner rather than a regex because `@layer` can
 * legitimately appear inside a string (`content: "@layer"`) or a comment, and
 * a regex that ate one of those would corrupt the file silently.
 */
export function flattenCascadeLayers(css: string): string {
  let out = '';
  let i = 0;

  while (i < css.length) {
    const c = css[i];

    // Pass strings through untouched, quotes and escapes included.
    if (c === '"' || c === "'") {
      const quote = c;
      out += c;
      i++;
      while (i < css.length) {
        if (css[i] === '\\') { out += css[i] + (css[i + 1] ?? ''); i += 2; continue; }
        out += css[i];
        if (css[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }

    // Comments likewise — the Tailwind banner is one, and it should survive.
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? css.length : end + 2;
      out += css.slice(i, stop);
      i = stop;
      continue;
    }

    if (c === '@' && css.startsWith('@layer', i)) {
      // Find whichever comes first: the block's `{` or the statement's `;`.
      let j = i + '@layer'.length;
      while (j < css.length && css[j] !== '{' && css[j] !== ';') j++;

      // `@layer a, b;` only declares an order. With no layers left it says
      // nothing, so it goes.
      if (css[j] === ';') { i = j + 1; continue; }

      if (css[j] === '{') {
        // Walk to the matching close brace, respecting nesting and strings.
        let depth = 1;
        let k = j + 1;
        const start = k;
        while (k < css.length && depth > 0) {
          const ch = css[k];
          if (ch === '"' || ch === "'") {
            const quote = ch;
            k++;
            while (k < css.length) {
              if (css[k] === '\\') { k += 2; continue; }
              if (css[k] === quote) { k++; break; }
              k++;
            }
            continue;
          }
          if (ch === '/' && css[k + 1] === '*') {
            const end = css.indexOf('*/', k + 2);
            k = end === -1 ? css.length : end + 2;
            continue;
          }
          if (ch === '{') depth++;
          else if (ch === '}') depth--;
          k++;
        }
        // Recurse: Tailwind nests `@layer utilities { @layer … }` in places.
        out += flattenCascadeLayers(css.slice(start, k - 1));
        i = k;
        continue;
      }
    }

    out += c;
    i++;
  }

  return out;
}

/**
 * Strip `layer(...)` off any surviving `@import`. Vite inlines imports during
 * the build so there usually aren't any, but an un-inlined one carrying a
 * layer would reintroduce the same failure.
 */
function stripImportLayers(css: string): string {
  return css.replace(/(@import[^;]*?)\s*layer\([^)]*\)/g, '$1');
}

/**
 * The loader. Runs inline in <head>, after Vite's own stylesheet links.
 *
 * `CSSLayerBlockRule` is the DOM interface that shipped with cascade layers,
 * so its absence is an exact test for the thing that breaks — better than
 * sniffing the user agent, which would need updating forever.
 *
 * The original stylesheet is left enabled rather than swapped out. It costs a
 * duplicate download on a device that is by definition old and slow, and buys
 * the guarantee that a failed fetch of the fallback can't leave the page with
 * no CSS at all.
 */
const LOADER = `(function(){
  if (typeof CSSLayerBlockRule !== "undefined") return;
  var links = document.querySelectorAll('link[rel="stylesheet"]');
  for (var i = 0; i < links.length; i++) {
    var href = links[i].getAttribute("href");
    if (!href || href.indexOf(".css") === -1) continue;
    var el = document.createElement("link");
    el.rel = "stylesheet";
    el.href = href.replace(/\\.css(\\?.*)?$/, "${LEGACY_SUFFIX}$1");
    links[i].parentNode.insertBefore(el, links[i].nextSibling);
  }
})();`;

export function legacyCss(): Plugin {
  return {
    name: 'battleplans:legacy-css',
    // Dev serves CSS through JS injection and is only ever opened on a
    // developer's own browser, so there's nothing to do there.
    apply: 'build',

    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return {
          html,
          tags: [{
            tag: 'script',
            children: LOADER,
            injectTo: 'head',
          }],
        };
      },
    },

    generateBundle(_options, bundle) {
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type !== 'asset' || !fileName.endsWith('.css')) continue;
        if (fileName.endsWith(LEGACY_SUFFIX)) continue;

        const source = typeof asset.source === 'string'
          ? asset.source
          : Buffer.from(asset.source).toString('utf8');

        const flattened = stripImportLayers(flattenCascadeLayers(source));

        // Nothing was layered, so there's nothing a legacy browser would miss.
        if (flattened === source) continue;

        this.emitFile({
          type: 'asset',
          fileName: fileName.replace(/\.css$/, LEGACY_SUFFIX),
          source: flattened,
        });
      }
    },
  };
}
