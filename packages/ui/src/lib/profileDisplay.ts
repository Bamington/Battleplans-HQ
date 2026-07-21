/**
 * profileDisplay.ts — the navbar's view of "who am I"
 *
 * The username and profile picture are edited from two places that sit in
 * different parts of the tree:
 *
 *   ProfileModal — rendered BY the Navbar, so a callback prop reaches it.
 *   WelcomeModal — rendered by each app's router, a SIBLING of the Navbar, so
 *                  no prop can reach it.
 *
 * That asymmetry is why onboarding used to leave a stale avatar and stale
 * initials in the navbar until the next page load. Both modals publish here
 * instead, and the Navbar subscribes — no prop drilling, and it works wherever
 * a modal happens to be mounted.
 *
 * Same shape as impersonation.ts: a module-level listener set read through
 * useSyncExternalStore.
 */

import { useSyncExternalStore } from 'react'

export interface ProfileDisplay {
  /** Chosen username, or null before one is set / when signed out. */
  username: string | null
  /** Resolved public URL of the profile picture, or null for none. */
  avatarUrl: string | null
}

const EMPTY: ProfileDisplay = { username: null, avatarUrl: null }

let current: ProfileDisplay = EMPTY
const listeners = new Set<() => void>()

/**
 * Replace the cached display fields and re-render every subscriber.
 *
 * Call this after any write that changes what the navbar shows — the Navbar's
 * own initial load, a profile save, or an onboarding save.
 */
export function publishProfileDisplay(next: ProfileDisplay): void {
  // useSyncExternalStore compares snapshots by identity, so only swap the
  // object when a field actually changed. Publishing an equal value would
  // otherwise re-render every subscriber for nothing.
  if (current.username === next.username && current.avatarUrl === next.avatarUrl) return
  current = next
  listeners.forEach((l) => l())
}

/** Clear the cached fields — call on sign-out so the next user starts fresh. */
export function clearProfileDisplay(): void {
  publishProfileDisplay(EMPTY)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => current

/** Reactive read of the navbar's display fields. Re-renders when they change. */
export function useProfileDisplay(): ProfileDisplay {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
