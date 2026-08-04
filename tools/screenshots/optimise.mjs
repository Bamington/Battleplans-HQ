/**
 * optimise.mjs — Turn raw captures into web assets
 *
 * The captures are deliberately oversized: 2x of a 1440 or 2200 viewport, as
 * PNG, which is right for an archive and wrong for a landing page. The full set
 * is about 19MB and the two gallery shots alone are 8MB of that. Shipping those
 * would undo everything the page does well.
 *
 * This resizes to what each slot actually displays, crops the tall column clips
 * to something that isn't a ribbon, and re-encodes as WebP.
 *
 * Encoding happens in Chromium via canvas rather than through sharp or
 * imagemagick — Playwright is already a dependency and this needs no second
 * image toolchain, at the cost of being a slightly odd-looking script.
 *
 *   node tools/screenshots/optimise.mjs
 *
 * Reads tools/screenshots/out/, writes apps/battleplan/src/marketing/assets/shots/.
 * The output IS committed: it's what the site ships, and it shouldn't need a
 * browser and a database to rebuild at deploy time.
 */

import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const IN   = resolve(HERE, 'out');
const OUT  = resolve(HERE, '..', '..', 'apps/battleplan/src/marketing/assets/shots');

/*
 * width  — the widest the image is ever displayed, doubled for retina.
 * ratio  — crop to this width:height, from the top. The column clips run to
 *          1620px tall against 670 wide; at that shape they'd either be a
 *          sliver on the page or get cropped arbitrarily by object-cover.
 *          Cropping deliberately, from the top, keeps the header and the first
 *          few rows — which is the part worth showing.
 */
/*
 * Game icons for the interactive booking demo.
 *
 * `from` points outside the capture folder — these aren't screenshots, they're
 * the app's own game artwork. Copied and shrunk rather than imported from
 * packages/ui, because the marketing system shares no modules with the app; and
 * sized for a 3x display at the 64px the detail dialog uses.
 */
const ICON_DIR = resolve(HERE, '..', '..', 'packages/ui/src/assets/games/icons');

const ASSETS = [
  { from: ICON_DIR, src: 'Battletech',            out: 'icons/battletech',  width: 192 },
  { from: ICON_DIR, src: 'Bolt Action Icon',      out: 'icons/bolt-action', width: 192 },
  { from: ICON_DIR, src: 'Blood Bowl Icon',       out: 'icons/blood-bowl',  width: 192 },
  { from: ICON_DIR, src: 'Warhammer 40,000 Icon', out: 'icons/40k',         width: 192 },
  { from: ICON_DIR, src: 'Necromunda Icon',       out: 'icons/necromunda',  width: 192 },

  /*
   * Mobile heroes. A four-column desktop capture rendered at 324px on a phone
   * is an illegible smear — it says "an app exists" and nothing else. These are
   * captures of the app at phone width, swapped in below md by <picture>.
   */
  { src: 'player-home-mobile',        out: 'player-home-mobile',        width: 800 },
  { src: 'venue-manage-store-mobile', out: 'venue-manage-store-mobile', width: 800 },
  { src: 'player-stats-mobile',       out: 'player-stats-mobile',       width: 800 },
  { src: 'venue-stats-mobile',        out: 'venue-stats-mobile',        width: 800 },

  // Player page
  { src: 'player-home-gallery',   out: 'player-home',     width: 2400 },
  { src: 'player-bookings',       out: 'player-bookings', width: 900, ratio: 9 / 21 },
  { src: 'player-battles-gallery', out: 'player-battles', width: 1150, ratio: 9 / 21 },
  { src: 'player-stats',          out: 'player-stats',    width: 1200 },
  { src: 'player-friends',        out: 'player-friends',  width: 900, ratio: 9 / 21 },
  // Venue page
  { src: 'venue-manage-store',    out: 'venue-manage-store', width: 2400 },
  { src: 'venue-tables',          out: 'venue-tables',    width: 900, ratio: 9 / 21 },
  { src: 'venue-today',           out: 'venue-today',     width: 900, ratio: 9 / 21 },
  { src: 'venue-stats',           out: 'venue-stats',     width: 1200 },
];

const QUALITY = 0.82;

const browser = await chromium.launch();
const page = await browser.newPage();
await mkdir(OUT, { recursive: true });

let before = 0, after = 0;

for (const asset of ASSETS) {
  // `from` lets an entry pull in something that isn't a capture — the game
  // icons come out of the app's own asset folder.
  const srcPath = resolve(asset.from ?? IN, `${asset.src}.png`);
  let png;
  try {
    png = await readFile(srcPath);
  } catch {
    console.error(`  MISSING ${asset.src}.png ${asset.from ? '(source asset)' : '— run capture.mjs first'}`);
    continue;
  }
  before += png.length;

  const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
  const webpBase64 = await page.evaluate(
    async ({ dataUrl, width, ratio, quality }) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();

      // Crop from the top when a ratio is asked for and the source is taller.
      const cropH = ratio ? Math.min(img.height, Math.round(img.width / ratio)) : img.height;
      const w = Math.min(width, img.width);
      const h = Math.round((cropH / img.width) * w);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, img.width, cropH, 0, 0, w, h);

      return canvas.toDataURL('image/webp', quality).split(',')[1];
    },
    { dataUrl, width: asset.width, ratio: asset.ratio ?? null, quality: QUALITY }
  );

  const webp = Buffer.from(webpBase64, 'base64');
  after += webp.length;
  const outPath = resolve(OUT, `${asset.out}.webp`);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, webp);

  const pct = Math.round((1 - webp.length / png.length) * 100);
  console.log(
    `  ${asset.out}.webp`.padEnd(30),
    `${Math.round(png.length / 1024)} KB -> ${Math.round(webp.length / 1024)} KB  (-${pct}%)`
  );
}

await browser.close();

const files = ASSETS;
console.log(
  `\n  ${files.length} assets, ${Math.round(before / 1024)} KB -> ${Math.round(after / 1024)} KB total\n  ${OUT}\n`
);
