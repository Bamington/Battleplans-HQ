// Work out which Notion page's photos belong to which battle.
//
//   node tools/notion-photos/match.mjs
//
// Reads inventory.json and battles.json, and metadata.json too once download.mjs
// has run. Writes match-manifest.json. Read-only: decides nothing, uploads
// nothing.
//
// There is no shared key between Notion and `battles` — the backfill that
// created battles 73–349 kept no reference to the page each row came from — so
// date is the only guaranteed join. Date alone is not enough on tournament
// days, where five rows can share a date. Two further signals narrow it:
//
//   game      Notion's Game relation vs the app's games.name
//   opponent  Notion lists Players; drop Chris and the rest is who he played,
//             which is exactly what battles.opp_name holds. In a tournament
//             every round has a different opponent, so this separates rounds
//             that date and game cannot.
//
// Both come from metadata.json. Without it this degrades to date-only matching
// and says so.

import { readFile, writeFile } from 'node:fs/promises'

const here = (name) => new URL(`./${name}`, import.meta.url)
const read = async (name) => JSON.parse(await readFile(here(name), 'utf8'))

const inventory = await read('inventory.json')
const battles = await read('battles.json')

let metadata = null
try {
  metadata = await read('metadata.json')
} catch {
  console.warn('! metadata.json not found — falling back to date-only matching.')
  console.warn('  Run download.mjs first for game and opponent signals.\n')
}

const meta = new Map((metadata?.pages ?? []).map(p => [p.page_id, p]))

// ── Normalisation ────────────────────────────────────────────────────────────
// "Star Wars: Legion" and "Star Wars Legion" are the same game; "Mike Mckie"
// and "Michael Mckie" are the same person. Compare on a stripped form.
const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Notion and the app grew their game lists separately, so the same game is
// often spelled differently. Containment covers most of it ("Warhammer: Age of
// Sigmar" contains "Age of Sigmar"); these two share no substring and need
// stating outright. Kept as an explicit table rather than fuzzier matching,
// because the cost of wrongly merging two games is a photo on the wrong
// battle — "Star Wars Legion" and "Star Wars X-Wing" would happily fuzzy-match.
const GAME_ALIASES = [
  ['X-Wing Miniatures', 'Star Wars X-Wing'],
  ['Kill Team (2021)', 'Warhammer 40,000: Kill Team'],
]

/** Same game, allowing for the two lists naming it differently. */
function sameGame(a, b) {
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return true // unknown on either side — don't disqualify
  if (x === y || x.includes(y) || y.includes(x)) return true
  return GAME_ALIASES.some(([p, q]) => {
    const [np, nq] = [norm(p), norm(q)]
    return (x === np && y === nq) || (x === nq && y === np)
  })
}

/** Do two names plausibly denote the same person? Exact, or one contains the
 *  other ("Wade" vs "Wade McDonald"), or the surnames agree. */
function samePerson(a, b) {
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return false
  if (x === y || x.includes(y) || y.includes(x)) return true

  const last = (s) => (s ?? '').trim().split(/\s+/).pop()
  const lx = norm(last(a))
  const ly = norm(last(b))
  return lx.length > 2 && lx === ly
}

