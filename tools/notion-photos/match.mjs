// Work out which Notion page's photos belong to which battle.
//
//   node tools/notion-photos/match.mjs
//
// Reads inventory.json (Notion side) and battles.json (app side), pairs them up
// by date, and writes match-manifest.json plus a summary. Read-only — decides
// nothing, uploads nothing. The manifest is what a human reviews before any
// bytes move.
//
// There is no shared key between Notion and `battles`: the backfill that
// created battles 73–349 kept no reference to the page it came from. Date is
// the only honest join, so this deliberately reports its own uncertainty
// instead of forcing a pairing:
//
//   confident  one candidate photo page, one candidate battle on that date
//   positional equal counts >1 — paired in order, but the order is an
//              assumption (the backfill ran ~date-ascending, not exactly)
//   review     counts disagree, or one side is missing entirely
//
// Only `positional` and `review` need eyes. `confident` still gets shown in the
// contact sheet, because a wrong photo on the right date is still wrong.

import { readFile, writeFile } from 'node:fs/promises'

const here = (name) => new URL(`./${name}`, import.meta.url)

const inventory = JSON.parse(await readFile(here('inventory.json'), 'utf8'))
const battles = JSON.parse(await readFile(here('battles.json'), 'utf8'))

// ── Group both sides by date ─────────────────────────────────────────────────
const byDate = new Map()
const slot = (d) => {
  if (!byDate.has(d)) byDate.set(d, { pages: [], battles: [] })
  return byDate.get(d)
}

// Only pages that actually carry photos are candidates to give one.
for (const page of inventory.pages) {
  if (page.date && page.images.length > 0) slot(page.date).pages.push(page)
}

// Only battles that lack a photo are candidates to receive one. Battles that
// already have one are left alone — Chris's call, and they're all old-app rows
// whose photos are already the real thing.
for (const battle of battles) {
  if (battle.photos === 0) slot(battle.date).battles.push(battle)
}

// ── Pair them up ─────────────────────────────────────────────────────────────
const matches = []
const review = []

for (const [date, { pages, battles: candidates }] of [...byDate].sort()) {
  if (pages.length === 0) continue

  if (candidates.length === 0) {
    review.push({
      date,
      reason: 'no photoless battle on this date',
      pages: pages.map(p => ({ page_id: p.page_id, name: p.name, images: p.images.length })),
    })
    continue
  }

  if (pages.length === candidates.length) {
    const confidence = pages.length === 1 ? 'confident' : 'positional'
    pages.forEach((page, i) => {
      matches.push({
        confidence,
        date,
        page_id: page.page_id,
        page_url: page.url,
        notion_name: page.name,
        image_count: page.images.length,
        battle_id: candidates[i].id,
        battle_game: candidates[i].game,
        battle_opp: candidates[i].opp,
        battle_result: candidates[i].result,
      })
    })
    continue
  }

  // Counts disagree — pairing here would be invention, so hand it back.
  review.push({
    date,
    reason: `${pages.length} photo page(s) vs ${candidates.length} photoless battle(s)`,
    pages: pages.map(p => ({ page_id: p.page_id, name: p.name, images: p.images.length })),
    battles: candidates.map(b => ({ id: b.id, game: b.game, opp: b.opp, result: b.result })),
  })
}

// Undated Notion pages can't be joined on date at all.
const undated = inventory.pages.filter(p => !p.date && p.images.length > 0)

await writeFile(here('match-manifest.json'), JSON.stringify({ matches, review, undated }, null, 2))

const count = (c) => matches.filter(m => m.confidence === c).length
const photos = (c) =>
  matches.filter(m => m.confidence === c).reduce((n, m) => n + m.image_count, 0)

console.log(`confident   ${String(count('confident')).padStart(3)} battles  ${photos('confident')} photos`)
console.log(`positional  ${String(count('positional')).padStart(3)} battles  ${photos('positional')} photos`)
console.log(`review      ${String(review.length).padStart(3)} dates`)
console.log(`undated     ${String(undated.length).padStart(3)} pages    (no date to match on)`)
console.log('')
console.log(`matched     ${matches.length} battles / ${matches.reduce((n, m) => n + m.image_count, 0)} photos`)
console.log('')
console.log('Written to tools/notion-photos/match-manifest.json')
