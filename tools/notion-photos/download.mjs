// Pull the battle photos out of Notion, and the metadata needed to place them.
//
//   $env:NOTION_TOKEN = "ntn_..."
//   node tools/notion-photos/download.mjs
//
// Downloads every image to a local folder and writes metadata.json (game,
// opponent, players, winners per page) so the matcher can use more than the
// date. Nothing is uploaded and nothing in Notion is modified.
//
// Notion's file URLs are signed and short-lived, so this fetches each page's
// blocks and downloads its images immediately, page by page, rather than
// collecting URLs up front and racing the clock.
//
// Photos land OUTSIDE the repo by default: ~285 phone photos is potentially a
// couple of GB, the repo lives in a synced OneDrive folder, and none of it
// belongs in git. Override with PHOTO_DIR if you want them elsewhere.

import { mkdir, writeFile, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

const TOKEN = process.env.NOTION_TOKEN
const NOTION_VERSION = '2022-06-28'
const CONCURRENCY = 3

const PHOTO_DIR =
  process.env.PHOTO_DIR ||
  join(process.env.LOCALAPPDATA || process.env.HOME || '.', 'notion-battle-photos')

if (!TOKEN) {
  console.error('NOTION_TOKEN is not set — see inventory.mjs for the setup steps.')
  process.exit(1)
}

const here = (name) => new URL(`./${name}`, import.meta.url)

async function notion(path) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.notion.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': NOTION_VERSION },
    })
    if (res.ok) return res.json()

    const retryable = res.status === 429 || res.status >= 500
    if (!retryable || attempt >= 4) throw new Error(`GET ${path} → ${res.status}`)
    const wait = Number(res.headers.get('retry-after') ?? 0) * 1000 || 500 * 2 ** attempt
    await new Promise(r => setTimeout(r, wait))
  }
}

/** Resolve a relation's page id to its title, cached — the same handful of
 *  games and people repeat across all 300 rows.
 *
 *  Relation targets live in *other* databases (Games, Players), and a Notion
 *  integration sees nothing that hasn't been explicitly shared with it. Sharing
 *  the Tabletop Games database alone leaves every one of these 404ing, which
 *  silently empties the game and opponent fields — so unresolved ids are
 *  counted and reported rather than swallowed. */
const titles = new Map()
const unresolved = new Map()

async function titleOf(pageId) {
  if (titles.has(pageId)) return titles.get(pageId)

  let title = null
  try {
    const page = await notion(`pages/${pageId}`)
    const prop = Object.values(page.properties ?? {}).find(p => p.type === 'title')
    title = prop?.title?.map(t => t.plain_text).join('') || null
  } catch (err) {
    unresolved.set(pageId, String(err.message ?? err))
  }

  titles.set(pageId, title)
  return title
}

async function imageBlocks(blockId, depth = 0) {
  if (depth > 4) return []
  const found = []
  let cursor

  do {
    const page = await notion(
      `blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`,
    )
    for (const block of page.results) {
      if (block.type === 'image') {
        const img = block.image
        const url = img?.type === 'external' ? img.external?.url : img?.file?.url
        if (url) found.push({ block_id: block.id, url })
      } else if (block.has_children) {
        found.push(...(await imageBlocks(block.id, depth + 1)))
      }
    }
    cursor = page.has_more ? page.next_cursor : undefined
  } while (cursor)

  return found
}

/** Extension from the URL path, ignoring the signature query string. */
function extensionOf(url) {
  const path = new URL(url).pathname
  const dot = path.lastIndexOf('.')
  const ext = dot === -1 ? '' : path.slice(dot + 1).toLowerCase()
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : 'jpg'
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        results[i] = await fn(items[i], i)
      }
    }),
  )
  return results
}

const inventory = JSON.parse(await readFile(here('inventory.json'), 'utf8'))
const targets = inventory.pages.filter(p => p.images.length > 0)

await mkdir(PHOTO_DIR, { recursive: true })
console.log(`${targets.length} pages with photos → ${PHOTO_DIR}`)

let done = 0
let downloaded = 0
let skipped = 0

const metadata = await mapLimit(targets, CONCURRENCY, async (page) => {
  const dir = join(PHOTO_DIR, page.page_id)
  await mkdir(dir, { recursive: true })

  // Fetch blocks and page properties together — one page's worth of work, so
  // the signed URLs are used within seconds of being issued.
  const [images, props] = await Promise.all([
    imageBlocks(page.page_id),
    notion(`pages/${page.page_id}`).then(p => p.properties ?? {}),
  ])

  const files = []
  for (const [i, image] of images.entries()) {
    const file = join(dir, `${i}.${extensionOf(image.url)}`)

    // Resume-safe: a re-run after a partial failure shouldn't refetch bytes.
    try {
      const existing = await stat(file)
      if (existing.size > 0) {
        files.push(file)
        skipped++
        continue
      }
    } catch {
      // not downloaded yet
    }

    const res = await fetch(image.url)
    if (!res.ok) {
      console.error(`  ! ${page.name || page.page_id}: image ${i} → ${res.status}`)
      continue
    }
    await writeFile(file, Buffer.from(await res.arrayBuffer()))
    files.push(file)
    downloaded++
  }

  const relation = async (name) =>
    (await Promise.all((props[name]?.relation ?? []).map(r => titleOf(r.id)))).filter(Boolean)

  const text = (name) => props[name]?.rich_text?.map(t => t.plain_text).join('') || null

  const meta = {
    page_id: page.page_id,
    name: page.name,
    date: page.date,
    game: (await relation('Game'))[0] ?? null,
    players: await relation('Players'),
    winners: await relation('Winners'),
    opponent_squad: text("Opponent's Squad"),
    friendly_squad: text('Friendly Squad'),
    draw: props['Draw']?.checkbox ?? false,
    files,
  }

  if (++done % 25 === 0 || done === targets.length) {
    console.log(`  ${done}/${targets.length}  (${downloaded} downloaded, ${skipped} already present)`)
  }

  return meta
})

await writeFile(here('metadata.json'), JSON.stringify({ photo_dir: PHOTO_DIR, pages: metadata }, null, 2))

const totalFiles = metadata.reduce((n, m) => n + m.files.length, 0)
const missing = metadata.filter(m => m.files.length === 0)

console.log('')
console.log(`Pages processed:  ${metadata.length}`)
console.log(`Photos on disk:   ${totalFiles}  (${downloaded} new, ${skipped} already there)`)
console.log(`Pages with none:  ${missing.length}${missing.length ? ' — re-run to retry' : ''}`)
console.log(`Games resolved:   ${new Set(metadata.map(m => m.game).filter(Boolean)).size}`)
console.log(`Opponents found:  ${metadata.filter(m => m.players.length).length} pages`)

if (unresolved.size) {
  console.log('')
  console.log(`!! ${unresolved.size} relation target(s) could not be read.`)
  console.log('   Game and opponent will be blank, which drops the matcher back to')
  console.log('   date-only. The Game and Players relations point at OTHER databases,')
  console.log('   and an integration sees only what is shared with it explicitly.')
  console.log('')
  console.log('   Fix: share the parent page (The Vault) with the integration —')
  console.log('   ••• → Connections — then re-run. Images already on disk are skipped,')
  console.log('   so the second pass only refetches metadata.')
  console.log('')
  console.log(`   First failure: ${[...unresolved.entries()][0].join(' → ')}`)
}
console.log('')
console.log(`Photos in ${PHOTO_DIR}`)
console.log('Metadata written to tools/notion-photos/metadata.json')
