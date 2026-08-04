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
import { mkdir, access, readFile } from 'node:fs/promises';
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
/*
 * Taller viewports for the clipped columns. The columns fill the window height,
 * so a 900px viewport caps how much of one a capture can contain — and the
 * landing page now frames them at 9:21, which needs a source 2.33x taller than
 * it is wide. A taller window simply puts more rows in the shot.
 */
const TALL      = { width: 1440, height: 1600 };
const TALL_WIDE = { width: 2200, height: 2000 };

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
  page.locator('div.snap-start').filter({
    // Matched on the column's HEADING, not on any text inside it. A substring
    // match picks up descriptions too — clip: 'Tables' cheerfully returned the
    // bookings column, because its description begins "Tables you've booked".
    has: page.getByRole('heading', { name: title, exact: true }),
  }).first();

/**
 * Pick a venue in the navbar dropdown.
 *
 * Throws rather than warns. A venue shot with the wrong venue selected — or
 * with none, which lands you on the player home — is a plausible-looking image
 * of the wrong thing, and that is worse than a missing file.
 */
async function selectStore(page, name) {
  const nav = page.locator('header, nav').first();

  /*
   * Wait for the navbar to exist before looking in it. This runs moments after
   * domcontentloaded, and React hasn't painted yet — counting buttons at that
   * point finds none and concludes the account isn't an admin, which is a very
   * convincing wrong answer.
   */
  const trigger = nav.locator('button').first();
  try {
    await trigger.waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    throw new Error('navbar never rendered — is the dev server serving the app?');
  }

  /*
   * A store admin opens on their first venue, so for a single-venue account
   * the right one is already showing — but not the instant the navbar appears.
   * Give it a moment before deciding to go and click the dropdown.
   */
  try {
    await nav.getByText(name, { exact: true }).first().waitFor({ state: 'visible', timeout: 5_000 });
    return;
  } catch { /* not auto-selected — pick it by hand below */ }

  // The trigger has no text when nothing is selected — it renders as an icon
  // alone — so it can't be found by its label.
  await trigger.click();

  const item = page.getByText(name, { exact: true }).first();
  await item.waitFor({ state: 'visible', timeout: 5_000 });
  await item.click();
  await page.waitForTimeout(600);

  if (!(await nav.getByText(name, { exact: true }).count())) {
    throw new Error(`selected "${name}" but the navbar doesn't show it`);
  }
}

/**
 * Switch the home screen back to the personal view.
 *
 * Marcus admins Burrow Games so that one session can shoot both sides, and a
 * store admin's home screen opens on their first venue. Which means the PLAYER
 * shots now have to ask for the personal view explicitly — without this, every
 * one of them photographs the venue columns.
 *
 * Unlike selectStore this doesn't verify the navbar afterwards: with nothing
 * selected the picker shows an icon and no venue name, so there's nothing to
 * assert against. The shot's own waitFor covers it — "Your Bookings" only
 * exists in the personal view.
 */
async function selectPersonal(page) {
  const nav = page.locator('header, nav').first();
  const trigger = nav.locator('button').first();
  await trigger.waitFor({ state: 'visible', timeout: 15_000 });
  await trigger.click();

  const item = page.getByText('Your Profile', { exact: true }).first();
  await item.waitFor({ state: 'visible', timeout: 5_000 });
  await item.click();
  await page.waitForTimeout(600);
}

/** Who a saved session actually belongs to. */
function sessionEmail(state) {
  const kv = state.origins.flatMap(o => o.localStorage).find(k => /auth-token$/.test(k.name));
  if (!kv) return null;
  const raw = kv.value.startsWith('base64-')
    ? Buffer.from(kv.value.slice(7), 'base64').toString()
    : kv.value;
  try { return JSON.parse(raw).user?.email ?? null; } catch { return null; }
}

/**
 * Strip the two things that shouldn't appear in a marketing screenshot.
 *
 *   * The version / build-date footer. It dates the image the moment a release
 *     goes out, and pins the shot to whatever build happened to be running.
 *   * News & Updates. It carries real platform announcements written for
 *     existing users, which is off-message on a page aimed at people who have
 *     never seen the product.
 *
 * Done at capture time rather than in the app, because both are wanted in the
 * product and unwanted only in the photograph.
 *
 * Applied to signed-in shots only. The marketing pages have their own <footer>
 * that must survive, which is also why the selector is narrowed to the app
 * footer's uppercase styling rather than matching every footer on the page.
 */
