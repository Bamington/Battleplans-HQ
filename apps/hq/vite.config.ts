/**
 * vite.config.ts — BattlePlan HQ
 *
 * HQ composes the other three apps rather than owning screens of its own, so it
 * aliases straight at their `src` directories the same way every app already
 * aliases @battleplans/ui. Going through the source (rather than a built
 * artifact) keeps one definition of each app's routes: edit BattlePlan and both
 * its standalone build and HQ pick the change up.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const repoRoot = resolve(__dirname, '../..');

export default defineConfig({
  resolve: {
    alias: {
      '@battleplans/ui':         resolve(repoRoot, 'packages/ui/src/index.ts'),
      '@battleplans/battleplan': resolve(repoRoot, 'apps/battleplan/src/App.tsx'),
      '@battleplans/battlecards': resolve(repoRoot, 'apps/battlecards/src/App.tsx'),
      '@battleplans/battlebox':  resolve(repoRoot, 'apps/battlebox/src/App.tsx'),
    },
  },
  server: {
    fs: {
      // Everything HQ imports lives outside its own root — the shared package
      // and all three sibling apps.
      allow: [repoRoot],
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
