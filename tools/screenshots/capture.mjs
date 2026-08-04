/**
 * capture.mjs — Marketing screenshots, taken the same way every time
 *
 * Drives a real Chromium at high pixel density and writes PNGs to
 * tools/screenshots/out/. The point isn't that it's faster than doing it by
 * hand — for one pass it isn't — it's that the design is still moving and the
 * Burrow Games fixture regenerates on every run, so these have to be retakeable
 * without anyone remembering how the last set was framed.
 *
 *   node tools/screenshots/capture.mjs                    # everything it can log into
 *   node tools/screenshots/capture.mjs --profile=public   # marketing pages, no auth
 *   node tools/screenshots/capture.mjs --only=venue-stats
 *   node tools/screenshots/capture.mjs --scale=3          # 3x instead of 2x
 *
 * Signed-in shots need a session first — see login.mjs. Profiles with no saved
 * session are skipped with a note rather than failing the run, so the public
 * shots still work on a clean checkout.
 *
 * Requires the dev server: pnpm dev:battleplan  (or --url=https://battleplan.app)
 */

import { chromium } from 'playwright';
import { mkdir, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, 'out');

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const BASE  = args.url ?? process.env.SHOTS_URL ?? 'http://localhost:5174';
/* 2x is the floor for a marketing asset — a 1x capture looks soft the moment
   it lands on any modern display. 3x if a hero needs to run full-bleed. */
const SCALE = Number(args.scale ?? 2);
const DESKTOP = { width: 1440, height: 900 };
const MOBILE  = { width: 390, height: 844 };
/*
 * The home screen lays out five columns, each capped at max-w-sm (384px). At
 * 1440 they're crushed to ~274 and almost every line truncates — "WARHAM…",
 * "Against Tom Ash…". Five columns at their cap, plus gaps and page padding,
 * needs about 2100, so the home shots get their own viewport rather than
 * shipping a hero image full of ellipses.
 */
const WIDE = { width: 2200, height: 1300 };

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/**
 * A single home-screen column.
 *
 * ColumnShell is the only thing in the app carrying .snap-start, which makes it
 * a far steadier hook than walking up from a heading — the columns are otherwise
 * unmarked divs and any ancestor count would break the first time one gets a
 * wrapper.
 */
const column = (page, title) =>
  page.locator('div.snap-start').filter({ hasText: title }).first();

/** Pick a venue in the navbar dropdown, unless it's already showing. */
async function selectStore(page, name) {
  const header = page.locator('header, nav').first();
  if (await header.getByText(name, { exact: true }).count()) return;

  const trigger = header.locator('button').filter({ hasText: /\S/ }).first();
  if (!(await trigger.count())) {
    console.warn(`    ! no venue selector found; leaving whatever is selected`);
    return;
  }
  await trigger.click();
  const item = page.getByText(name, { exact: true }).first();
  await item.waitFor({ state: 'visible', timeout: 5_000 });
  await item.click();
  await page.waitForTimeout(400);
}

/**
 * Scroll the whole page and come back.
 *
 * The marketing pages reveal each section on scroll and start at opacity 0, so
 * a screenshot taken straight after load catches an empty page below the fold.
 */
async function revealAll(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
}

/* ── The shot list ───────────────────────────────────────────────────────── */
//
// This is the screenshot inventory from the design spec, in runnable form.
// `waitFor` is text that must be on screen before the shutter fires — it's what
// stops a capture landing mid-render with half the stats still empty.

