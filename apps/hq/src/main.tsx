import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { consumeSessionFromUrl, setCurrentApp, initNativeAuth } from '@battleplans/ui';
import './index.css';
import App from './App.tsx';

// HQ contains all three apps, so unlike a standalone build this isn't a
// constant — it's the app HQ opens on. The switcher moves it from here, and
// the shell keeps it in step with what's mounted.
setCurrentApp('battleplan');

// Catch auth deep links coming back from the system browser. Registered before
// render so a link that launched the app cold isn't missed. No-op on web.
initNativeAuth();

if (import.meta.env.DEV) {
  document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute('href', '/favicon-dev.svg');
}

// Restore a session handed off from a Battleplans app on the web — someone can
// still arrive here from a browser link even though HQ's own switcher never
// leaves the app.
consumeSessionFromUrl().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
