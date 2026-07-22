/// <reference types="vite/client" />

/**
 * Build-time globals injected by vite.config.ts `define`.
 *
 * Declared here rather than relied on from the sibling apps: HQ compiles their
 * sources directly, but its tsconfig only includes its own src, so their
 * vite-env.d.ts files never load. Without this, any screen that renders the
 * version footer fails to typecheck in the HQ build while compiling fine in its
 * own.
 */
declare const __APP_VERSION__: string;
declare const __APP_BUILD_DATE__: string;
