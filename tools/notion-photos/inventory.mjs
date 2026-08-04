// Inventory the photos in Chris's Notion battle log.
//
// Walks every row of the "⚔️ Tabletop Games" database, recurses the page body,
// and counts image blocks. Read-only — it writes a manifest and touches nothing
// in Notion or Supabase.
//
//   NOTION_TOKEN=ntn_... node tools/notion-photos/inventory.mjs
//
// Output: tools/notion-photos/inventory.json, plus a summary on stdout.
//
// The manifest deliberately stores block ids and NOT the image URLs. Notion
// signs those and they expire fast (the MCP connector hands out 5-minute ones),
// so the download step re-fetches each page immediately before pulling bytes
// rather than trusting anything cached here.

import { writeFile } from 'node:fs/promises'

const TOKEN = process.env.NOTION_TOKEN
const DATABASE_ID = 'e266218147c943de836fa7f18af91ef0'
const NOTION_VERSION = '2022-06-28'

// Notion rate-limits at roughly 3 requests/second averaged. Three in flight
// with a retry on 429 keeps us under it without dragging the run out.
const CONCURRENCY = 3

if (!TOKEN) {
  console.error('NOTION_TOKEN is not set. Create an internal integration at')
  console.error('https://www.notion.so/my-integrations, then share the')
  console.error('"⚔️ Tabletop Games" database with it (••• → Connections).')
  process.exit(1)
}

/** Call the Notion API, retrying on rate limits and transient 5xx. */
async function notion(path, { method = 'GET', body } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.notion.com/v1/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Notion-Version': NOTION_VERSION,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

    if (res.ok) return res.json()

    const retryable = res.status === 429 || res.status >= 500
    if (!retryable || attempt >= 4) {
      throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`)
    }
    // Honour Retry-After when Notion sends it, otherwise back off gently.
    const wait = Number(res.headers.get('retry-after') ?? 0) * 1000 || 500 * 2 ** attempt
    await new Promise(r => setTimeout(r, wait))
  }
}

/** Every row in the database, following pagination. */
async function fetchRows() {
  const rows = []
  let cursor

  do {
    const page = await notion(`databases/${DATABASE_ID}/query`, {
      method: 'POST',
      body: { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) },
    })
    rows.push(...page.results)
    cursor = page.has_more ? page.next_cursor : undefined
  } while (cursor)

  return rows
}

/**
 * Image blocks anywhere under a page — images can sit inside columns, toggles
 * or callouts, so a flat listing of the top level would undercount.
 */
async function fetchImages(blockId, depth = 0) {
  // Guard against a pathological nesting depth rather than recursing forever.
  if (depth > 4) return []

  const images = []
  let cursor

  do {
    const page = await notion(
      `blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`,
    )

    for (const block of page.results) {
      if (block.type === 'image') {
        images.push({
          block_id: block.id,
          // external images are linked, not uploaded — no bytes of ours to move
          kind: block.image?.type === 'external' ? 'external' : 'file',
        })
      }
      if (block.has_children && block.type !== 'image') {
        images.push(...(await fetchImages(block.id, depth + 1)))
      }
    }

    cursor = page.has_more ? page.next_cursor : undefined
  } while (cursor)

  return images
}

/** Map over items with a fixed number of workers in flight. */
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

const plain = (prop) =>
  prop?.title?.map(t => t.plain_text).join('') ??
  prop?.rich_text?.map(t => t.plain_text).join('') ??
  null

console.log('Fetching database rows…')
const rows = await fetchRows()
console.log(`${rows.length} rows. Walking page bodies…`)

let done = 0
const pages = await mapLimit(rows, CONCURRENCY, async (row) => {
  const images = await fetchImages(row.id)

  if (++done % 25 === 0 || done === rows.length) {
    console.log(`  ${done}/${rows.length}`)
  }

  return {
    page_id: row.id,
    url: row.url,
    name: plain(row.properties?.Name),
    date: row.properties?.['Date Played']?.date?.start ?? null,
    images,
  }
})

const withPhotos = pages.filter(p => p.images.length > 0)
const totalImages = pages.reduce((n, p) => n + p.images.length, 0)
const external = pages.reduce((n, p) => n + p.images.filter(i => i.kind === 'external').length, 0)
const undated = pages.filter(p => !p.date)

await writeFile(
  new URL('./inventory.json', import.meta.url),
  JSON.stringify({ generated_for: DATABASE_ID, pages }, null, 2),
)

console.log('')
console.log(`Rows:                 ${pages.length}`)
console.log(`  with photos:        ${withPhotos.length}`)
console.log(`  without:            ${pages.length - withPhotos.length}`)
console.log(`  undated:            ${undated.length} (${undated.filter(p => p.images.length).length} with photos)`)
console.log(`Photos:               ${totalImages}`)
console.log(`  externally linked:  ${external}  (not ours to copy)`)
console.log(`  most on one page:   ${Math.max(0, ...pages.map(p => p.images.length))}`)
console.log('')
console.log('Written to tools/notion-photos/inventory.json')
