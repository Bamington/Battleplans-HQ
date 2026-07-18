/**
 * currentApp.ts — which Battleplans app this bundle is
 *
 * Each app ships as its own Vercel project, so "which app am I?" is a constant
 * per deployment, not something that varies at runtime. Registering it once in
 * main.tsx saves threading a slug through every Navbar and admin page.
 *
 * The slug must match a row in public.platform_apps.
 *
 * USAGE (in main.tsx, before render):
 *   setCurrentApp('battleplan');
 */

export type AppSlug = 'battleplan' | 'battlecards' | 'battlebox' | 'battlepack';

let currentApp: AppSlug | null = null;

/** Register which app this bundle is. Call once, at startup. */
export function setCurrentApp(slug: AppSlug): void {
  currentApp = slug;
}

/** The registered app slug, or null if setCurrentApp was never called. */
export function getCurrentApp(): AppSlug | null {
  return currentApp;
}
