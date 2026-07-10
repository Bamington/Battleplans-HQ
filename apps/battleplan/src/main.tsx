import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { consumeSessionFromUrl } from '@battleplans/ui';
import './index.css';
import App from './App.tsx';

// In local dev, swap to the dev-tinted favicon so a local tab is instantly
// distinguishable from production. Tree-shaken out of production builds.
if (import.meta.env.DEV) {
  document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute('href', '/favicon-dev.svg');
}

// Restore a session handed off from another Battleplans app (via URL hash)
// before rendering, so the app boots already logged in.
consumeSessionFromUrl().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
