/* ------------------------------------------------------------------ */
/*  Halo Flashpoint — plain-text army list parser                     */
/* ------------------------------------------------------------------ */

/** Weapon parsed from PDF (full details) or text (name only). */
export interface ParsedWeapon {
  name: string
  range?: string          // "CC", "R3", "R5"  (PDF only)
  ap?: string             // "-", "AP1"         (PDF only)
  keywords?: string       // "Optics, Weight of Fire(3)" (PDF only)
}

export interface ParsedUnit {
  name: string
  pointsCost: number
  /** Text import: string[] of weapon names. PDF import: ParsedWeapon[]. */
  weapons: (string | ParsedWeapon)[]
  // ── Optional stats (populated by PDF import, absent for text import) ──
  keywords?: string       // "Scout, Tactician(1)"
  ra?: number
  fi?: number
  sv?: number
  advance?: number
  sprint?: number
  ar?: number
  hp?: number
}

export interface ParsedSpecialOrder {
  name: string
  target: string
  pointsCost: number
}

/** Keyword definition with description, extracted from the PDF's reference section. */
export interface ParsedKeywordDef {
  name: string
  description: string
  hasParam: boolean       // true if the keyword uses (n) / (X)
}

export interface ParsedList {
  name: string
  pointsUsed: number
  pointsMax: number
  units: ParsedUnit[]
  specialOrders: ParsedSpecialOrder[]
  /** Keyword definitions from the PDF's "Keywords" section (empty for text import). */
  keywordDefs?: ParsedKeywordDef[]
}

const HEADER_RE = /^(.+?)\s*\[(\d+)\s*\/\s*(\d+)\]/
const UNIT_RE = /^([A-Z][\w\s'''\-/().]+?)\s*\[\+(\d+)\]/
const WEAPON_RE = /^\s*-\s*-\s*(.+?)\s*$/
const SPECIAL_ORDER_RE = /^\s*Special Order:\s*(.+?)\s*\((.+?)\)\s*\[\+(\d+)\]/i
const SKIP_RE = /^~.*~$/

export function parseHaloList(raw: string): ParsedList {
  const lines = raw.split(/\r?\n/)

  let name = ''
  let pointsUsed = 0
  let pointsMax = 0
  let headerParsed = false

  const units: ParsedUnit[] = []
  const specialOrders: ParsedSpecialOrder[] = []
  let currentUnit: ParsedUnit | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line === '') continue
    if (SKIP_RE.test(line)) continue

    // --- header ---
    if (!headerParsed) {
      const hm = rawLine.match(HEADER_RE)
      if (hm) {
        name = hm[1].trim()
        pointsUsed = Number(hm[2])
        pointsMax = Number(hm[3])
        headerParsed = true
        continue
      }
    }

    // --- special order ---
    const so = rawLine.match(SPECIAL_ORDER_RE)
    if (so) {
      specialOrders.push({
        name: so[1].trim(),
        target: so[2].trim(),
        pointsCost: Number(so[3]),
      })
      continue
    }

    // --- weapon (must check before unit, since unit regex is broad) ---
    const wm = rawLine.match(WEAPON_RE)
    if (wm) {
      if (currentUnit) currentUnit.weapons.push(wm[1].trim())
      continue
    }

    // --- unit ---
    const um = rawLine.match(UNIT_RE)
    if (um) {
      currentUnit = { name: um[1].trim(), pointsCost: Number(um[2]), weapons: [] }
      units.push(currentUnit)
      continue
    }
  }

  if (!headerParsed) {
    throw new Error('Could not find a valid list header (e.g. "List Name [100 / 150]")')
  }
  if (units.length === 0) {
    throw new Error('No units found in the list')
  }

  return { name, pointsUsed, pointsMax, units, specialOrders }
}

/* ------------------------------------------------------------------ */
/*  Keyword helpers (used by both text and PDF import flows)           */
/* ------------------------------------------------------------------ */

/**
 * Parse a keyword reference like "Weight of Fire(3)" into name + param.
 * Returns { name: "Weight of Fire", paramValue: 3 } or { name: "Scout", paramValue: null }.
 */
export function parseKeywordRef(ref: string): { name: string; paramValue: number | null } {
  const m = ref.trim().match(/^(.+?)\s*\((\d+)\)\s*$/)
  if (m) return { name: m[1].trim(), paramValue: Number(m[2]) }
  return { name: ref.trim(), paramValue: null }
}

/** Split a comma-separated keyword string, handling "Weight of Fire(3)" correctly. */
export function splitKeywords(raw: string): string[] {
  if (!raw || raw === '-') return []
  return raw.split(',').map(s => s.trim()).filter(s => s !== '' && s !== '-')
}