async function hideAppChrome(page) {
  await page.addStyleTag({ content: 'footer.uppercase { display: none !important; }' });
}

/**
 * Drop the News & Updates column.
 *
 * Called immediately before the shutter, which is the only moment it has to be
 * gone. Earlier attempts got this wrong twice in opposite directions: a one-shot
 * removal straight after navigation ran before React had painted and found
 * nothing, and a MutationObserver that re-ran on every DOM change ground the
 * home screen to a halt — full document scans against five columns of rendering
 * meant the navbar never reported itself visible and the whole page timed out.
 *
 * Doing it once, late, is both correct and free.
 */
async function dropNewsColumn(page) {
  const removed = await page.evaluate(() => {
    let n = 0;
    for (const col of document.querySelectorAll('div.snap-start')) {
      if (col.textContent?.includes('News & Updates')) { col.remove(); n++; }
    }
    return n;
  });
  // Let the remaining columns re-flow into the space.
  if (removed) await page.waitForTimeout(400);
}

/**
 * Switch Your Battles from list rows to the photo-hero gallery.
 *
 * The gallery is where each card takes a battle photo as its background, which
 * is the whole reason the fixture has photos — and it isn't the default view,
 * so every gallery shot has to click into it first.
 */
async function galleryView(page) {
  const toggle = page.getByRole('button', { name: /gallery view/i }).first();
  /*
   * Wait for it explicitly. This runs straight after the view switch, and
   * clicking into a layout that is still reflowing intermittently hangs until
   * the 30s action timeout — it failed once in five runs before this.
   */
  await toggle.waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(400);
  await toggle.click();
  // The column widens (wide={gallery}) and the images have to decode.
  await page.waitForTimeout(1200);
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

    /*
     * Force every screenshot on the page to load and wait for it.
     *
     * The product shots are loading="lazy", and a full-page capture renders the
     * whole document at once — including parts that were never scrolled into
     * view long enough to trigger a fetch. Without this the lower half of the
     * page photographs as empty frames.
     */
    const imgs = [...document.querySelectorAll('img')];
    imgs.forEach(i => { i.loading = 'eager'; });
    await Promise.all(imgs.map(i =>
      i.complete ? null : new Promise(r => { i.onload = r; i.onerror = r; })
    ));
  });
  await page.waitForTimeout(800);
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
  /* Not WIDE like the player home: the venue side is Today's / Upcoming /
     News, and dropping News leaves two columns that would be stranded in a
     2200px frame. Worth re-checking against a real capture. */
  { name: 'venue-home',          profile: 'venue', path: '/app',              store: 'Burrow Games', waitFor: "Today's Bookings" },
  { name: 'venue-today',         profile: 'venue', path: '/app',              store: 'Burrow Games', waitFor: "Today's Bookings", clip: "Today's Bookings", scale: 4, viewport: TALL },
  { name: 'venue-upcoming',      profile: 'venue', path: '/app',              store: 'Burrow Games', waitFor: 'Upcoming Bookings', clip: 'Upcoming Bookings' },
  { name: 'venue-manage-store',  profile: 'venue', path: '/app/manage-store', store: 'Burrow Games', waitFor: 'Timeslots' },
  { name: 'venue-tables',        profile: 'venue', path: '/app/manage-store', store: 'Burrow Games', waitFor: 'Tables',        clip: 'Tables', scale: 4, viewport: TALL },
  { name: 'venue-timeslots',     profile: 'venue', path: '/app/manage-store', store: 'Burrow Games', waitFor: 'Timeslots',     clip: 'Timeslots' },
  { name: 'venue-blocked-dates', profile: 'venue', path: '/app/manage-store', store: 'Burrow Games', waitFor: 'Blocked Dates', clip: 'Blocked Dates' },
  { name: 'venue-stats',         profile: 'venue', path: '/app/store-stats',  store: 'Burrow Games', waitFor: 'Most Booked Games' },
  { name: 'venue-stats-overview', profile: 'venue', path: '/app/store-stats', store: 'Burrow Games', waitFor: 'Bookings by month', clip: 'Overview' },
  { name: 'venue-stats-who',     profile: 'venue', path: '/app/store-stats',  store: 'Burrow Games', waitFor: 'Most Booked Games', clip: 'What & Who' },
  { name: 'venue-stats-when',    profile: 'venue', path: '/app/store-stats',  store: 'Burrow Games', waitFor: 'Busiest Days',      clip: 'When' },

  /* Player side — Marcus Webb. */
  { name: 'player-home',       profile: 'player', path: '/app', personal: true,       waitFor: 'Your Battles', viewport: WIDE },
  { name: 'player-bookings',   profile: 'player', path: '/app', personal: true,       waitFor: 'Your Bookings',     clip: 'Your Bookings', scale: 4, viewport: TALL },
  { name: 'player-battles',    profile: 'player', path: '/app', personal: true,       waitFor: 'Your Battles',      clip: 'Your Battles' },
  { name: 'player-suggested',  profile: 'player', path: '/app', personal: true,       waitFor: 'Suggested Battles', clip: 'Suggested Battles', optional: true },
  { name: 'player-friends',    profile: 'player', path: '/app', personal: true,       waitFor: 'My Friends',        clip: 'My Friends', scale: 4, viewport: TALL },
  /* The gallery view — photo-backed cards. The best-looking screen in the app,
     and the one the landing page's battle-log section is written around. */
  { name: 'player-battles-gallery', profile: 'player', path: '/app', personal: true, waitFor: 'Your Battles',
    viewport: TALL_WIDE, prepare: galleryView, clip: 'Your Battles', scale: 4 },
  { name: 'player-home-gallery',    profile: 'player', path: '/app', personal: true, waitFor: 'Your Battles',
    viewport: WIDE, prepare: galleryView },
  { name: 'player-stats',      profile: 'player', path: '/app/stats', waitFor: 'Win / Loss' },
  { name: 'player-stats-overall',    profile: 'player', path: '/app/stats', waitFor: 'Win / Loss',   clip: 'Overall' },
  { name: 'player-stats-best-worst', profile: 'player', path: '/app/stats', waitFor: 'Best Games',   clip: 'Best & Worst' },
  { name: 'player-home-mobile',      profile: 'player', path: '/app', personal: true,       waitFor: 'Your Battles', viewport: MOBILE },
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

  /*
   * Say whose session this is. Both profiles were once saved as the same
   * account — a browser password manager helpfully autofilled the wrong one —
   * and every venue shot came out as a photograph of the player screen with a
   * venue filename. Printing it makes that obvious in one glance.
   */
  if (needsAuth) {
    const email = sessionEmail(JSON.parse(await readFile(statePath, 'utf8')));
    console.log(`\n  ${profile} — signed in as ${email ?? 'unknown'}`);
  } else {
    console.log(`\n  ${profile}`);
  }

  for (const shot of shots) {
    /*
     * A clipped column is only ~335 CSS px wide, so 2x yields 670px — and the
     * landing page displays it at around 560, which would mean upscaling a
     * screenshot on a page whose whole point is that the product looks sharp.
     * Those shots ask for more density instead.
     */
    const scale = shot.scale ?? SCALE;

    const context = await browser.newContext({
      viewport: shot.viewport ?? DESKTOP,
      deviceScaleFactor: scale,
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

      // Before prepare(), so a toggle click isn't measured against a layout
      // that's about to lose a column.
      if (needsAuth) await hideAppChrome(page);
      if (shot.personal) await selectPersonal(page);
      if (shot.store) await selectStore(page, shot.store);
      if (shot.prepare) await shot.prepare(page);
      if (shot.reveal) await revealAll(page);

      await page.getByText(shot.waitFor, { exact: false }).first()
        .waitFor({ state: 'visible', timeout: 15_000 });

      // Let images decode and any transition settle before the shutter.
      await page.waitForTimeout(500);
      if (needsAuth) await dropNewsColumn(page);

      const file = resolve(OUT, `${shot.name}.png`);
      // fullPage is a page-level option; a clipped shot is already bounded by
      // the element, so the two never combine.
      const target = shot.clip ? column(page, shot.clip) : page;
      await target.screenshot({
        path: file,
        ...(shot.fullPage && !shot.clip ? { fullPage: true } : {}),
      });

      const vp = shot.viewport ?? DESKTOP;
      const note = shot.clip ? `clip: ${shot.clip} @${scale}x` : `${vp.width * scale}px wide`;
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
