/**
 * columnTabs.ts — the navbar's view of the columns on screen
 *
 * The Navbar and a page's column row are siblings, so no prop can carry the
 * row's columns up to the bar. Each <ColumnShell> given a `tabLabel` registers
 * itself here instead, its <ColumnHeader> adds the icon, and the Navbar reads
 * the lot through `useColumnTabs()` to draw <ColumnTabs>.
 *
 * Same shape as profileDisplay.ts: a module-level listener set read through
 * useSyncExternalStore.
 */

import { createContext, useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'

export interface ColumnTabEntry {
  id: string
  /** Short name shown under the icon on hover / while the column is in view. */
  label: string
  /** The column header's icon. Null until the header has mounted. */
  icon: ReactNode
  /** The column's panel — its parent is the scrolling row. */
  el: HTMLElement
}

const entries = new Map<string, Omit<ColumnTabEntry, 'icon'>>()
// Kept apart from `entries` because React runs a child's effects before its
// parent's: the header reports its icon before the shell has registered.
const icons = new Map<string, ReactNode>()
let snapshot: ColumnTabEntry[] = []
const listeners = new Set<() => void>()

function publish(): void {
  // Left-to-right as laid out, not in mount order — a column that mounts late
  // (e.g. one that waits on a fetch) still takes its own place in the row.
  snapshot = [...entries.values()]
    .sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .map((e) => ({ ...e, icon: icons.get(e.id) ?? null }))
  listeners.forEach((l) => l())
}

export function registerColumnTab(entry: Omit<ColumnTabEntry, 'icon'>): void {
  entries.set(entry.id, entry)
  publish()
}

export function unregisterColumnTab(id: string): void {
  if (entries.delete(id)) publish()
}

/** Called by ColumnHeader so the tab always mirrors the header's current icon. */
export function setColumnTabIcon(id: string, icon: ReactNode): void {
  icons.set(id, icon)
  if (entries.has(id)) publish()
}

export function clearColumnTabIcon(id: string): void {
  icons.delete(id)
}

/**
 * The registry id of the column a ColumnHeader sits in, or null when that
 * column takes no tab. Provided by ColumnShell.
 */
export const ColumnTabContext = createContext<string | null>(null)

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => snapshot

// ── The navbar's hook ─────────────────────────────────────────────────────────

export interface ColumnTab extends ColumnTabEntry {
  /** The whole column is inside the row's visible area. */
  visible: boolean
}

export interface ColumnTabsState {
  tabs: ColumnTab[]
  /** The row is wider than the screen — some column is out of view. */
  overflowing: boolean
  /** Scroll just far enough that the whole column is in view. */
  reveal: (id: string) => void
}

/** px of slack, so sub-pixel layout doesn't flicker a column in and out. */
const SLACK = 1

export function useColumnTabs(): ColumnTabsState {
  const entriesNow = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const row = entriesNow[0]?.el.parentElement ?? null
  // Re-measure when columns come and go, not every time a header re-renders
  // and republishes its icon.
  const layoutKey = entriesNow.map((e) => e.id).join('|')

  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set())
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    if (!row) {
      setOverflowing(false)
      setVisibleIds(new Set())
      return
    }

    const measure = () => {
      const r = row.getBoundingClientRect()
      const next = new Set<string>()
      for (const e of entries.values()) {
        const c = e.el.getBoundingClientRect()
        if (c.left >= r.left - SLACK && c.right <= r.right + SLACK) next.add(e.id)
      }
      setVisibleIds((prev) =>
        prev.size === next.size && [...next].every((id) => prev.has(id)) ? prev : next,
      )
      setOverflowing(row.scrollWidth > row.clientWidth + SLACK)
    }

    measure()
    row.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(row)
    entries.forEach((e) => ro.observe(e.el))
    return () => {
      row.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [row, layoutKey])

  const reveal = useCallback(
    (id: string) => {
      const entry = entries.get(id)
      const scroller = entry?.el.parentElement
      if (!entry || !scroller) return

      const r = scroller.getBoundingClientRect()
      const c = entry.el.getBoundingClientRect()
      const style = getComputedStyle(scroller)
      const left = r.left + (parseFloat(style.scrollPaddingLeft) || 0)
      const right = r.right - (parseFloat(style.scrollPaddingRight) || 0)

      // Too far left, or too wide to fit at all → align its left edge.
      // Too far right → bring its right edge in. Already in view → stay put.
      let delta = 0
      if (c.left < left || c.width > right - left) delta = c.left - left
      else if (c.right > right) delta = c.right - right
      if (Math.abs(delta) < SLACK) return

      // Below lg the row snaps, and every panel is `snap-always`, which stops
      // any scroll at the very next column — so a tab two columns away only
      // ever got you one column along. Snapping is switched off for the jump,
      // and the jump lands on a snap point so nothing moves when it's back on:
      // going right, that's the first column start far enough along to bring
      // the clicked column's right edge in. (Going left already lands on one.)
      const snaps = style.scrollSnapType !== 'none'
      if (snaps && delta > 0) {
        for (const sibling of scroller.children) {
          const start = sibling.getBoundingClientRect().left - left
          if (start >= delta - SLACK) {
            delta = start
            break
          }
        }
      }

      if (snaps) {
        scroller.style.scrollSnapType = 'none'
        const restore = () => {
          scroller.style.scrollSnapType = ''
          scroller.removeEventListener('scrollend', restore)
          clearTimeout(fallback)
        }
        // scrollend is missing in older Safari; a smooth scroll is well done by then.
        const fallback = setTimeout(restore, 1000)
        scroller.addEventListener('scrollend', restore)
      }

      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      scroller.scrollBy({ left: delta, behavior: reduce ? 'auto' : 'smooth' })
    },
    [],
  )

  return {
    tabs: entriesNow.map((e) => ({ ...e, visible: visibleIds.has(e.id) })),
    overflowing,
    reveal,
  }
}
