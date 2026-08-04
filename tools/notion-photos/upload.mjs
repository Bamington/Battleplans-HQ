// Stage the matched photos for upload and emit the migration that links them.
//
//   node tools/notion-photos/upload.mjs
//
// Writes two things and changes nothing live:
//
//   1. a staging tree laid out exactly as the bucket expects,
//      {user_id}/notion-{page_id}-{n}.{ext}, ready for a single
//      `supabase storage cp -r`
//   2. supabase/migrations/<stamp>_import_notion_battle_photos.sql, the
//      battle_images rows
//
// Filenames embed the Notion page id so every stored object traces back to the
// page it came from, and so a re-run produces identical paths. battle_images
// has a unique index on image_path and the insert is ON CONFLICT DO NOTHING, so
// running the whole thing twice is a no-op rather than a duplicate.
//
// Review dates and undated pages are excluded: they have no agreed battle to
// attach to.

import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises'
import { join, extname, basename } from 'node:path'

const here = (name) => new URL(`./${name}`, import.meta.url)
const read = async (name) => JSON.parse(await readFile(here(name), 'utf8'))

const STAGE = process.env.STAGE_DIR || join(process.env.LOCALAPPDATA || '.', 'notion-battle-staging')

const manifest = await read('match-manifest.json')
const metadata = await read('metadata.json')
const battles = await read('battles.json')

const meta = new Map(metadata.pages.map(p => [p.page_id, p]))
const battleById = new Map(battles.map(b => [b.id, b]))

// The bucket only accepts these; anything else would be rejected at upload.
const ALLOWED = new Set(['jpg', 'jpeg', 'png', 'webp', 'jfif'])

const owners = new Set(battles.map(b => b.user_id).filter(Boolean))
if (owners.size !== 1) {
  console.error(`Expected exactly one owner in battles.json, found ${owners.size}.`)
  console.error('Re-export it with user_id included.')
  process.exit(1)
}
const USER_ID = [...owners][0]

await rm(STAGE, { recursive: true, force: true })
const stageDir = join(STAGE, USER_ID)
await mkdir(stageDir, { recursive: true })

const rows = []
const rejected = []
let staged = 0

for (const match of manifest.matches) {
  const page = meta.get(match.page_id)
  if (!page || page.files.length === 0) continue

  // Guard against attaching to a battle that has since gained a photo, which
  // would fight the one-primary-per-battle index.
  const battle = battleById.get(match.battle_id)
  if (!battle) continue
  if (battle.photos > 0) {
    rejected.push({ battle_id: match.battle_id, reason: 'battle already has a photo' })
    continue
  }

  for (const [i, file] of page.files.entries()) {
    const ext = extname(file).slice(1).toLowerCase()
    if (!ALLOWED.has(ext)) {
      rejected.push({ file: basename(file), reason: `.${ext} not accepted by the bucket` })
      continue
    }

    const name = `notion-${match.page_id}-${i}.${ext}`
    await copyFile(file, join(stageDir, name))
    staged++

    rows.push({
      battle_id: match.battle_id,
      image_path: `${USER_ID}/${name}`,
      // These battles all had no photo, so the first image becomes the card
      // background and the rest queue up behind it in the carousel.
      is_primary: i === 0,
      display_order: i,
    })
  }
}

// ── Emit the migration ───────────────────────────────────────────────────────
const stamp = process.env.MIGRATION_STAMP
if (!stamp) {
  console.error('MIGRATION_STAMP is not set (expected YYYYMMDDHHMMSS).')
  console.error('Check `supabase migration list --linked` for collisions first.')
  process.exit(1)
}

const values = rows
  .map(r => `  (${r.battle_id}, '${USER_ID}', '${r.image_path}', ${r.is_primary}, ${r.display_order})`)
  .join(',\n')

const byConfidence = manifest.matches.reduce((acc, m) => {
  acc[m.confidence] = (acc[m.confidence] ?? 0) + 1
  return acc
}, {})

const sql = `-- ${stamp}_import_notion_battle_photos.sql
--
-- The photos from Chris's pre-app Notion battle log, attached to the battles
-- the backfill created for them. Objects were copied into the battle-images
-- bucket out of band (see tools/notion-photos/) — this migration is the link
-- between the two, in the same shape as the earlier 20260712030000 import.
--
-- Filenames carry the Notion page id, so every row traces back to its source
-- page. image_path is unique and the insert is idempotent.
--
-- Pairings by confidence: ${Object.entries(byConfidence).map(([k, v]) => `${v} ${k}`).join(', ')}.
-- Photos on dates whose counts disagreed, and the undated pages, are left out.
-- Chris accepted the residual risk that a photo may land on the wrong round of
-- a same-day, same-opponent event; those are obvious and easy to fix in-app.

insert into public.battle_images (battle_id, user_id, image_path, is_primary, display_order) values
${values}
on conflict (image_path) do nothing;
`

const migration = new URL(
  `../../supabase/migrations/${stamp}_import_notion_battle_photos.sql`,
  import.meta.url,
)
await writeFile(migration, sql)

console.log(`Staged:     ${staged} files → ${stageDir}`)
console.log(`Rows:       ${rows.length} battle_images inserts`)
console.log(`Battles:    ${new Set(rows.map(r => r.battle_id)).size}`)
console.log(`Rejected:   ${rejected.length}`)
for (const r of rejected.slice(0, 10)) console.log(`  - ${r.file ?? r.battle_id}: ${r.reason}`)
console.log('')
console.log(`Migration:  supabase/migrations/${stamp}_import_notion_battle_photos.sql`)
console.log('')
console.log('Next: supabase storage cp -r <stage> ss:///battle-images/ --linked --experimental')
