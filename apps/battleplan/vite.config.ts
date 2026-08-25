import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { legacyCss } from '../../tools/vite/legacy-css';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  resolve: {
    alias: {
      '@battleplans/ui': resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@battleplans/marketing': resolve(__dirname, '../../packages/marketing/src/index.ts'),
    },
  },
  server: {
    fs: {
      allow: [resolve(__dirname, '../..')],
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    // Second stylesheet for browsers without cascade layers. See the plugin.
    legacyCss(),
  ],
  define: {
    __APP_VERSION__:    JSON.stringify(pkg.version),
    __APP_BUILD_DATE__: JSON.stringify(new Date().toLocaleDateString('en-GB')),
  },
});
