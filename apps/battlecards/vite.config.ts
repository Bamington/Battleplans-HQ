/**
 * vite.config.ts — Vite build tool configuration
 *
 * Plugins:
 * - react:      Enables React/JSX support and fast refresh during development
 * - tailwindcss: Processes Tailwind utility classes at build time (v4 uses a
 *               Vite plugin instead of a PostCSS config)
 *
 * Globals injected at build time:
 * - __APP_VERSION__:    from package.json "version" field
 * - __APP_BUILD_DATE__: current date at build time (DD/MM/YYYY)
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  resolve: {
    alias: {
      '@battleplans/ui': resolve(__dirname, '../../packages/ui/src/index.ts'),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    __APP_VERSION__:    JSON.stringify(pkg.version),
    __APP_BUILD_DATE__: JSON.stringify(new Date().toLocaleDateString('en-GB')),
  },
});
