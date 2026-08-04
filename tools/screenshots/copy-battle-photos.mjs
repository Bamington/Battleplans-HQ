/**
 * copy-battle-photos.mjs — Give Marcus his own copies of the battle photos
 *
 * The battle grid uses a photo as each card's background, and that grid is what
 * the landing page's battle-log section is built around. Marcus has no
 * photographs of his own and we're not inventing any, so his battles reuse ones
 * already in the bucket.
 *
 * They have to be COPIES, not references: battle_images has UNIQUE (image_path),
 * so a path can belong to exactly one row, and every original is already claimed
 * by the battle it was uploaded for. Referencing them directly fails outright.
 *
 * WHAT THIS DOES NOT TOUCH
 *
 *   Only the platform owner's own photos are copied. Two of the images in that
 *   bucket belong to other real users; their miniatures are not ours to put on a
 *   public marketing page, and the query below filters on owner for that reason
 *   alone. Don't widen it.
 *
 *   Nothing is modified or deleted at the source. Storage writes are keyed on
 *   the first path segment matching auth.uid(), so authenticating as Marcus
 *   makes it structurally impossible for this script to alter the originals —
 *   the only thing it can write is his own folder.
 *
 * ORDER: run this BEFORE the seed. It copies the files; the seed creates the
 * battle_images rows that point at them.
 *
 *   node tools/screenshots/copy-battle-photos.mjs
 *   npx supabase db query --linked -f supabase/seeds/burrow_games.sql
 *
 * Needs a Marcus session (tools/screenshots/login.mjs player) and a linked
 * Supabase CLI — the source list comes from the same admin connection the seed
 * uses, so there's no second copy of the selection logic to drift.
 */

import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

const MARCUS = 'b0770000-0000-4000-b000-000000000001';
const OWNER  = 'c0fab326-f180-4fe6-bf1b-87c069be3794';
const BUCKET = 'battle-images';
/* The games Marcus's recent battles use — the ones there are real photos for. */
const GAMES  = ['Star Wars Shatterpoint', 'Blood Bowl', 'Halo: Flashpoint'];

/* ── Source list, via the same admin connection the seed uses ─────────────── */

const SQL = `
  select bi.image_path
  from battle_images bi
  join battles b on b.id = bi.battle_id
  join games   g on g.id = b.game_id
  where bi.user_id = '${OWNER}'
    and g.name in (${GAMES.map(g => `'${g.replace(/'/g, "''")}'`).join(', ')})
  order by bi.created_at, bi.id
`;

async function sourcePaths() {
  /*
   * Via a temp file rather than as an argument. Passing multi-line SQL through
   * `shell: true` on Windows hangs — the newlines get mangled into something
   * the shell waits forever to finish reading.
   */
  const sqlFile = resolve(tmpdir(), `burrow-source-photos-${process.pid}.sql`);
  await writeFile(sqlFile, SQL, 'utf8');

  try {
    /*
     * shell: true is required — Node refuses to spawn npx.cmd directly on
     * Windows (EINVAL). It's safe here only because every argument is now
     * fixed text or a temp path we generated; the SQL itself goes via -f.
     */
    const { stdout } = await run('npx', ['supabase', 'db', 'query', '--linked', '-f', `"${sqlFile}"`], {
      cwd: ROOT, shell: true, maxBuffer: 10 * 1024 * 1024,
    });
    // The CLI prints a line or two before the JSON envelope.
    const json = stdout.slice(stdout.indexOf('{'));
    return JSON.parse(json).rows.map(r => r.image_path);
  } finally {
    await rm(sqlFile, { force: true });
  }
}

/* ── Marcus's session ────────────────────────────────────────────────────── */

async function marcusClient() {
  const env = await readFile(resolve(ROOT, 'apps/battleplan/.env'), 'utf8');
  const url = env.match(/VITE_SUPABASE_URL=(.+)/)?.[1].trim();
  const key = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1].trim();
  if (!url || !key) throw new Error('VITE_SUPABASE_URL / ANON_KEY missing from apps/battleplan/.env');

  const state = JSON.parse(await readFile(resolve(HERE, '.auth', 'player.json'), 'utf8'));
  const entry = state.origins
    .flatMap(o => o.localStorage)
    .find(kv => /auth-token$/.test(kv.name));
  if (!entry) throw new Error('No session found — run: node tools/screenshots/login.mjs player');

  // Newer supabase-js base64-encodes the stored session.
  const raw = entry.value.startsWith('base64-')
    ? Buffer.from(entry.value.slice(7), 'base64').toString()
    : entry.value;
  const session = JSON.parse(raw);

  const supabase = createClient(url, key);
  // setSession refreshes if the access token has already expired, which it will
  // have if the login was more than an hour ago.
  const { data, error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw new Error(`Session rejected (${error.message}) — re-run login.mjs player`);
  if (data.user?.id !== MARCUS) {
    throw new Error(`Session belongs to ${data.user?.email}, not Marcus — re-run login.mjs player`);
  }
  return supabase;
}

/* ── Copy ────────────────────────────────────────────────────────────────── */

const paths = await sourcePaths();
if (!paths.length) {
  console.error('  No source photos found for:', GAMES.join(', '));
  process.exit(1);
}

const supabase = await marcusClient();
const storage = supabase.storage.from(BUCKET);

let copied = 0, already = 0, failed = 0;

for (const from of paths) {
  // Keep the filename, swap the owner folder. The seed derives destination
  // paths the same way, so the two agree without sharing state.
  const to = `${MARCUS}/${from.split('/').pop()}`;
  const { error } = await storage.copy(from, to);

  if (!error) { copied++; continue; }
  if (/exists|duplicate/i.test(error.message)) { already++; continue; }
  console.error(`  FAILED ${from} -> ${to}: ${error.message}`);
  failed++;
}

console.log(`\n  ${paths.length} source photos: ${copied} copied, ${already} already there, ${failed} failed.`);
console.log('  Now run the seed to attach them:');
console.log('    npx supabase db query --linked -f supabase/seeds/burrow_games.sql\n');
process.exit(failed ? 1 : 0);
