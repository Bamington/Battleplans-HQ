import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { consumeSessionFromUrl, setCurrentApp, initNativeAuth } from '@battleplans/ui';
import './index.css';
import App from './App.tsx';

// Tell the shared UI which app this bundle is, so the platform switcher and
// the access gate know what to compare the user's grants against.
setCurrentApp('battleplan');

// In local dev, swap to the dev-tinted favicon so a local tab is instantly
// distinguishable from production. Tree-shaken out of production builds.
if (import.meta.env.DEV) {
  document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute('href', '/favicon-dev.svg');
}

// Catch auth deep links coming back from the system browser. Registered before
// render so a link that launched the app cold isn't missed. No-op on web.
initNativeAuth();

// Restore a session handed off from another Battleplans app (via URL hash)
// before rendering, so the app boots already logged in.
consumeSessionFromUrl().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
