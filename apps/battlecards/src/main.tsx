/**
 * main.tsx — Application entry point
 *
 * This is the first file that runs when the app loads.
 * It mounts the root React component (<App />) into the
 * HTML element with id="root" (found in index.html).
 *
 * StrictMode is a development tool that highlights potential
 * issues in the app — it has no effect in production builds.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { consumeSessionFromUrl, setCurrentApp } from '@battleplans/ui';
import '../../../packages/ui/src/index.css'; // Global styles — includes Tailwind
import App from './App.tsx';
import { preloadAssets } from './lib/preloadAssets';

// Tell the shared UI which app this bundle is, so the platform switcher and
// the access gate know what to compare the user's grants against.
setCurrentApp('battlecards');

// In local dev, swap to the dev-tinted favicon so a local tab is instantly
// distinguishable from production. Tree-shaken out of production builds.
if (import.meta.env.DEV) {
  document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute('href', '/favicon-dev.svg');
}

// Kick off background preloading of all static assets (images + fonts)
// so they're cached before the user navigates to a card builder.
preloadAssets();

// Restore a session handed off from another Battleplans app (via URL hash)
// before rendering, so the app boots already logged in.
consumeSessionFromUrl().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
