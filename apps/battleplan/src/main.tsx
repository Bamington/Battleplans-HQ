import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { consumeSessionFromUrl } from '@battleplans/ui';
import './index.css';
import App from './App.tsx';

// Restore a session handed off from another Battleplans app (via URL hash)
// before rendering, so the app boots already logged in.
consumeSessionFromUrl().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
