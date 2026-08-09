/**
 * fetch-battle-photos.mjs — Pull the demo's battle photos out of storage
 *
 * The battle-record demo shows real miniature photography, the same images the
 * gallery screenshot two sections away is made of. They live in the
 * battle-images bucket rather than the repo, so this downloads the primary
 * photo of Marcus's ten most recent battles into the capture folder, where
 * optimise.mjs picks them up like anything else.
 *
 *   node tools/screenshots/fetch-battle-photos.mjs
 *   node tools/screenshots/optimise.mjs
 *
 * Only the fixture account's photos are fetched, and those are already copies
 * of the platform owner's own work — no other user's images are involved at any
 * point. The bucket is public-read, so this needs no credentials.
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const OUT = resolve(HERE, 'out', 'battle-photos');

const MARCUS = 'b0770000-0000-4000-b000-000000000001';

const SQL = `
  select
    row_number() over (order by b.date_played desc) as n,
    bi.image_path
  from battles b
  join battle_images bi on bi.battle_id = b.id and bi.is_primary
  where b.user_id = '${MARCUS}'
  order by b.date_played desc
  limit 10
`;

/* Same shape as copy-battle-photos.mjs — multi-line SQL through a shell hangs
   on Windows, so it goes via a temp file. */
const sqlFile = resolve(tmpdir(), `burrow-battle-photos-${process.pid}.sql`);
await writeFile(sqlFile, SQL, 'utf8');
const { stdout } = await run('npx', ['supabase', 'db', 'query', '--linked', '-f', `"${sqlFile}"`], {
  cwd: ROOT, shell: true, maxBuffer: 10 * 1024 * 1024,
});
const rows = JSON.parse(stdout.slice(stdout.indexOf('{'))).rows;

const env = await readFile(resolve(ROOT, 'apps/battleplan/.env'), 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.+)/)?.[1].trim();

await mkdir(OUT, { recursive: true });

for (const { n, image_path } of rows) {
  const ext = image_path.split('.').pop().toLowerCase();
  const res = await fetch(`${url}/storage/v1/object/public/battle-images/${image_path}`);
  if (!res.ok) {
    console.error(`  FAILED ${image_path}: ${res.status}`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const name = `battle-${String(n).padStart(2, '0')}.${ext}`;
  await writeFile(resolve(OUT, name), buf);
  console.log(`  ${name.padEnd(18)} ${Math.round(buf.length / 1024)} KB`);
}

console.log(`\n  ${rows.length} photos -> ${OUT}\n  Now run: node tools/screenshots/optimise.mjs\n`);
