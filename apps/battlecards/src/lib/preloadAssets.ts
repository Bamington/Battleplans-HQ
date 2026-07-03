/**
 * preloadAssets.ts — Eagerly cache all static assets on app launch
 *
 * Called once from main.tsx as fire-and-forget. Images are preloaded
 * via Image objects; fonts are fetched to warm the browser cache so
 * they're ready when @font-face declarations need them.
 */

// Vite eager glob imports — resolved at build time to hashed URLs.
const imageModules = import.meta.glob<{ default: string }>(
  '../assets/**/*.{svg,png,jpg,jpeg}',
  { eager: true },
);

const fontModules = import.meta.glob<{ default: string }>(
  '../assets/**/*.{ttf,otf,woff,woff2}',
  { eager: true },
);

export function preloadAssets(): void {
  // Preload images — the browser fetches each URL in the background.
  for (const mod of Object.values(imageModules)) {
    const img = new Image();
    img.src = mod.default;
  }

  // Preload fonts — fetch warms the HTTP cache so @font-face hits cache.
  for (const mod of Object.values(fontModules)) {
    fetch(mod.default).catch(() => {
      // Silently ignore — non-critical preload.
    });
  }
}