const SHOTS = [
  /* Marketing pages — public, no session needed. */
  { name: 'marketing-hero',        profile: 'public', path: '/',       waitFor: 'Find your next game.' },
  { name: 'marketing-full',        profile: 'public', path: '/',       waitFor: 'Find your next game.', fullPage: true, reveal: true },
  { name: 'marketing-hero-mobile', profile: 'public', path: '/',       waitFor: 'Find your next game.', viewport: MOBILE },
  { name: 'venue-page-hero',       profile: 'public', path: '/venue',  waitFor: 'Your tables, booked.' },
  { name: 'venue-page-full',       profile: 'public', path: '/venue',  waitFor: 'Your tables, booked.', fullPage: true, reveal: true },

  /* Venue side — a Burrow Games admin. */
  { name: 'venue-home',          profile: 'venue', path: '/app',              store: 'Burrow Games', waitFor: "Today's Bookings", viewport: WIDE },
  { name: 'venue-today',         profile: 'venue', path: '/app',              store: 'Burrow Games', waitFor: "Today's Bookings", clip: "Today's Bookings" },
  { name: 'venue-upcoming',      profile: 'venue', path: '/app',              store: 'Burrow Games', waitFor: 'Upcoming Bookings', clip: 'Upcoming Bookings' },
  { name: 'venue-manage-store',  profile: 'venue', path: '/app/manage-store', store: 'Burrow Games', waitFor: 'Timeslots' },
  { name: 'venue-tables',        profile: 'venue', path: '/app/manage-store', store: 'Burrow Games', waitFor: 'Tables',        clip: 'Tables' },
  { name: 'venue-timeslots',     profile: 'venue', path: '/app/manage-store', store: 'Burrow Games', waitFor: 'Timeslots',     clip: 'Timeslots' },
  { name: 'venue-blocked-dates', profile: 'venue', path: '/app/manage-store', store: 'Burrow Games', waitFor: 'Blocked Dates', clip: 'Blocked Dates' },
  { name: 'venue-stats',         profile: 'venue', path: '/app/store-stats',  store: 'Burrow Games', waitFor: 'Most Booked Games' },
  { name: 'venue-stats-overview', profile: 'venue', path: '/app/store-stats', store: 'Burrow Games', waitFor: 'Bookings by month', clip: 'Overview' },
  { name: 'venue-stats-who',     profile: 'venue', path: '/app/store-stats',  store: 'Burrow Games', waitFor: 'Most Booked Games', clip: 'What & Who' },
  { name: 'venue-stats-when',    profile: 'venue', path: '/app/store-stats',  store: 'Burrow Games', waitFor: 'Busiest Days',      clip: 'When' },

  /* Player side — Marcus Webb. */
  { name: 'player-home',       profile: 'player', path: '/app',       waitFor: 'Your Battles', viewport: WIDE },
  { name: 'player-bookings',   profile: 'player', path: '/app',       waitFor: 'Your Bookings',     clip: 'Your Bookings' },
  { name: 'player-battles',    profile: 'player', path: '/app',       waitFor: 'Your Battles',      clip: 'Your Battles' },
  { name: 'player-suggested',  profile: 'player', path: '/app',       waitFor: 'Suggested Battles', clip: 'Suggested Battles', optional: true },
  { name: 'player-stats',      profile: 'player', path: '/app/stats', waitFor: 'Win / Loss' },
  { name: 'player-stats-overall',    profile: 'player', path: '/app/stats', waitFor: 'Win / Loss',   clip: 'Overall' },
  { name: 'player-stats-best-worst', profile: 'player', path: '/app/stats', waitFor: 'Best Games',   clip: 'Best & Worst' },
  { name: 'player-home-mobile',      profile: 'player', path: '/app',       waitFor: 'Your Battles', viewport: MOBILE },
];

/* ── Run ─────────────────────────────────────────────────────────────────── */

const exists = async p => access(p).then(() => true, () => false);

const wanted = SHOTS.filter(s =>
  (!args.profile || s.profile === args.profile) &&
  (!args.only || s.name === args.only)
);

if (!wanted.length) {
  console.error('No shots matched. Check --profile / --only.');
  process.exit(1);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

let taken = 0, skipped = 0, failed = 0;

for (const profile of [...new Set(wanted.map(s => s.profile))]) {
  const shots = wanted.filter(s => s.profile === profile);
  const statePath = resolve(HERE, '.auth', `${profile}.json`);
  const needsAuth = profile !== 'public';

  if (needsAuth && !(await exists(statePath))) {
    console.log(`\n  ${profile}: no saved session — skipping ${shots.length} shot(s).`);
    console.log(`    node tools/screenshots/login.mjs ${profile}`);
    skipped += shots.length;
    continue;
  }

  console.log(`\n  ${profile}`);

  for (const shot of shots) {
    const context = await browser.newContext({
      viewport: shot.viewport ?? DESKTOP,
      deviceScaleFactor: SCALE,
      storageState: needsAuth ? statePath : undefined,
      // The app is dark-only, but say so rather than depending on the runner's OS.
      colorScheme: 'dark',
    });
    const page = await context.newPage();

    try {
      await page.goto(BASE + shot.path, { waitUntil: 'domcontentloaded' });

      // An expired session lands on /login, which would otherwise be captured
      // and quietly filed as the screenshot.
      if (needsAuth && /\/login/.test(new URL(page.url()).pathname)) {
        throw new Error(`session expired — re-run: node tools/screenshots/login.mjs ${profile}`);
      }

      if (shot.store) await selectStore(page, shot.store);
      if (shot.reveal) await revealAll(page);

      await page.getByText(shot.waitFor, { exact: false }).first()
        .waitFor({ state: 'visible', timeout: 15_000 });

      // Let images decode and any transition settle before the shutter.
      await page.waitForTimeout(500);

      const file = resolve(OUT, `${shot.name}.png`);
      // fullPage is a page-level option; a clipped shot is already bounded by
      // the element, so the two never combine.
      const target = shot.clip ? column(page, shot.clip) : page;
      await target.screenshot({
        path: file,
        ...(shot.fullPage && !shot.clip ? { fullPage: true } : {}),
      });

      const vp = shot.viewport ?? DESKTOP;
      const note = shot.clip ? `clip: ${shot.clip}` : `${vp.width * SCALE}px wide`;
      console.log(`    ${shot.name}  (${note})`);
      taken++;
    } catch (err) {
      const msg = err.message.split('\n')[0];
      if (shot.optional) {
        console.log(`    ${shot.name} — skipped (${msg})`);
        skipped++;
      } else {
        console.log(`    ${shot.name} — FAILED: ${msg}`);
        failed++;
      }
    } finally {
      await context.close();
    }
  }
}

await browser.close();

console.log(`\n  ${taken} taken, ${skipped} skipped, ${failed} failed — ${OUT}\n`);
process.exit(failed ? 1 : 0);