// Chris is in the Players list of every game he played; whoever appears most
// often across the whole log is him. Derived rather than hardcoded so this
// keeps working if the log is ever shared or renamed.
function findOwner() {
  const tally = new Map()
  for (const page of meta.values()) {
    for (const player of page.players ?? []) tally.set(player, (tally.get(player) ?? 0) + 1)
  }
  return [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

const owner = meta.size ? findOwner() : null
if (owner) console.log(`Treating "${owner}" as Chris (most frequent player).\n`)

const opponentsOf = (page) => (page?.players ?? []).filter(p => p !== owner)

// ── Group both sides by date ─────────────────────────────────────────────────
const byDate = new Map()
const slot = (d) => {
  if (!byDate.has(d)) byDate.set(d, { pages: [], battles: [] })
  return byDate.get(d)
}

for (const page of inventory.pages) {
  if (page.date && page.images.length > 0) slot(page.date).pages.push(page)
}

// Battles that already have a photo are left alone — Chris's call, and they are
// all old-app rows whose photos are already the real thing.
for (const battle of battles) {
  if (battle.photos === 0) slot(battle.date).battles.push(battle)
}

// ── Scoring ──────────────────────────────────────────────────────────────────
// Game disagreement is disqualifying: a Blood Bowl photo must never land on a
// Shatterpoint battle. Everything else is preference.
const DISQUALIFIED = -Infinity

function score(page, battle) {
  const m = meta.get(page.page_id)
  if (!m) return 0

  if (m.game && battle.game && battle.game !== '?') {
    if (!sameGame(m.game, battle.game)) return DISQUALIFIED
  }

  let s = m.game && battle.game ? 2 : 0

  const opponents = opponentsOf(m)
  if (opponents.length && battle.opp) {
    // opp_name can hold several names for a multiplayer game.
    const listed = battle.opp.split(',').map(x => x.trim()).filter(Boolean)
    if (opponents.some(o => listed.some(l => samePerson(o, l)))) s += 10
  }

  return s
}

/** Best assignment of pages to battles. Exhaustive while the date is small,
 *  greedy beyond — a seven-game day is 5040 permutations, still trivial, but
 *  the guard keeps a pathological date from hanging the run. */
function assign(pages, candidates) {
  const n = pages.length

  if (n <= 7) {
    let best = null
    const order = candidates.map((_, i) => i)

    const permute = (arr, k = 0) => {
      if (k === arr.length) {
        const total = arr.reduce((sum, bi, pi) => sum + score(pages[pi], candidates[bi]), 0)
        if (best === null || total > best.total) best = { total, order: [...arr] }
        return
      }
      for (let i = k; i < arr.length; i++) {
        ;[arr[k], arr[i]] = [arr[i], arr[k]]
        permute(arr, k + 1)
        ;[arr[k], arr[i]] = [arr[i], arr[k]]
      }
    }

    permute(order.slice(0, n))
    return best?.order ?? pages.map((_, i) => i)
  }

  // Greedy: take the highest-scoring pair remaining, repeat.
  const pairs = []
  for (let p = 0; p < n; p++) {
    for (let b = 0; b < candidates.length; b++) pairs.push({ p, b, s: score(pages[p], candidates[b]) })
  }
  pairs.sort((a, b) => b.s - a.s)

  const taken = { p: new Set(), b: new Set() }
  const result = new Array(n)
  for (const { p, b, s } of pairs) {
    if (s === DISQUALIFIED || taken.p.has(p) || taken.b.has(b)) continue
    result[p] = b
    taken.p.add(p)
    taken.b.add(b)
  }
  // Anything unassigned falls back to whatever slot is left.
  const spare = candidates.map((_, i) => i).filter(i => !taken.b.has(i))
  for (let p = 0; p < n; p++) if (result[p] === undefined) result[p] = spare.shift()
  return result
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

  if (pages.length !== candidates.length) {
    review.push({
      date,
      reason: `${pages.length} photo page(s) vs ${candidates.length} photoless battle(s)`,
      pages: pages.map(p => ({ page_id: p.page_id, name: p.name, images: p.images.length })),
      battles: candidates.map(b => ({ id: b.id, game: b.game, opp: b.opp, result: b.result })),
    })
    continue
  }

  const order = assign(pages, candidates)

  pages.forEach((page, i) => {
    const battle = candidates[order[i]]
    const m = meta.get(page.page_id)
    const s = score(page, battle)

    // Sole candidate on the date, or the opponent's name agrees → certain.
    // Game agrees only → likely. Nothing to go on → ordering alone.
    const confidence =
      pages.length === 1 ? 'confident'
      : s >= 10 ? 'confident'
      : s >= 2 ? 'likely'
      : 'positional'

    matches.push({
      confidence,
      date,
      page_id: page.page_id,
      page_url: page.url,
      notion_name: page.name,
      notion_game: m?.game ?? null,
      notion_opponents: m ? opponentsOf(m) : [],
      image_count: page.images.length,
      battle_id: battle.id,
      battle_game: battle.game,
      battle_opp: battle.opp,
      battle_result: battle.result,
    })
  })
}

const undated = inventory.pages.filter(p => !p.date && p.images.length > 0)

await writeFile(here('match-manifest.json'), JSON.stringify({ matches, review, undated }, null, 2))

const tally = (c) => {
  const rows = matches.filter(m => m.confidence === c)
  return `${String(rows.length).padStart(3)} battles  ${rows.reduce((n, m) => n + m.image_count, 0)} photos`
}

console.log(`confident   ${tally('confident')}   (sole candidate, or opponent's name agrees)`)
console.log(`likely      ${tally('likely')}   (game agrees, opponent doesn't separate them)`)
console.log(`positional  ${tally('positional')}   (ordering alone)`)
console.log(`review      ${String(review.length).padStart(3)} dates`)
console.log(`undated     ${String(undated.length).padStart(3)} pages`)
console.log('')
console.log(`matched     ${matches.length} battles / ${matches.reduce((n, m) => n + m.image_count, 0)} photos`)
console.log('')
console.log('Written to tools/notion-photos/match-manifest.json')
