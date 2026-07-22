/**
 * currentApp.ts — which Battleplans app the user is currently in
 *
 * On the web each app ships as its own Vercel project, so this is a constant
 * per deployment: main.tsx registers it once at startup and it never changes.
 *
 *   setCurrentApp('battleplan');   // in main.tsx, before render
 *
 * Inside the native BattlePlan HQ shell all three apps live in one binary, and
 * "which app am I in" becomes a function of the current route — it changes as
 * the user moves around. That's why this is a subscribable store rather than a
 * plain variable: the switcher and the access gate have to re-render when it
 * changes, which a module-level `let` can't drive.
 *
 * Read it reactively with useCurrentApp() inside components. getCurrentApp() is
 * for one-shot reads outside React (see authRedirectTo in supabase.ts), where a
 * point-in-time answer is exactly what's wanted.
 *
 * The slug must match a row in public.platform_apps.
 */

import { useSyncExternalStore } from 'react';

export type AppSlug = 'battleplan' | 'battlecards' | 'battlebox' | 'battlepack';

let currentApp: AppSlug | null = null;

const listeners = new Set<() => void>();

/**
 * Register which app is currently active.
 *
 * Called once at startup in a standalone web build, and on every route change
 * in the HQ shell. Setting it to the value it already holds is a no-op, so the
 * shell can call it unconditionally without causing render loops.
 */
export function setCurrentApp(slug: AppSlug): void {
  if (currentApp === slug) return;
  currentApp = slug;
  listeners.forEach((l) => l());
}

/** The active app slug, or null if setCurrentApp was never called. */
export function getCurrentApp(): AppSlug | null {
  return currentApp;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reactive read of the active app. Re-renders when it changes. */
export function useCurrentApp(): AppSlug | null {
  return useSyncExternalStore(subscribe, getCurrentApp, getCurrentApp);
}
