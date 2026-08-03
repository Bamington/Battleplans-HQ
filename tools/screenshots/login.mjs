/**
 * login.mjs — Capture a signed-in session for the screenshot script
 *
 * Opens a real browser window and waits for you to sign in by hand, then saves
 * the resulting cookies and localStorage to tools/screenshots/.auth/<profile>.json.
 * capture.mjs reuses that file, so signing in is something you do occasionally
 * rather than every run.
 *
 * Passwords are typed by you into the browser. Nothing here reads, stores or
 * transmits them — the only thing written to disk is the session Supabase hands
 * back, which is why .auth/ is gitignored and must stay that way.
 *
 *   node tools/screenshots/login.mjs venue     # a store admin for Burrow Games
 *   node tools/screenshots/login.mjs player    # Marcus Webb
 *
 * Sessions expire. When capture.mjs starts landing on the login page, run this
 * again for that profile.
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILES = ['venue', 'player'];

const profile = process.argv[2];
const baseUrl = process.env.SHOTS_URL ?? 'http://localhost:5174';

if (!PROFILES.includes(profile)) {
  console.error(`Usage: node tools/screenshots/login.mjs <${PROFILES.join('|')}>`);
  process.exit(1);
}

const statePath = resolve(HERE, '.auth', `${profile}.json`);
await mkdir(dirname(statePath), { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

await page.goto(`${baseUrl}/login`);

console.log(`\n  Sign in as the ${profile} account in the window that just opened.`);
console.log('  Waiting for the app to land on /app ...\n');

// The app redirects to /app once the session is live. Ten minutes is generous
// enough for a password manager, a magic link, or finding the password.
await page.waitForURL(/\/app(\/|$)/, { timeout: 10 * 60 * 1000 });

// The redirect fires before Supabase has necessarily flushed the session to
// localStorage. Wait for the token to actually be there, or the saved state is
// an empty one that fails silently on the next run.
await page.waitForFunction(
  () => Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token')),
  { timeout: 15_000 }
);

await context.storageState({ path: statePath });
console.log(`  Saved ${profile} session to ${statePath}`);

await browser.close();
